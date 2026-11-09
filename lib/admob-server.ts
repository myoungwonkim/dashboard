import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {admobConnection} from '@/db/schema';
import {envelopeConfig} from './ga4-context';
import {seal,unseal,admobRedirect,reportScope,siteOrigin,type OAuthClient} from './admob-crypto.mjs';
export const admobJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie','X-Content-Type-Options':'nosniff'}});
export async function admobOwner(){const u=await getCurrentUser();return u;}
export const sameOrigin=(req:Request)=>req.headers.get('origin')===siteOrigin;
export async function encryptSecret(value:unknown,purpose:string){const c=envelopeConfig();return JSON.stringify(await seal(value,JSON.parse(c.publicKey),c.kid,purpose));}
export async function decryptSecret(value:string,purpose:string){const c=envelopeConfig();return unseal(JSON.parse(value),JSON.parse(c.privateKey),c.kid,purpose);}
export async function storedClient(){const row=await getDb().select().from(admobConnection).get();if(!row)throw Error('not_configured');const client=await decryptSecret(row.clientEnvelope,'client') as OAuthClient;return {row,client};}
export async function tokenRequest(params:Record<string,string>){
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(response.status===400?'reauthorize':'google_auth_failed');
 const v=await response.json() as {access_token?:string;refresh_token?:string;scope?:string};
 if(typeof v.access_token!=='string'||!v.access_token)throw Error('google_auth_failed');
 if(v.scope&&!v.scope.split(' ').includes(reportScope))throw Error('scope_missing');return v;
}
export async function admobAccessToken(){const {row,client}=await storedClient();if(!row.tokenEnvelope)throw Error('not_authorized');const tokens=await decryptSecret(row.tokenEnvelope,'token') as {refresh_token:string};return (await tokenRequest({...client,grant_type:'refresh_token',refresh_token:tokens.refresh_token})).access_token!;}
export async function exchangeCode(code:string,verifier:string,client:OAuthClient){return tokenRequest({...client,grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:admobRedirect});}
export const errorText=(error:unknown)=>({not_configured:'먼저 AdMob OAuth 설정 파일을 등록해 주세요.',not_authorized:'Google 계정의 보고서 읽기 승인이 필요합니다.',reauthorize:'Google 승인을 다시 진행해 주세요. 테스트 모드에서는 승인이 만료될 수 있습니다.',scope_missing:'AdMob 보고서 읽기 권한을 허용해 주세요.',api_disabled:'스도쿠 프로젝트에서 AdMob API를 사용 설정해 주세요.',permission_denied:'이 게시자 계정에 접근할 수 있는 Google 계정으로 승인해 주세요.',quota_exceeded:'조회 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',invalid_query:'조회 조건이 올바르지 않습니다.'} as Record<string,string>)[error instanceof Error?error.message:'']||'AdMob 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
