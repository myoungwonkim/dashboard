// User-provided AdMob inventory. Identifiers are not authentication credentials.
export const admobPublisherId='pub-4999376453226791';
export const admobApps=[
 {app:'bazi',name:'읽어주는 만세력',os:'android',appId:'ca-app-pub-4999376453226791~5692726639'},
 {app:'bazi',name:'읽어주는 만세력',os:'ios',appId:'ca-app-pub-4999376453226791~2304842432'},
 {app:'sudoku',name:'스도쿠 마스터',os:'android',appId:'ca-app-pub-4999376453226791~7315994561'},
 {app:'sudoku',name:'스도쿠 마스터',os:'ios',appId:'ca-app-pub-4999376453226791~2158003782'},
] as const;
export type AdmobQuery={app:'bazi'|'sudoku';days:number;country:string;os:string};
export function admobQuery(v:Record<string,unknown>):AdmobQuery{
 if(!['bazi','sudoku'].includes(String(v.app))||![7,14,30].includes(Number(v.days))||!['all','KR','JP','US'].includes(String(v.country))||!['all','android','ios'].includes(String(v.os)))throw Error('invalid_query');
 return {app:v.app as AdmobQuery['app'],days:Number(v.days),country:String(v.country),os:String(v.os)};
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
export function reportBody(q:AdmobQuery,timeZone:string,now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const n=(key:string)=>Number(parts.find(p=>p.type===key)?.value);const today=Date.UTC(n('year'),n('month')-1,n('day'));
 const date=(ms:number)=>{const d=new Date(ms);return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};};
 const dimensionFilters=[{dimension:'APP',matchesAny:{values:admobApps.filter(a=>a.app===q.app&&(q.os==='all'||a.os===q.os)).map(a=>a.appId) as string[]}}];
 if(q.country!=='all')dimensionFilters.push({dimension:'COUNTRY',matchesAny:{values:[q.country]}});
 return {reportSpec:{dateRange:{startDate:date(today-q.days*86400000),endDate:date(today-86400000)},dimensions:['DATE','APP','COUNTRY'],metrics:['ESTIMATED_EARNINGS','IMPRESSIONS','CLICKS'],dimensionFilters,localizationSettings:{currencyCode:'USD',languageCode:'en-US'},maxReportRows:100000}};
}
export function parseAdmobReport(value:unknown,q:AdmobQuery){
 if(!Array.isArray(value)||!value[0]?.header||!value.at(-1)?.footer)throw Error('invalid_response');
 if(value[0].header.localizationSettings?.currencyCode!=='USD')throw Error('invalid_response');
 const allowed=new Set(admobApps.filter(a=>a.app===q.app&&(q.os==='all'||a.os===q.os)).map(a=>a.appId) as string[]);
 let micros=0,impressions=0,clicks=0;const daily:Record<string,number>={};let rows=0;
 const num=(v:unknown)=>{if(typeof v!=='string'&&typeof v!=='number')throw Error('invalid_response');if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v)))throw Error('invalid_response');return Number(v);};
 for(const entry of value.slice(1,-1)){const r=entry.row;if(!r)throw Error('invalid_response');if(!allowed.has(r.dimensionValues?.APP?.value))throw Error('invalid_response');const day=r.dimensionValues?.DATE?.value;if(!/^\d{8}$/.test(day||''))throw Error('invalid_response');if(q.country!=='all'&&r.dimensionValues?.COUNTRY?.value!==q.country)throw Error('invalid_response');
 const m=r.metricValues||{},earned=num(m.ESTIMATED_EARNINGS?.microsValue);micros+=earned;impressions+=num(m.IMPRESSIONS?.integerValue);clicks+=num(m.CLICKS?.integerValue);daily[day]=(daily[day]||0)+earned/1e6;rows++;}
 const footer=value.at(-1).footer;const limited=!!footer.warnings?.length||Number(footer.matchingRowCount)>rows;
 return {app:q.app,revenue:micros/1e6,impressions,clicks,ecpm:impressions?micros/1e6/impressions*1000:0,currency:'USD',limited,daily:Object.entries(daily).sort().map(([date,revenue])=>({date,revenue})),dateRange:value[0].header.dateRange};
}
export async function fetchAdmobReport(q:AdmobQuery,token:string,fetcher:typeof fetch=fetch){
 const account=await fetchAdmobAccount(token,fetcher);const body=reportBody(q,account.reportingTimeZone!);
 const response=await checked(await fetcher(`https://admob.googleapis.com/v1/accounts/${admobPublisherId}/networkReport:generate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)}));
 return {...parseAdmobReport(response,q),timeZone:account.reportingTimeZone,fetchedAt:new Date().toISOString()};
}
