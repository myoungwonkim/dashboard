import {queryDates} from './date-range.mts';
import {SLUG_RE} from './apps.ts';
import {isCountryFilter} from './countries.mts';
import {cohortReportBody,parseCohortReport,type RetentionData} from './ga4-cohort.mts';
/** @deprecated Kept for tests/fixtures; live lookups use the apps registry. */
export const properties = {bazi:'550050295',sudoku:'558243778'} as const;
export type Query={app:string,days:number,startDate?:string,endDate?:string,country:string,os:string};
export class GAError extends Error { code:string; status:number; constructor(code:string,status=502){super(code);this.code=code;this.status=status;} }
export function parseQuery(input:Record<string,unknown>):Query {
 if(typeof input.app!=='string'||!SLUG_RE.test(input.app)||!isCountryFilter(input.country)||!['all','android','ios'].includes(String(input.os))) throw new GAError('invalid_query',400);
 try{return {app:input.app,...queryDates(input),country:String(input.country),os:String(input.os)};}catch{throw new GAError('invalid_query',400);}
}
function dimensionFilter(q:Query){
 const exact=(fieldName:string,value:string)=>({filter:{fieldName,stringFilter:{matchType:'EXACT',value,caseSensitive:true}}});
 // Only app traffic; web streams in the same property are excluded.
 const expressions:unknown[]=[{filter:{fieldName:'platform',inListFilter:{values:['Android','iOS']}}}];
 if(q.country!=='all')expressions.push(exact('countryId',q.country));
 if(q.os!=='all')expressions.push(exact('operatingSystem',q.os==='android'?'Android':'iOS'));
 return {andGroup:{expressions}};
}
function reportBase(q:Query){
 return {dateRanges:[{startDate:q.startDate||`${q.days}daysAgo`,endDate:q.endDate||'yesterday'}],dimensionFilter:dimensionFilter(q),keepEmptyRows:true};
}
const CORE_TOTAL_METRICS=['activeUsers','sessions','eventCount','newUsers','engagedSessions','engagementRate','averageSessionDuration','sessionsPerUser'] as const;
/** Minimal totals — fewer metrics so quirky properties still parse. */
export function minimalReportsBody(q:Query){
 const base=reportBase(q);
 return {requests:[
  {...base,metrics:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'},{name:'newUsers'}],limit:'1'},
  {...base,dimensions:[{name:'date'}],metrics:[{name:'activeUsers'},{name:'newUsers'},{name:'sessions'}],orderBys:[{dimension:{dimensionName:'date'}}],limit:String(Math.max(q.days,31))},
 ]};
}
/** Core totals + daily series only — used as fallback when deep P1 batch fails. */
export function coreReportsBody(q:Query){
 const base=reportBase(q);
 return {requests:[
  {...base,metrics:CORE_TOTAL_METRICS.map(name=>({name})),limit:'1'},
  {...base,dimensions:[{name:'date'}],metrics:[{name:'activeUsers'},{name:'newUsers'},{name:'sessions'}],orderBys:[{dimension:{dimensionName:'date'}}],limit:String(Math.max(q.days,31))},
 ]};
}
export function reportsBody(q:Query){
 const base=reportBase(q);
 const core=coreReportsBody(q).requests;
 return {requests:[
  ...core,
  {...base,dimensions:[{name:'firstUserSource'},{name:'firstUserMedium'}],metrics:[{name:'newUsers'}],orderBys:[{metric:{metricName:'newUsers'},desc:true}],limit:'10',keepEmptyRows:false},
  {...base,dimensions:[{name:'country'}],metrics:[{name:'activeUsers'},{name:'newUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:'10',keepEmptyRows:false},
  {...base,dimensions:[{name:'appVersion'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:'10',keepEmptyRows:false},
 ]};
}
export function crashBody(q:Query){
 const base={dateRanges:[{startDate:q.startDate||`${q.days}daysAgo`,endDate:q.endDate||'yesterday'}],dimensionFilter:dimensionFilter(q),keepEmptyRows:true};
 return {requests:[{...base,metrics:[{name:'crashAffectedUsers'},{name:'crashFreeUsersRate'}],limit:'1'}]};
}
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const encode=(value:unknown)=>b64(new TextEncoder().encode(JSON.stringify(value)));
export async function accessToken(email:string,keyPem:string,fetcher:typeof fetch=fetch){
 if(!email||!keyPem)throw new GAError('not_configured',503);
 if(!email.endsWith('.gserviceaccount.com'))throw new GAError('invalid_credentials',503);
 let jwt:string;
 try{
 const text=keyPem.replaceAll('\\n','\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const now=Math.floor(Date.now()/1000);const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 jwt=unsigned+'.'+b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned))));
 }catch{throw new GAError('invalid_credentials',503);}
 const res=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw new GAError(res.status===429?'quota_exceeded':'authentication_failed',res.status===429?429:502);
 const value=await res.json() as {access_token?:unknown}; if(typeof value.access_token!=='string'||!value.access_token)throw new GAError('authentication_failed'); return value.access_token;
}
type Report={metricHeaders?:{name:string}[],dimensionHeaders?:{name:string}[],rows?:{metricValues?:{value:string}[],dimensionValues?:{value:string}[]}[],rowCount?:number,metadata?:{timeZone?:string,subjectToThresholding?:boolean,dataLossFromOtherRow?:boolean,samplingMetadatas?:unknown[]}};
function metric(row:NonNullable<Report['rows']>[number]|undefined,index:number){
 if(!row)return 0;
 const raw=row.metricValues?.[index]?.value;
 if(raw===undefined||raw===null||raw==='')return 0;
 const value=String(raw).trim();
 if(!/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value))throw new GAError('invalid_response');
 const n=Number(value);if(!Number.isFinite(n))throw new GAError('invalid_response');
 return n;
}
function dim(row:NonNullable<Report['rows']>[number],index:number){
 const value=row.dimensionValues?.[index]?.value;
 if(typeof value!=='string')return '(not set)';
 return value||'(not set)';
}
function limited(...reports:Report[]){return !!reports.find(r=>r.metadata?.subjectToThresholding||r.metadata?.dataLossFromOtherRow||r.metadata?.samplingMetadatas?.length);}
function headersMatch(report:Report|undefined,metrics:string[],dims?:string[]){
 if(!report?.metricHeaders)return false;
 if(report.metricHeaders.map(m=>m.name).join(',')!==metrics.join(','))return false;
 if(dims&&report.dimensionHeaders?.map(d=>d.name).join(',')!==dims.join(','))return false;
 return true;
}
function mapRows<T>(rows:Report['rows']|undefined,map:(row:NonNullable<Report['rows']>[number])=>T|null):T[]{
 const out:T[]=[];
 for(const row of rows||[]){try{const v=map(row);if(v)out.push(v);}catch{/* skip bad breakdown rows */}}
 return out;
}
export function parseReports(body:{reports?:Report[]},q:Query,propertyId:string,crash?:{reports?:Report[]}|null){
 const reports=body.reports||[];
 const [total,daily,firstUser,country,version]=reports;
 if(!total||!daily)throw new GAError('invalid_response');
 const totalHeaders=total.metricHeaders?.map(m=>m.name)||[];
 const fullTotal=totalHeaders.join(',')===CORE_TOTAL_METRICS.join(',');
 const miniTotal=totalHeaders.join(',')==='activeUsers,sessions,eventCount,newUsers';
 if(!fullTotal&&!miniTotal)throw new GAError('invalid_response');
 if(!headersMatch(daily,['activeUsers','newUsers','sessions'],['date']))throw new GAError('invalid_response');
 const deep=reports.length>=5;
 if((total.rows?.length||0)>1)throw new GAError('invalid_response');
 const dailyRows=mapRows(daily.rows,row=>{
  const date=dim(row,0);if(!/^\d{8}$/.test(date))return null;
  return {date,active:metric(row,0),newUsers:metric(row,1),sessions:metric(row,2)};
 });
 const timezone=total.metadata?.timeZone||daily.metadata?.timeZone||'속성 시간대';
 let crashAffectedUsers:number|null=null,crashFreeUsersRate:number|null=null;
 const crashReport=crash?.reports?.[0];
 if(crashReport?.metricHeaders?.map(m=>m.name).join(',')==='crashAffectedUsers,crashFreeUsersRate'){
  crashAffectedUsers=metric(crashReport.rows?.[0],0);
  crashFreeUsersRate=metric(crashReport.rows?.[0],1);
 }
 const totalRow=total.rows?.[0];
 return {
  app:q.app,propertyId,
  activeUsers:metric(totalRow,0),sessions:metric(totalRow,1),events:metric(totalRow,2),
  newUsers:metric(totalRow,3),
  engagedSessions:fullTotal?metric(totalRow,4):0,
  engagementRate:fullTotal?metric(totalRow,5):0,
  averageSessionDuration:fullTotal?metric(totalRow,6):0,
  sessionsPerUser:fullTotal?metric(totalRow,7):0,
  averageDau:Math.round(dailyRows.reduce((s,r)=>s+r.active,0)/q.days),
  crashAffectedUsers,crashFreeUsersRate,
  daily:dailyRows,
  firstUser:deep?mapRows(firstUser?.rows,row=>({source:dim(row,0),medium:dim(row,1),newUsers:metric(row,0)})):[],
  countries:deep?mapRows(country?.rows,row=>({country:dim(row,0),activeUsers:metric(row,0),newUsers:metric(row,1)})):[],
  versions:deep?mapRows(version?.rows,row=>({version:dim(row,0),activeUsers:metric(row,0)})):[],
  timeZone:timezone,
  limited:limited(total,daily,...(deep?[firstUser!,country!,version!].filter(Boolean) as Report[]:[]),...(crashReport?[crashReport]:[])),
  fetchedAt:new Date().toISOString(),days:q.days,
 };
}
async function runBatch(id:string,token:string,body:unknown,run:typeof fetch){
 const response=await run(`https://analyticsdata.googleapis.com/v1beta/properties/${id}:batchRunReports`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 if(!response.ok){
  let code=response.status===403?'permission_denied':response.status===429?'quota_exceeded':response.status===401?'authentication_failed':'provider_error';
  // Never forward provider messages or metadata; only recognize documented reason codes.
  if(response.status===403){try{const body=await response.json() as {error?:{details?:{reason?:string}[]}};const reasons=(body.error?.details||[]).map(d=>d.reason);if(reasons.includes('SERVICE_DISABLED'))code='api_disabled';else if(reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT'))code='scope_insufficient';}catch{}}
  throw new GAError(code,response.status===429?429:502);
 }
 return await response.json() as {reports?:Report[]};
}
function isHardAuthError(error:unknown){
 return error instanceof GAError&&['permission_denied','api_disabled','authentication_failed','scope_insufficient','not_configured','invalid_credentials'].includes(error.code);
}
export async function fetchReport(q:Query,token:string,propertyIdOrFetcher?:string|typeof fetch,fetcher:typeof fetch=fetch){
 const propertyId=typeof propertyIdOrFetcher==='string'?propertyIdOrFetcher:undefined;
 const run=typeof propertyIdOrFetcher==='function'?propertyIdOrFetcher:fetcher;
 const id=propertyId||(Object.hasOwn(properties,q.app)?properties[q.app as keyof typeof properties]:'');
 if(!id||!/^\d{6,12}$/.test(id))throw new GAError('invalid_query',400);
 async function load(body:unknown){return runBatch(id,token,body,run);}
 async function parseOrThrow(main:{reports?:Report[]},crash:{reports?:Report[]}|null){return parseReports(main,q,id,crash);}
 let crash: {reports?:Report[]}|null=null;
 try{crash=await load(crashBody(q));}catch{crash=null;}
 // Prefer deep → core → minimal. Retry on transport OR parse (invalid_response) failures.
 const attempts=[reportsBody(q),coreReportsBody(q),minimalReportsBody(q)];
 let last:unknown;
 let base:Awaited<ReturnType<typeof parseOrThrow>>|null=null;
 for(let i=0;i<attempts.length;i++){
  try{
   const main=await load(attempts[i]);
   // Deep payload may parse-fail; try slicing to core reports before next network call.
   try{base=await parseOrThrow(main,crash);break;}
   catch(parseError){
    if(i===0&&(main.reports?.length||0)>=2){
     try{base=await parseOrThrow({reports:main.reports!.slice(0,2)},crash);break;}catch{/* continue */}
    }
    throw parseError;
   }
  }catch(error){
   last=error;
   if(isHardAuthError(error))throw error;
  }
 }
 if(!base)throw last instanceof GAError?last:new GAError('invalid_response');
 // Daily cohort retention — soft-fail so main KPIs still return.
 let retention:RetentionData|null=null;
 try{
  const cohort=await run(`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(cohortReportBody(q)),signal:AbortSignal.timeout(25000)});
  if(cohort.ok)retention=parseCohortReport(await cohort.json());
 }catch{retention=null;}
 return {...base,retention};
}

export type PropertyCheck={app:string;propertyId:string;ok:boolean;code:string};

/** Lightweight connection probe — one metric only, so P1 deep reports cannot block setup. */
export async function probeProperty(propertyId:string,token:string,fetcher:typeof fetch=fetch){
 if(!/^\d{6,12}$/.test(propertyId))throw new GAError('invalid_query',400);
 const body={requests:[{dateRanges:[{startDate:'7daysAgo',endDate:'yesterday'}],metrics:[{name:'activeUsers'}],dimensionFilter:{filter:{fieldName:'platform',inListFilter:{values:['Android','iOS']}}},limit:'1'}]};
 await runBatch(propertyId,token,body,fetcher);
}

export async function verifyProperties(token:string,targetsOrFetcher?:{app:string;propertyId:string}[]|typeof fetch,fetcher:typeof fetch=fetch):Promise<PropertyCheck[]>{
 const run=typeof targetsOrFetcher==='function'?targetsOrFetcher:fetcher;
 const list=Array.isArray(targetsOrFetcher)&&targetsOrFetcher.length?targetsOrFetcher:(['bazi','sudoku'] as const).map(app=>({app,propertyId:properties[app]}));
 return Promise.all(list.map(async ({app,propertyId})=>{
  try{await probeProperty(propertyId,token,run);return {app,propertyId,ok:true,code:'ok'};}
  catch(error){return {app,propertyId,ok:false,code:error instanceof GAError?error.code:'network_error'};}
 }));
}
