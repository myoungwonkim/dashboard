import {SLUG_RE} from './apps.ts';
export class AscError extends Error { code:string; status:number; constructor(code:string,status=502){super(code);this.code=code;this.status=status;} }
export type AscAccount={issuerId:string;keyId:string;privateKey:string};
export type AscQuery={app:string;days:number};
export function validateAscAccount(input:unknown):AscAccount{
 const v=input as Record<string,unknown>;
 if(!v||typeof v.issuerId!=='string'||!/^[0-9a-fA-F-]{36}$/.test(v.issuerId)||typeof v.keyId!=='string'||!/^[A-Z0-9]{10}$/.test(v.keyId)||typeof v.privateKey!=='string'||!v.privateKey.includes('PRIVATE KEY')||v.privateKey.length>12000)throw new AscError('invalid_credentials',400);
 return {issuerId:v.issuerId,keyId:v.keyId,privateKey:v.privateKey};
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
export function parseAscUnitsReport(text:string){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return {downloads:0,daily:[] as {date:string;downloads:number}[]};
 const sep=lines[0].includes('\t')?'\t':',';
 const header=lines[0].split(sep).map(h=>h.trim().replace(/^"|"$/g,''));
 const dateIdx=header.findIndex(h=>/begin date|date/i.test(h));
 const unitsIdx=header.findIndex(h=>/units|downloads|installs/i.test(h));
 if(dateIdx<0||unitsIdx<0)throw new AscError('invalid_response');
 let downloads=0;const daily:Record<string,number>={};
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=line.split(sep).map(c=>c.replace(/^"|"$/g,''));
  const raw=cols[dateIdx],units=Number(cols[unitsIdx]);
  if(!raw||!Number.isFinite(units))throw new AscError('invalid_response');
  const date=raw.replaceAll('/','').replaceAll('-','').slice(0,8);
  if(!/^\d{8}$/.test(date))throw new AscError('invalid_response');
  downloads+=units;daily[date]=(daily[date]||0)+units;
 }
 return {downloads,daily:Object.entries(daily).sort().map(([date,downloads])=>({date,downloads}))};
}
export function parseAscApp(body:unknown){
 const v=body as {data?:{id?:string;attributes?:{name?:string;bundleId?:string}}};
 if(!v?.data?.id)throw new AscError('invalid_response');
 return {appleAppId:v.data.id,name:String(v.data.attributes?.name||''),bundleId:String(v.data.attributes?.bundleId||'')};
}
export async function fetchAscApp(appleAppId:string,token:string,fetcher:typeof fetch=fetch){
 if(!/^\d+$/.test(appleAppId))throw new AscError('invalid_query',400);
 const res=await fetcher(`https://api.appstoreconnect.apple.com/v1/apps/${appleAppId}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw new AscError(res.status===401?'authentication_failed':res.status===403?'permission_denied':res.status===404?'not_found':'provider_error',res.status===429?429:502);
 return parseAscApp(await res.json());
}
export async function fetchAscReport(appleAppId:string,token:string,fetcher:typeof fetch=fetch){
 const app=await fetchAscApp(appleAppId,token,fetcher);
 return {
  appleAppId:app.appleAppId,name:app.name,bundleId:app.bundleId,
  downloads:null as number|null,daily:[] as {date:string;downloads:number}[],
  crashes:null as number|null,ratings:null as {average:number;count:number}|null,
  source:'live',limited:true,fetchedAt:new Date().toISOString(),
  note:'다운로드·크래시 Analytics 리포트는 ASC 리포트 구독 후 배치로 적재합니다. 지금은 앱 메타 검증만 수행합니다.',
 };
}
