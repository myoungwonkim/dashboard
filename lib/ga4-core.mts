import {queryDates} from './date-range.mts';
export const properties = {bazi:'550050295',sudoku:'558243778'} as const;
export type Query={app:keyof typeof properties,days:number,startDate?:string,endDate?:string,country:string,os:string};
export class GAError extends Error { code:string; status:number; constructor(code:string,status=502){super(code);this.code=code;this.status=status;} }
export function parseQuery(input:Record<string,unknown>):Query {
 if(typeof input.app!=='string'||!Object.hasOwn(properties,input.app)||!['all','KR','JP','US'].includes(String(input.country))||!['all','android','ios'].includes(String(input.os))) throw new GAError('invalid_query',400);
 try{return {app:input.app as Query['app'],...queryDates(input),country:String(input.country),os:String(input.os)};}catch{throw new GAError('invalid_query',400);}
}
export function reportsBody(q:Query){
 const exact=(fieldName:string,value:string)=>({filter:{fieldName,stringFilter:{matchType:'EXACT',value,caseSensitive:true}}});
 // Only app traffic; web streams in the same property are excluded.
 const expressions:unknown[]=[{filter:{fieldName:'platform',inListFilter:{values:['Android','iOS']}}}];
 if(q.country!=='all')expressions.push(exact('countryId',q.country));
 if(q.os!=='all')expressions.push(exact('operatingSystem',q.os==='android'?'Android':'iOS'));
 const base={dateRanges:[{startDate:q.startDate||`${q.days}daysAgo`,endDate:q.endDate||'yesterday'}],dimensionFilter:{andGroup:{expressions}},keepEmptyRows:true};
 return {requests:[{...base,metrics:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'}],limit:'1'}, {...base,dimensions:[{name:'date'}],metrics:[{name:'activeUsers'}],orderBys:[{dimension:{dimensionName:'date'}}],limit:String(q.days)}]};
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
export function parseReports(body:{reports?:Report[]},q:Query){
 const [total,daily]=body.reports||[];if(!total||!daily)throw new GAError('invalid_response');
 if(total.metricHeaders?.map(m=>m.name).join(',')!=='activeUsers,sessions,eventCount'||daily.metricHeaders?.[0]?.name!=='activeUsers'||daily.dimensionHeaders?.[0]?.name!=='date')throw new GAError('invalid_response');
 if((total.rows?.length||0)>1||(daily.rowCount||0)>q.days)throw new GAError('invalid_response');
 const dailyRows=(daily.rows||[]).map(row=>{const date=row.dimensionValues?.[0]?.value;if(!date||!/^\d{8}$/.test(date))throw new GAError('invalid_response');return {date,active:metric(row,0)};});
 const timezone=total.metadata?.timeZone||daily.metadata?.timeZone||'속성 시간대';
 return {app:q.app,propertyId:properties[q.app],activeUsers:metric(total.rows?.[0],0),sessions:metric(total.rows?.[0],1),events:metric(total.rows?.[0],2),averageDau:Math.round(dailyRows.reduce((s,r)=>s+r.active,0)/q.days),daily:dailyRows,timeZone:timezone,limited:!![total,daily].find(r=>r.metadata?.subjectToThresholding||r.metadata?.dataLossFromOtherRow||r.metadata?.samplingMetadatas?.length),fetchedAt:new Date().toISOString(),days:q.days};
}
export async function fetchReport(q:Query,token:string,fetcher:typeof fetch=fetch){
 const response=await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${properties[q.app]}:batchRunReports`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(reportsBody(q)),signal:AbortSignal.timeout(15000)});
 if(!response.ok){
 let code=response.status===403?'permission_denied':response.status===429?'quota_exceeded':response.status===401?'authentication_failed':'provider_error';
 // Never forward provider messages or metadata; only recognize documented reason codes.
 if(response.status===403){try{const body=await response.json() as {error?:{details?:{reason?:string}[]}};const reasons=(body.error?.details||[]).map(d=>d.reason);if(reasons.includes('SERVICE_DISABLED'))code='api_disabled';else if(reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT'))code='scope_insufficient';}catch{}}
 throw new GAError(code,response.status===429?429:502);
 }
 return parseReports(await response.json(),q);
}

export type PropertyCheck={app:keyof typeof properties;propertyId:string;ok:boolean;code:string};
export async function verifyProperties(token:string,fetcher:typeof fetch=fetch):Promise<PropertyCheck[]>{
 return Promise.all((['bazi','sudoku'] as const).map(async app=>{
  try{await fetchReport({app,days:7,country:'all',os:'all'},token,fetcher);return {app,propertyId:properties[app],ok:true,code:'ok'};}
  catch(error){return {app,propertyId:properties[app],ok:false,code:error instanceof GAError?error.code:'network_error'};}
 }));
}
