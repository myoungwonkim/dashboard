import type {Query} from './ga4-core.mts';

const DAY=86400000;
function iso(ms:number){const d=new Date(ms);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;}
function utcMidnight(ymd:string){return Date.parse(ymd+'T00:00:00Z');}
/** Resolve query to absolute UTC dates for cohort windows (GA4 accepts relative only on top-level dateRanges). */
export function cohortAbsoluteRange(q:Query,now=new Date()){
 if(q.startDate&&q.endDate)return {startDate:q.startDate,endDate:q.endDate};
 const end=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())-DAY;
 const start=end-(q.days-1)*DAY;
 return {startDate:iso(start),endDate:iso(end)};
}
export function eachDayInclusive(startDate:string,endDate:string){
 const out:string[]=[];
 for(let t=utcMidnight(startDate);t<=utcMidnight(endDate);t+=DAY)out.push(iso(t));
 return out;
}
export type RetentionSummary={d1:number|null;d7:number|null;d14:number|null;d30:number|null;cohorts:number;endOffset:number};
export type RetentionRow={cohort:string;users:number;rates:Record<number,number|null>};
export type RetentionData={summary:RetentionSummary;rows:RetentionRow[];offsets:number[]};

function avgAt(rows:RetentionRow[],day:number){
 const vals=rows.map(r=>r.rates[day]).filter((v):v is number=>v!=null&&Number.isFinite(v));
 if(!vals.length)return null;
 return vals.reduce((s,v)=>s+v,0)/vals.length;
}

/** Soft-fail body: one cohort per acquisition day (DAILY requires single-day ranges). */
export function cohortReportBody(q:Query,now=new Date()){
 const {startDate,endDate}=cohortAbsoluteRange(q,now);
 const all=eachDayInclusive(startDate,endDate);
 const cohortDates=all.slice(-14); // keep request size bounded
 const span=Math.max(1,Math.round((utcMidnight(endDate)-utcMidnight(startDate))/DAY)+1);
 const endOffset=span>=45?30:span>=21?14:7;
 const expressions:unknown[]=[{filter:{fieldName:'platform',inListFilter:{values:['Android','iOS']}}}];
 if(q.country!=='all')expressions.push({filter:{fieldName:'countryId',stringFilter:{matchType:'EXACT',value:q.country,caseSensitive:true}}});
 if(q.os!=='all')expressions.push({filter:{fieldName:'operatingSystem',stringFilter:{matchType:'EXACT',value:q.os==='android'?'Android':'iOS',caseSensitive:true}}});
 return {
  dimensions:[{name:'cohort'},{name:'cohortNthDay'}],
  metrics:[{name:'cohortActiveUsers'},{name:'cohortTotalUsers'},{name:'cohortRetentionRate'}],
  dimensionFilter:{andGroup:{expressions}},
  cohortSpec:{
   cohorts:cohortDates.map(d=>({name:d,dimension:'firstSessionDate',dateRange:{startDate:d,endDate:d}})),
   cohortsRange:{granularity:'DAILY',startOffset:0,endOffset},
  },
  keepEmptyRows:true,
  limit:String(Math.min(100000,cohortDates.length*(endOffset+1))),
 };
}

type Report={metricHeaders?:{name:string}[];dimensionHeaders?:{name:string}[];rows?:{metricValues?:{value:string}[];dimensionValues?:{value:string}[]}[]};
function num(v:string|undefined){
 if(v===undefined||v===null||v==='')return null;
 if(!/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(String(v).trim()))return null;
 const n=Number(v);return Number.isFinite(n)?n:null;
}

export function parseCohortReport(body:unknown):RetentionData|null{
 const report=(body as {reports?:Report[]})?.reports?.[0]||(body as Report);
 if(!report?.metricHeaders||!report.dimensionHeaders)return null;
 const m=report.metricHeaders.map(h=>h.name);
 const d=report.dimensionHeaders.map(h=>h.name);
 if(d.join(',')!=='cohort,cohortNthDay')return null;
 const iActive=m.indexOf('cohortActiveUsers');
 const iTotal=m.indexOf('cohortTotalUsers');
 const iRate=m.indexOf('cohortRetentionRate');
 if(iActive<0||iTotal<0||iRate<0)return null;
 const byCohort=new Map<string,{users:number;rates:Record<number,number|null>}>();
 let maxOffset=0;
 for(const row of report.rows||[]){
  const cohort=row.dimensionValues?.[0]?.value;
  const nthRaw=row.dimensionValues?.[1]?.value;
  if(!cohort||nthRaw==null)continue;
  const nth=Number(String(nthRaw).replace(/^0+(?=\d)/,''));
  if(!Number.isFinite(nth)||nth<0)continue;
  maxOffset=Math.max(maxOffset,nth);
  const bucket=byCohort.get(cohort)||{users:0,rates:{}};
  const total=num(row.metricValues?.[iTotal]?.value);
  const rate=num(row.metricValues?.[iRate]?.value);
  if(nth===0&&total!=null)bucket.users=Math.max(bucket.users,total);
  bucket.rates[nth]=rate;
  byCohort.set(cohort,bucket);
 }
 if(!byCohort.size)return null;
 const rows:RetentionRow[]=[...byCohort.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([cohort,v])=>({
  cohort:cohort.replaceAll('-',''),
  users:v.users,
  rates:v.rates,
 }));
 const offsets=[...Array(maxOffset+1).keys()];
 return {
  rows,
  offsets,
  summary:{d1:avgAt(rows,1),d7:avgAt(rows,7),d14:avgAt(rows,14),d30:avgAt(rows,30),cohorts:rows.length,endOffset:maxOffset},
 };
}
