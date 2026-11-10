import {queryDates,dateMillis} from './date-range.mts';
import {ADMOB_APP_ID_RE,SLUG_RE} from './apps.ts';
// User-provided AdMob inventory. Identifiers are not authentication credentials.
export const admobPublisherId='pub-4999376453226791';
/** @deprecated Prefer registry inventory; kept for tests and seed display. */
export const admobApps=[
 {app:'bazi',name:'읽어주는 만세력',os:'android',appId:'ca-app-pub-4999376453226791~5692726639'},
 {app:'bazi',name:'읽어주는 만세력',os:'ios',appId:'ca-app-pub-4999376453226791~2304842432'},
 {app:'sudoku',name:'스도쿠 마스터',os:'android',appId:'ca-app-pub-4999376453226791~7315994561'},
 {app:'sudoku',name:'스도쿠 마스터',os:'ios',appId:'ca-app-pub-4999376453226791~2158003782'},
] as const;
export type AdmobInventory={os:'android'|'ios';appId:string};
export type AdmobQuery={app:string;days:number;startDate?:string;endDate?:string;country:string;os:string};
export function admobQuery(v:Record<string,unknown>):AdmobQuery{
 if(typeof v.app!=='string'||!SLUG_RE.test(v.app)||!['all','KR','JP','US'].includes(String(v.country))||!['all','android','ios'].includes(String(v.os)))throw Error('invalid_query');
 return {app:v.app,...queryDates(v),country:String(v.country),os:String(v.os)};
}
async function checked(response:Response){
 if(response.ok)return response.json();let code=response.status===403?'permission_denied':response.status===401?'reauthorize':response.status===429?'quota_exceeded':'provider_error';
 if(response.status===403){try{const b=await response.json() as {error?:{details?:{reason?:string}[]}};if(b.error?.details?.some(d=>d.reason==='SERVICE_DISABLED'))code='api_disabled';}catch{}}
 throw Error(code);
}
export async function fetchAdmobAccount(token:string,fetcher:typeof fetch=fetch){
 const v=await checked(await fetcher(`https://admob.googleapis.com/v1/accounts/${admobPublisherId}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)})) as {name?:string;publisherId?:string;reportingTimeZone?:string};
 if(v.name!==`accounts/${admobPublisherId}`||typeof v.reportingTimeZone!=='string')throw Error('invalid_response');return v;
}
function inventoryRows(q:AdmobQuery,inventory?:AdmobInventory[]){
 const rows=(inventory&&inventory.length?inventory:admobApps.filter(a=>a.app===q.app&&(q.os==='all'||a.os===q.os)).map(a=>({os:a.os as 'android'|'ios',appId:a.appId}))).filter(a=>q.os==='all'||a.os===q.os);
 if(!rows.length||rows.some(r=>!ADMOB_APP_ID_RE.test(r.appId)))throw Error('invalid_query');
 return rows;
}
function dateRange(q:AdmobQuery,timeZone:string,now:Date){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const n=(key:string)=>Number(parts.find(p=>p.type===key)?.value);const today=Date.UTC(n('year'),n('month')-1,n('day'));
 const date=(ms:number)=>{const d=new Date(ms);return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};};
 return {startDate:date(q.startDate?dateMillis(q.startDate):today-q.days*86400000),endDate:date(q.endDate?dateMillis(q.endDate):today-86400000)};
}
export function reportBody(q:AdmobQuery,timeZone:string,inventory?:AdmobInventory[],now=new Date()){
 const rows=inventoryRows(q,inventory);
 const dimensionFilters=[{dimension:'APP',matchesAny:{values:rows.map(a=>a.appId)}}];
 if(q.country!=='all')dimensionFilters.push({dimension:'COUNTRY',matchesAny:{values:[q.country]}});
 return {reportSpec:{dateRange:dateRange(q,timeZone,now),dimensions:['DATE','APP','COUNTRY'],metrics:['ESTIMATED_EARNINGS','IMPRESSIONS','CLICKS','AD_REQUESTS','MATCHED_REQUESTS'],dimensionFilters,localizationSettings:{currencyCode:'USD',languageCode:'en-US'},maxReportRows:100000}};
}
export function formatReportBody(q:AdmobQuery,timeZone:string,inventory?:AdmobInventory[],now=new Date()){
 const rows=inventoryRows(q,inventory);
 const dimensionFilters=[{dimension:'APP',matchesAny:{values:rows.map(a=>a.appId)}}];
 if(q.country!=='all')dimensionFilters.push({dimension:'COUNTRY',matchesAny:{values:[q.country]}});
 return {reportSpec:{dateRange:dateRange(q,timeZone,now),dimensions:['FORMAT'],metrics:['ESTIMATED_EARNINGS','IMPRESSIONS','CLICKS','AD_REQUESTS','MATCHED_REQUESTS'],dimensionFilters,localizationSettings:{currencyCode:'USD',languageCode:'en-US'},maxReportRows:1000}};
}
const num=(v:unknown)=>{if(typeof v!=='string'&&typeof v!=='number')throw Error('invalid_response');if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v)))throw Error('invalid_response');return Number(v);};
export function parseAdmobReport(value:unknown,q:AdmobQuery,inventory?:AdmobInventory[]){
 if(!Array.isArray(value)||!value[0]?.header||!value.at(-1)?.footer)throw Error('invalid_response');
 if(value[0].header.localizationSettings?.currencyCode!=='USD')throw Error('invalid_response');
 const rows=inventoryRows(q,inventory);
 const allowed=new Set(rows.map(a=>a.appId));
 let micros=0,impressions=0,clicks=0,adRequests=0,matchedRequests=0;const daily:Record<string,number>={};const byCountry:Record<string,{revenue:number;impressions:number;clicks:number;adRequests:number;matchedRequests:number}>={};let count=0;
 for(const entry of value.slice(1,-1)){const r=entry.row;if(!r)throw Error('invalid_response');if(!allowed.has(r.dimensionValues?.APP?.value))throw Error('invalid_response');const day=r.dimensionValues?.DATE?.value;if(!/^\d{8}$/.test(day||''))throw Error('invalid_response');const country=r.dimensionValues?.COUNTRY?.value;if(typeof country!=='string'||!country)throw Error('invalid_response');if(q.country!=='all'&&country!==q.country)throw Error('invalid_response');
 const m=r.metricValues||{},earned=num(m.ESTIMATED_EARNINGS?.microsValue);const imp=num(m.IMPRESSIONS?.integerValue),clk=num(m.CLICKS?.integerValue),req=num(m.AD_REQUESTS?.integerValue??'0'),matched=num(m.MATCHED_REQUESTS?.integerValue??'0');
 micros+=earned;impressions+=imp;clicks+=clk;adRequests+=req;matchedRequests+=matched;daily[day]=(daily[day]||0)+earned/1e6;
 const bucket=byCountry[country]||(byCountry[country]={revenue:0,impressions:0,clicks:0,adRequests:0,matchedRequests:0});
 bucket.revenue+=earned/1e6;bucket.impressions+=imp;bucket.clicks+=clk;bucket.adRequests+=req;bucket.matchedRequests+=matched;count++;}
 const footer=value.at(-1).footer;const limited=!!footer.warnings?.length||Number(footer.matchingRowCount)>count;
 return {
  app:q.app,revenue:micros/1e6,impressions,clicks,adRequests,matchedRequests,
  matchRate:adRequests?matchedRequests/adRequests:0,showRate:matchedRequests?impressions/matchedRequests:0,
  ecpm:impressions?micros/1e6/impressions*1000:0,ctr:impressions?clicks/impressions:0,currency:'USD',limited,
  daily:Object.entries(daily).sort().map(([date,revenue])=>({date,revenue})),
  countries:Object.entries(byCountry).sort((a,b)=>b[1].revenue-a[1].revenue).map(([country,v])=>({country,...v,ecpm:v.impressions?v.revenue/v.impressions*1000:0,ctr:v.impressions?v.clicks/v.impressions:0})),
  dateRange:value[0].header.dateRange,
 };
}
export function parseFormatReport(value:unknown){
 if(!Array.isArray(value)||!value[0]?.header||!value.at(-1)?.footer)throw Error('invalid_response');
 if(value[0].header.localizationSettings?.currencyCode!=='USD')throw Error('invalid_response');
 const formats:{format:string;revenue:number;impressions:number;clicks:number;adRequests:number;matchedRequests:number;ecpm:number;ctr:number}[]=[];
 for(const entry of value.slice(1,-1)){const r=entry.row;if(!r)throw Error('invalid_response');const format=r.dimensionValues?.FORMAT?.value;if(typeof format!=='string'||!format)throw Error('invalid_response');
  const m=r.metricValues||{},earned=num(m.ESTIMATED_EARNINGS?.microsValue)/1e6,imp=num(m.IMPRESSIONS?.integerValue),clk=num(m.CLICKS?.integerValue),req=num(m.AD_REQUESTS?.integerValue??'0'),matched=num(m.MATCHED_REQUESTS?.integerValue??'0');
  formats.push({format,revenue:earned,impressions:imp,clicks:clk,adRequests:req,matchedRequests:matched,ecpm:imp?earned/imp*1000:0,ctr:imp?clk/imp:0});
 }
 formats.sort((a,b)=>b.revenue-a.revenue);
 return formats;
}
export async function fetchAdmobReport(q:AdmobQuery,token:string,inventory?:AdmobInventory[],fetcher:typeof fetch=fetch){
 const account=await fetchAdmobAccount(token,fetcher);
 const body=reportBody(q,account.reportingTimeZone!,inventory);
 const response=await checked(await fetcher(`https://admob.googleapis.com/v1/accounts/${admobPublisherId}/networkReport:generate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)}));
 const parsed=parseAdmobReport(response,q,inventory);
 let formats:{format:string;revenue:number;impressions:number;clicks:number;adRequests:number;matchedRequests:number;ecpm:number;ctr:number}[]=[];
 try{
  const formatBody=formatReportBody(q,account.reportingTimeZone!,inventory);
  const formatResponse=await checked(await fetcher(`https://admob.googleapis.com/v1/accounts/${admobPublisherId}/networkReport:generate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(formatBody),signal:AbortSignal.timeout(25000)}));
  formats=parseFormatReport(formatResponse);
 }catch{formats=[];}
 return {...parsed,formats,timeZone:account.reportingTimeZone,fetchedAt:new Date().toISOString()};
}
