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

/** Cohort-size weighted mean retention at nth day; falls back to unweighted if sizes missing. */
export function weightedRateAt(rows:RetentionRow[],day:number){
 let num=0,den=0,fallback=0,n=0;
 for(const r of rows){
  const v=r.rates[day];
  if(v==null||!Number.isFinite(v))continue;
  const w=r.users||0;
  if(w>0){num+=v*w;den+=w;}
  else{fallback+=v;n++;}
 }
 if(den>0)return num/den;
 if(n>0)return fallback/n;
 return null;
}
export function retentionTotals(rows:RetentionRow[],offsets:number[]){
 const users=rows.reduce((s,r)=>s+(r.users||0),0);
 const rates:Record<number,number|null>={};
 for(const d of offsets)rates[d]=weightedRateAt(rows,d);
 return {users,rates};
}

function dimensionFilter(q:Query,includeAudienceFilters:boolean){
 const expressions:unknown[]=[{filter:{fieldName:'platform',inListFilter:{values:['Android','iOS']}}}];
 if(includeAudienceFilters){
  if(q.country!=='all')expressions.push({filter:{fieldName:'countryId',stringFilter:{matchType:'EXACT',value:q.country,caseSensitive:true}}});
  if(q.os!=='all')expressions.push({filter:{fieldName:'operatingSystem',stringFilter:{matchType:'EXACT',value:q.os==='android'?'Android':'iOS',caseSensitive:true}}});
 }
 return {andGroup:{expressions}};
}

/** Soft-fail body: one cohort per acquisition day (DAILY requires single-day ranges). */
export function cohortReportBody(q:Query,now=new Date(),opts?:{audienceFilters?:boolean}){
 const {startDate,endDate}=cohortAbsoluteRange(q,now);
 const all=eachDayInclusive(startDate,endDate);
 const cohortDates=all.slice(-14); // keep request size bounded
 const span=Math.max(1,Math.round((utcMidnight(endDate)-utcMidnight(startDate))/DAY)+1);
 const endOffset=span>=45?30:span>=21?14:7;
 // cohortRetentionRate is NOT a built-in metric — must be an expression.
 return {
  dimensions:[{name:'cohort'},{name:'cohortNthDay'}],
  metrics:[
   {name:'cohortActiveUsers'},
   {name:'cohortTotalUsers'},
   {name:'cohortRetentionRate',expression:'cohortActiveUsers/cohortTotalUsers'},
  ],
  dimensionFilter:dimensionFilter(q,opts?.audienceFilters!==false),
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
 if(!d.includes('cohort')||!d.includes('cohortNthDay'))return null;
 const iCohort=d.indexOf('cohort');
 const iNth=d.indexOf('cohortNthDay');
 const iActive=m.indexOf('cohortActiveUsers');
 const iTotal=m.indexOf('cohortTotalUsers');
 const iRate=m.findIndex(name=>/retention|fraction/i.test(name));
 if(iActive<0||iTotal<0)return null;
 const byCohort=new Map<string,{users:number;rates:Record<number,number|null>}>();
 let maxOffset=0;
 for(const row of report.rows||[]){
  const cohort=row.dimensionValues?.[iCohort]?.value;
  const nthRaw=row.dimensionValues?.[iNth]?.value;
  if(!cohort||nthRaw==null)continue;
  const nth=Number(String(nthRaw).replace(/^0+(?=\d)/,''));
  if(!Number.isFinite(nth)||nth<0)continue;
  maxOffset=Math.max(maxOffset,nth);
  const bucket=byCohort.get(cohort)||{users:0,rates:{}};
  const active=num(row.metricValues?.[iActive]?.value);
  const total=num(row.metricValues?.[iTotal]?.value);
  let rate=iRate>=0?num(row.metricValues?.[iRate]?.value):null;
  if(rate==null&&active!=null&&total!=null&&total>0)rate=active/total;
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
  summary:{d1:weightedRateAt(rows,1),d7:weightedRateAt(rows,7),d14:weightedRateAt(rows,14),d30:weightedRateAt(rows,30),cohorts:rows.length,endOffset:maxOffset},
 };
}

/** Fetch cohort retention; retries without country/OS filters if the first attempt fails. */
export async function fetchCohortRetention(propertyId:string,token:string,q:Query,fetcher:typeof fetch=fetch):Promise<{retention:RetentionData|null;note:string|null}>{
 const attempts=[{audienceFilters:true as const},{audienceFilters:false as const}];
 let lastStatus=0;
 for(const opts of attempts){
  try{
   const res=await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(cohortReportBody(q,undefined,opts)),
    signal:AbortSignal.timeout(25000),
   });
   lastStatus=res.status;
   if(!res.ok)continue;
   const parsed=parseCohortReport(await res.json());
   if(parsed)return {retention:parsed,note:opts.audienceFilters?null:'국가/OS 필터 없이 집계한 리텐션입니다.'};
  }catch{/* try next */}
 }
 if(lastStatus===403)return {retention:null,note:'리텐션 조회 권한이 없습니다.'};
 if(lastStatus===400)return {retention:null,note:'리텐션 요청이 거절되었습니다. 기간을 7일 이상으로 바꿔 보세요.'};
 if(lastStatus)return {retention:null,note:`리텐션 조회 실패 (HTTP ${lastStatus}).`};
 return {retention:null,note:'리텐션을 불러오지 못했습니다.'};
}
