import {SLUG_RE} from './apps.ts';
export type PlayQuery={app:string;days:number;startDate?:string;endDate?:string};
export class PlayError extends Error { code:string; status:number; constructor(code:string,status=502){super(code);this.code=code;this.status=status;} }
export type PlayAccount={type:'service_account';client_email:string;private_key:string;project_id?:string;gcsBucket?:string|null};
export function validatePlayAccount(input:unknown,gcsBucket?:string|null):PlayAccount{
 const v=input as Record<string,unknown>;
 if(!v||v.type!=='service_account'||typeof v.client_email!=='string'||!v.client_email.endsWith('.gserviceaccount.com')||typeof v.private_key!=='string'||!v.private_key.includes('PRIVATE KEY')||v.private_key.length>16000)throw new PlayError('invalid_credentials',400);
 const bucket=typeof gcsBucket==='string'?gcsBucket.trim():(typeof v.gcsBucket==='string'?v.gcsBucket.trim():'');
 if(bucket&&!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucket))throw new PlayError('invalid_bucket',400);
 return {type:'service_account',client_email:v.client_email,private_key:v.private_key,project_id:typeof v.project_id==='string'?v.project_id:undefined,gcsBucket:bucket||null};
}
export function parsePlayQuery(input:Record<string,unknown>):PlayQuery{
 if(typeof input.app!=='string'||!SLUG_RE.test(input.app))throw new PlayError('invalid_query',400);
 const days=Number(input.days);if(!Number.isInteger(days)||days<1||days>366)throw new PlayError('invalid_query',400);
 return {app:input.app,days,startDate:typeof input.startDate==='string'?input.startDate:undefined,endDate:typeof input.endDate==='string'?input.endDate:undefined};
}
function splitCsvLine(line:string){
 const cols:string[]=[];let cur='',inQuotes=false;
 for(let i=0;i<line.length;i++){
  const ch=line[i];
  if(inQuotes){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"')inQuotes=false;else cur+=ch;}
  else if(ch==='"')inQuotes=true;else if(ch===','){cols.push(cur);cur='';}else cur+=ch;
 }
 cols.push(cur);return cols;
}
/** Parse Play Console install statistics CSV (Date, Package Name, Daily Device Installs, …). */
export function parseInstallCsv(text:string,packageName:string){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return {daily:[],installs:0};
 const header=splitCsvLine(lines[0]).map(h=>h.trim());
 const dateIdx=header.findIndex(h=>/^date$/i.test(h));
 const pkgIdx=header.findIndex(h=>/package/i.test(h));
 const installIdx=header.findIndex(h=>/daily device installs/i.test(h)||/^installs$/i.test(h));
 if(dateIdx<0||installIdx<0)throw new PlayError('invalid_response');
 let installs=0;const daily:{date:string;installs:number}[]=[];
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=splitCsvLine(line);
  if(pkgIdx>=0&&cols[pkgIdx]&&cols[pkgIdx]!==packageName)continue;
  const rawDate=cols[dateIdx],count=Number(cols[installIdx]);
  if(!rawDate||!Number.isFinite(count))throw new PlayError('invalid_response');
  const date=rawDate.replaceAll('-','').slice(0,8);
  if(!/^\d{8}$/.test(date))throw new PlayError('invalid_response');
  installs+=count;daily.push({date,installs:count});
 }
 daily.sort((a,b)=>a.date.localeCompare(b.date));
 return {daily,installs};
}
export function parseReviews(body:unknown){
 const v=body as {reviews?:{reviewId?:string;authorName?:string;comments?:{userComment?:{text?:string;starRating?:number;lastModified?:{seconds?:string}}}[]}[]};
 if(!v||!Array.isArray(v.reviews))throw new PlayError('invalid_response');
 return v.reviews.slice(0,20).map(r=>{
  const c=r.comments?.[0]?.userComment;
  return {id:String(r.reviewId||''),author:String(r.authorName||''),rating:Number(c?.starRating||0),text:String(c?.text||'').slice(0,500),at:c?.lastModified?.seconds?new Date(Number(c.lastModified.seconds)*1000).toISOString():null};
 }).filter(r=>r.id);
}
export function parseVitals(body:unknown){
 const v=body as {rows?:{metrics?:{crashRate?:{decimalValue?:string};anrRate?:{decimalValue?:string};userPerceivedAnrRate?:{decimalValue?:string}}}[]};
 if(!v||!Array.isArray(v.rows))throw new PlayError('invalid_response');
 const row=v.rows[0]?.metrics||{};
 const crash=Number(row.crashRate?.decimalValue||0),anr=Number(row.anrRate?.decimalValue||row.userPerceivedAnrRate?.decimalValue||0);
 return {crashRate:crash,anrRate:anr,crashFreeRate:Math.max(0,1-crash)};
}
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const encode=(value:unknown)=>b64(new TextEncoder().encode(JSON.stringify(value)));
export async function playAccessToken(email:string,keyPem:string,fetcher:typeof fetch=fetch){
 if(!email||!keyPem)throw new PlayError('not_configured',503);
 let jwt:string;
 try{
  const text=keyPem.replaceAll('\\n','\n').replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g,'');
  const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const now=Math.floor(Date.now()/1000);
  const scope='https://www.googleapis.com/auth/playdeveloperreporting https://www.googleapis.com/auth/androidpublisher https://www.googleapis.com/auth/devstorage.read_only';
  const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:email,scope,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  jwt=unsigned+'.'+b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned))));
 }catch{throw new PlayError('invalid_credentials',503);}
 const res=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw new PlayError(res.status===429?'quota_exceeded':'authentication_failed',res.status===429?429:502);
 const value=await res.json() as {access_token?:unknown};if(typeof value.access_token!=='string'||!value.access_token)throw new PlayError('authentication_failed');return value.access_token;
}
export async function fetchPlayReport(packageName:string,token:string,fetcher:typeof fetch=fetch){
 if(!packageName||!/^[a-zA-Z][\w.]*$/.test(packageName))throw new PlayError('invalid_query',400);
 const reviewsRes=await fetcher(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/reviews?maxResults=20`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
 let reviews:{id:string;author:string;rating:number;text:string;at:string|null}[]=[];
 if(reviewsRes.ok){try{reviews=parseReviews(await reviewsRes.json());}catch{reviews=[];}}
 else if(reviewsRes.status===401)throw new PlayError('authentication_failed');
 else if(reviewsRes.status===403)throw new PlayError('permission_denied');
 // Vitals (crash/ANR) via Developer Reporting API — soft-fail if not enabled.
 let vitals:{crashRate:number;anrRate:number;crashFreeRate:number}|null=null;
 try{
  const vitalsRes=await fetcher(`https://playdeveloperreporting.googleapis.com/v1beta1/apps/${encodeURIComponent(packageName)}/crashRateMetricSet:query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({timelineSpec:{aggregationPeriod:'THIRTY_DAYS',startTime:{year:2020,month:1,day:1},endTime:{year:2099,month:1,day:1}},metrics:['crashRate','userPerceivedAnrRate']}),signal:AbortSignal.timeout(15000)});
  if(vitalsRes.ok)vitals=parseVitals(await vitalsRes.json());
 }catch{vitals=null;}
 return {packageName,installs:null as number|null,daily:[] as {date:string;installs:number}[],reviews,vitals,ratings:null as {average:number;count:number}|null,source:'live',limited:!vitals,fetchedAt:new Date().toISOString(),note:'설치·평점 CSV는 GCS 버킷 연결 후 배치로 적재합니다.'};
}
