import {queryDates,dateMillis} from './date-range.mts';
import {ADMOB_APP_ID_RE,SLUG_RE} from './apps.ts';
import {isCountryFilter} from './countries.mts';
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
 if(typeof v.app!=='string'||!SLUG_RE.test(v.app)||!isCountryFilter(v.country)||!['all','android','ios'].includes(String(v.os)))throw Error('invalid_query');
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
export function adUnitReportBody(q:AdmobQuery,timeZone:string,inventory?:AdmobInventory[],now=new Date()){
 const rows=inventoryRows(q,inventory);
 const dimensionFilters=[{dimension:'APP',matchesAny:{values:rows.map(a=>a.appId)}}];
 if(q.country!=='all')dimensionFilters.push({dimension:'COUNTRY',matchesAny:{values:[q.country]}});
 return {reportSpec:{dateRange:dateRange(q,timeZone,now),dimensions:['AD_UNIT','FORMAT'],metrics:['ESTIMATED_EARNINGS','IMPRESSIONS','CLICKS','AD_REQUESTS','MATCHED_REQUESTS'],dimensionFilters,localizationSettings:{currencyCode:'USD',languageCode:'en-US'},maxReportRows:5000}};
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
export type AdUnitRow={adUnitId:string;name:string;format:string;formatLabel:string;revenue:number;impressions:number;clicks:number;adRequests:number;matchedRequests:number;ecpm:number;ctr:number};
const FORMAT_LABELS:Record<string,string>={
 banner:'배너',BANNER:'배너',
 interstitial:'전면',INTERSTITIAL:'전면',
 rewarded:'보상형',REWARDED:'보상형',
 rewarded_interstitial:'보상형 전면',REWARDED_INTERSTITIAL:'보상형 전면',
 native:'네이티브',NATIVE:'네이티브',
 app_open:'앱 오픈',APP_OPEN:'앱 오픈',
 banner_interstitial:'배너/전면(레거시)',BANNER_INTERSTITIAL:'배너/전면(레거시)',
};
export function formatLabel(format:string){
 if(!format||format==='—')return '—';
 return FORMAT_LABELS[format]||FORMAT_LABELS[format.toUpperCase()]||format;
}
function dimValue(dim:unknown):{value:string;label:string|null}{
 const v=dim as {value?:unknown;displayLabel?:unknown}|undefined;
 if(typeof v?.value!=='string'||!v.value)return {value:'',label:null};
 const label=typeof v.displayLabel==='string'&&v.displayLabel.trim()?v.displayLabel.trim():null;
 return {value:v.value,label};
}
export function parseAdUnitReport(value:unknown){
 if(!Array.isArray(value)||!value[0]?.header||!value.at(-1)?.footer)throw Error('invalid_response');
 if(value[0].header.localizationSettings?.currencyCode!=='USD')throw Error('invalid_response');
 const byKey=new Map<string,AdUnitRow>();
 for(const entry of value.slice(1,-1)){
  const r=entry.row;if(!r)throw Error('invalid_response');
  const unit=dimValue(r.dimensionValues?.AD_UNIT);
  if(!unit.value)throw Error('invalid_response');
  const fmt=dimValue(r.dimensionValues?.FORMAT);
  const format=fmt.value||'—';
  const m=r.metricValues||{},earned=num(m.ESTIMATED_EARNINGS?.microsValue)/1e6,imp=num(m.IMPRESSIONS?.integerValue),clk=num(m.CLICKS?.integerValue),req=num(m.AD_REQUESTS?.integerValue??'0'),matched=num(m.MATCHED_REQUESTS?.integerValue??'0');
  const key=`${unit.value}\0${format}`;
  const prev=byKey.get(key);
  if(prev){
   prev.revenue+=earned;prev.impressions+=imp;prev.clicks+=clk;prev.adRequests+=req;prev.matchedRequests+=matched;
   prev.ecpm=prev.impressions?prev.revenue/prev.impressions*1000:0;prev.ctr=prev.impressions?prev.clicks/prev.impressions:0;
   if(unit.label&&prev.name===prev.adUnitId)prev.name=unit.label;
  }else byKey.set(key,{adUnitId:unit.value,name:unit.label||unit.value,format,formatLabel:formatLabel(format),revenue:earned,impressions:imp,clicks:clk,adRequests:req,matchedRequests:matched,ecpm:imp?earned/imp*1000:0,ctr:imp?clk/imp:0});
 }
 return [...byKey.values()].sort((a,b)=>b.revenue-a.revenue);
}
/** Soft-fail map of ad unit id → display name (needs admob.readonly; report displayLabel is preferred). */
export async function fetchAdUnitNames(token:string,fetcher:typeof fetch=fetch){
 const names=new Map<string,string>();
 try{
  let pageToken='';
  for(let i=0;i<10;i++){
   const url=new URL(`https://admob.googleapis.com/v1/accounts/${admobPublisherId}/adUnits`);
   url.searchParams.set('pageSize','1000');
   if(pageToken)url.searchParams.set('pageToken',pageToken);
   const res=await fetcher(url.toString(),{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
   if(!res.ok)break;
   const body=await res.json() as {adUnits?:{adUnitId?:string;displayName?:string;adFormat?:string}[];nextPageToken?:string};
   for(const u of body.adUnits||[]){
    if(typeof u.adUnitId==='string'&&u.adUnitId&&typeof u.displayName==='string'&&u.displayName)names.set(u.adUnitId,u.displayName);
   }
   if(!body.nextPageToken)break;
   pageToken=body.nextPageToken;
  }
 }catch{/* soft-fail */}
 return names;
}
export function applyAdUnitNames(units:AdUnitRow[],names:Map<string,string>){
 return units.map(u=>{
  const named=names.get(u.adUnitId);
  if(named&&(u.name===u.adUnitId||!u.name))return {...u,name:named};
  return u;
 });
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
 let adUnits:AdUnitRow[]=[];
 try{
  const unitBody=adUnitReportBody(q,account.reportingTimeZone!,inventory);
  const unitResponse=await checked(await fetcher(`https://admob.googleapis.com/v1/accounts/${admobPublisherId}/networkReport:generate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(unitBody),signal:AbortSignal.timeout(25000)}));
  adUnits=parseAdUnitReport(unitResponse);
  adUnits=applyAdUnitNames(adUnits,await fetchAdUnitNames(token,fetcher));
 }catch{adUnits=[];}
 return {...parsed,formats,adUnits,timeZone:account.reportingTimeZone,fetchedAt:new Date().toISOString()};
}
