import {SLUG_RE} from './apps.ts';
export class AscError extends Error { code:string; status:number; constructor(code:string,status=502){super(code);this.code=code;this.status=status;} }
export type AscAccount={issuerId:string;keyId:string;privateKey:string;vendorNumber?:string|null};
export type AscQuery={app:string;days:number};
export function validateAscAccount(input:unknown):AscAccount{
 const v=input as Record<string,unknown>;
 if(!v||typeof v.issuerId!=='string'||!/^[0-9a-fA-F-]{36}$/.test(v.issuerId)||typeof v.keyId!=='string'||!/^[A-Z0-9]{10}$/.test(v.keyId)||typeof v.privateKey!=='string'||!v.privateKey.includes('PRIVATE KEY')||v.privateKey.length>12000)throw new AscError('invalid_credentials',400);
 const vendorNumber=typeof v.vendorNumber==='string'?v.vendorNumber.trim():'';
 if(vendorNumber&&!/^\d{7,10}$/.test(vendorNumber))throw new AscError('invalid_vendor',400);
 return {issuerId:v.issuerId,keyId:v.keyId,privateKey:v.privateKey,vendorNumber:vendorNumber||null};
}
export function parseAscQuery(input:Record<string,unknown>):AscQuery{
 if(typeof input.app!=='string'||!SLUG_RE.test(input.app))throw new AscError('invalid_query',400);
 const days=Number(input.days);if(!Number.isInteger(days)||days<1||days>366)throw new AscError('invalid_query',400);
 return {app:input.app,days};
}
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const encode=(value:unknown)=>b64(new TextEncoder().encode(JSON.stringify(value)));
export async function ascJwt(account:AscAccount,now=Math.floor(Date.now()/1000)){
 try{
  const text=account.privateKey.replaceAll('\\n','\n').replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g,'');
  const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',bytes,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const unsigned=encode({alg:'ES256',kid:account.keyId,typ:'JWT'})+'.'+encode({iss:account.issuerId,iat:now,exp:now+20*60,aud:'appstoreconnect-v1'});
  const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(unsigned)));
  return unsigned+'.'+b64(sig);
 }catch{throw new AscError('invalid_credentials',503);}
}
/** Parse App Store Connect Analytics / Sales tab-separated report rows for units. */
export function parseAscUnitsReport(text:string,skuOrAppleId?:string){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return {downloads:0,daily:[] as {date:string;downloads:number}[]};
 const sep=lines[0].includes('\t')?'\t':',';
 const header=lines[0].split(sep).map(h=>h.trim().replace(/^"|"$/g,''));
 const dateIdx=header.findIndex(h=>/begin date|date/i.test(h));
 const unitsIdx=header.findIndex(h=>/^units$/i.test(h)||/downloads|installs/i.test(h));
 const skuIdx=header.findIndex(h=>/sku|apple identifier|adam id/i.test(h));
 const productTypeIdx=header.findIndex(h=>/product type identifier/i.test(h));
 if(dateIdx<0||unitsIdx<0)throw new AscError('invalid_response');
 let downloads=0;const daily:Record<string,number>={};
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=line.split(sep).map(c=>c.replace(/^"|"$/g,''));
  if(skuOrAppleId&&skuIdx>=0&&cols[skuIdx]&&cols[skuIdx]!==skuOrAppleId)continue;
  // 1, 1F, 1T = iOS app download/redownload-ish product types in sales summary
  if(productTypeIdx>=0){const pt=cols[productTypeIdx];if(pt&&!/^(1|1F|1T|F1|F1F)$/i.test(pt))continue;}
  const raw=cols[dateIdx],units=Number(cols[unitsIdx]);
  if(!raw||!Number.isFinite(units))throw new AscError('invalid_response');
  const date=raw.replaceAll('/','').replaceAll('-','').slice(0,8);
  if(!/^\d{8}$/.test(date))throw new AscError('invalid_response');
  downloads+=units;daily[date]=(daily[date]||0)+units;
 }
 return {downloads,daily:Object.entries(daily).sort().map(([date,downloads])=>({date,downloads}))};
}
export function parseAscApp(body:unknown){
 const v=body as {data?:{id?:string;attributes?:{name?:string;bundleId?:string;sku?:string}}};
 if(!v?.data?.id)throw new AscError('invalid_response');
 return {appleAppId:v.data.id,name:String(v.data.attributes?.name||''),bundleId:String(v.data.attributes?.bundleId||''),sku:String(v.data.attributes?.sku||'')};
}
export function parseAscReviews(body:unknown){
 const v=body as {data?:{id?:string;attributes?:{rating?:number;title?:string;body?:string;reviewerNickname?:string;createdDate?:string}}[]};
 if(!v||!Array.isArray(v.data))throw new AscError('invalid_response');
 return v.data.slice(0,30).map(r=>({
  id:String(r.id||''),
  rating:Number(r.attributes?.rating||0),
  title:String(r.attributes?.title||'').slice(0,200),
  text:String(r.attributes?.body||'').slice(0,500),
  author:String(r.attributes?.reviewerNickname||''),
  at:r.attributes?.createdDate||null,
 })).filter(r=>r.id);
}
export async function fetchAscApp(appleAppId:string,token:string,fetcher:typeof fetch=fetch){
 if(!/^\d+$/.test(appleAppId))throw new AscError('invalid_query',400);
 const res=await fetcher(`https://api.appstoreconnect.apple.com/v1/apps/${appleAppId}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw new AscError(res.status===401?'authentication_failed':res.status===403?'permission_denied':res.status===404?'not_found':'provider_error',res.status===429?429:502);
 return parseAscApp(await res.json());
}
export async function fetchAscReviews(appleAppId:string,token:string,fetcher:typeof fetch=fetch){
 const res=await fetcher(`https://api.appstoreconnect.apple.com/v1/apps/${appleAppId}/customerReviews?limit=25&sort=-createdDate`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
 if(res.status===404||res.status===403)return [];
 if(!res.ok)throw new AscError(res.status===401?'authentication_failed':'provider_error',res.status===429?429:502);
 try{return parseAscReviews(await res.json());}catch{return [];}
}
async function gunzipText(buf:ArrayBuffer){
 const stream=new Response(buf).body?.pipeThrough(new DecompressionStream('gzip'));
 if(!stream)throw new AscError('invalid_response');
 return await new Response(stream).text();
}
function ymdUTC(d:Date){return d.toISOString().slice(0,10);}
export async function fetchAscSalesUnits(vendorNumber:string,token:string,days=14,skuOrAppleId?:string,fetcher:typeof fetch=fetch){
 const daily:Record<string,number>={};let downloads=0;const errors:string[]=[];
 for(let i=1;i<=Math.min(days,30);i++){
  const day=new Date(Date.now()-i*86400000);
  const reportDate=ymdUTC(day);
  const url=new URL('https://api.appstoreconnect.apple.com/v1/salesReports');
  url.searchParams.set('filter[frequency]','DAILY');
  url.searchParams.set('filter[reportDate]',reportDate);
  url.searchParams.set('filter[reportType]','SALES');
  url.searchParams.set('filter[reportSubType]','SUMMARY');
  url.searchParams.set('filter[vendorNumber]',vendorNumber);
  try{
   const res=await fetcher(url.toString(),{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
   if(res.status===404)continue;
   if(!res.ok){errors.push(String(res.status));continue;}
   const text=await gunzipText(await res.arrayBuffer());
   const parsed=parseAscUnitsReport(text,skuOrAppleId);
   for(const row of parsed.daily){daily[row.date]=(daily[row.date]||0)+row.downloads;downloads+=row.downloads;}
  }catch{errors.push(reportDate);}
 }
 return {downloads,daily:Object.entries(daily).sort().map(([date,downloads])=>({date,downloads})),errors};
}
export async function fetchAscReport(appleAppId:string,token:string,opts:{vendorNumber?:string|null;days?:number}={},fetcher:typeof fetch=fetch){
 const app=await fetchAscApp(appleAppId,token,fetcher);
 const reviews=await fetchAscReviews(appleAppId,token,fetcher);
 let downloads:number|null=null;let daily:{date:string;downloads:number}[]=[];
 let note='다운로드는 Vendor Number + Sales Report 배치 후 표시됩니다. 지금은 앱 메타·고객 리뷰를 조회합니다.';
 if(opts.vendorNumber){
  try{
   const sales=await fetchAscSalesUnits(opts.vendorNumber,token,opts.days||14,app.appleAppId,fetcher);
   downloads=sales.downloads;daily=sales.daily;
   note=sales.daily.length?'Sales Report(일) 기준 다운로드입니다.':'Sales Report에 해당 기간 행이 없습니다.';
  }catch{note='Sales Report 조회에 실패했습니다. Vendor Number·권한을 확인해 주세요.';}
 }
 return {
  appleAppId:app.appleAppId,name:app.name,bundleId:app.bundleId,sku:app.sku,
  downloads,daily,reviews,
  crashes:null as number|null,ratings:null as {average:number;count:number}|null,
  source:'live',limited:downloads==null,fetchedAt:new Date().toISOString(),note,
 };
}
