import {queryDates} from './date-range.mts';
import {SLUG_RE} from './apps.ts';
/** @deprecated Kept for tests/fixtures; live lookups use the apps registry. */
export const properties = {bazi:'550050295',sudoku:'558243778'} as const;
export type Query={app:string,days:number,startDate?:string,endDate?:string,country:string,os:string};
export class GAError extends Error { code:string; status:number; constructor(code:string,status=502){super(code);this.code=code;this.status=status;} }
export function parseQuery(input:Record<string,unknown>):Query {
 if(typeof input.app!=='string'||!SLUG_RE.test(input.app)||!['all','KR','JP','US'].includes(String(input.country))||!['all','android','ios'].includes(String(input.os))) throw new GAError('invalid_query',400);
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
export function reportsBody(q:Query){
 const base={dateRanges:[{startDate:q.startDate||`${q.days}daysAgo`,endDate:q.endDate||'yesterday'}],dimensionFilter:dimensionFilter(q),keepEmptyRows:true};
 return {requests:[
  {...base,metrics:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'},{name:'newUsers'},{name:'engagedSessions'},{name:'engagementRate'},{name:'averageSessionDuration'},{name:'sessionsPerUser'}],limit:'1'},
  {...base,dimensions:[{name:'date'}],metrics:[{name:'activeUsers'},{name:'newUsers'},{name:'sessions'}],orderBys:[{dimension:{dimensionName:'date'}}],limit:String(q.days)},
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
function metric(row:NonNullable<Report['rows']>[number]|undefined,index:number){if(!row)return 0;const value=row.metricValues?.[index]?.value;if(value===undefined||!/^\d+(\.\d+)?$/.test(value))throw new GAError('invalid_response');return Number(value);}
function dim(row:NonNullable<Report['rows']>[number],index:number){const value=row.dimensionValues?.[index]?.value;if(typeof value!=='string'||!value)throw new GAError('invalid_response');return value;}
function limited(...reports:Report[]){return !!reports.find(r=>r.metadata?.subjectToThresholding||r.metadata?.dataLossFromOtherRow||r.metadata?.samplingMetadatas?.length);}
export function parseReports(body:{reports?:Report[]},q:Query,propertyId:string,crash?:{reports?:Report[]}|null){
 const [total,daily,firstUser,country,version]=body.reports||[];
 if(!total||!daily||!firstUser||!country||!version)throw new GAError('invalid_response');
 if(total.metricHeaders?.map(m=>m.name).join(',')!=='activeUsers,sessions,eventCount,newUsers,engagedSessions,engagementRate,averageSessionDuration,sessionsPerUser')throw new GAError('invalid_response');
 if(daily.metricHeaders?.map(m=>m.name).join(',')!=='activeUsers,newUsers,sessions'||daily.dimensionHeaders?.[0]?.name!=='date')throw new GAError('invalid_response');
 if(firstUser.dimensionHeaders?.map(d=>d.name).join(',')!=='firstUserSource,firstUserMedium'||firstUser.metricHeaders?.[0]?.name!=='newUsers')throw new GAError('invalid_response');
 if(country.dimensionHeaders?.[0]?.name!=='country'||country.metricHeaders?.map(m=>m.name).join(',')!=='activeUsers,newUsers')throw new GAError('invalid_response');
 if(version.dimensionHeaders?.[0]?.name!=='appVersion'||version.metricHeaders?.[0]?.name!=='activeUsers')throw new GAError('invalid_response');
 if((total.rows?.length||0)>1||(daily.rowCount||0)>q.days)throw new GAError('invalid_response');
 const dailyRows=(daily.rows||[]).map(row=>{const date=dim(row,0);if(!/^\d{8}$/.test(date))throw new GAError('invalid_response');return {date,active:metric(row,0),newUsers:metric(row,1),sessions:metric(row,2)};});
 const timezone=total.metadata?.timeZone||daily.metadata?.timeZone||'속성 시간대';
 let crashAffectedUsers:number|null=null,crashFreeUsersRate:number|null=null;
 const crashReport=crash?.reports?.[0];
 if(crashReport?.metricHeaders?.map(m=>m.name).join(',')==='crashAffectedUsers,crashFreeUsersRate'){
  crashAffectedUsers=metric(crashReport.rows?.[0],0);
  crashFreeUsersRate=metric(crashReport.rows?.[0],1);
 }
 return {
  app:q.app,propertyId,
  activeUsers:metric(total.rows?.[0],0),sessions:metric(total.rows?.[0],1),events:metric(total.rows?.[0],2),
  newUsers:metric(total.rows?.[0],3),engagedSessions:metric(total.rows?.[0],4),engagementRate:metric(total.rows?.[0],5),
  averageSessionDuration:metric(total.rows?.[0],6),sessionsPerUser:metric(total.rows?.[0],7),
  averageDau:Math.round(dailyRows.reduce((s,r)=>s+r.active,0)/q.days),
  crashAffectedUsers,crashFreeUsersRate,
  daily:dailyRows,
  firstUser:(firstUser.rows||[]).map(row=>({source:dim(row,0),medium:dim(row,1),newUsers:metric(row,0)})),
  countries:(country.rows||[]).map(row=>({country:dim(row,0),activeUsers:metric(row,0),newUsers:metric(row,1)})),
  versions:(version.rows||[]).map(row=>({version:dim(row,0),activeUsers:metric(row,0)})),
  timeZone:timezone,
  limited:limited(total,daily,firstUser,country,version,...(crashReport?[crashReport]:[])),
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
export async function fetchReport(q:Query,token:string,propertyIdOrFetcher?:string|typeof fetch,fetcher:typeof fetch=fetch){
 const propertyId=typeof propertyIdOrFetcher==='string'?propertyIdOrFetcher:undefined;
 const run=typeof propertyIdOrFetcher==='function'?propertyIdOrFetcher:fetcher;
 const id=propertyId||(Object.hasOwn(properties,q.app)?properties[q.app as keyof typeof properties]:'');
 if(!id||!/^\d{6,12}$/.test(id))throw new GAError('invalid_query',400);
 const main=await runBatch(id,token,reportsBody(q),run);
 let crash: {reports?:Report[]}|null=null;
 try{crash=await runBatch(id,token,crashBody(q),run);}catch{crash=null;}
 return parseReports(main,q,id,crash);
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
