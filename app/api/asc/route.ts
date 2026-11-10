import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {ascConnection} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {unseal} from '@/lib/admob-crypto.mjs';
import {parseAscQuery,validateAscAccount,ascJwt,fetchAscReport,AscError} from '@/lib/asc-core.mts';
import {ensureSeedApps,getApp} from '@/lib/apps-store.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export async function POST(req:Request){
 if(!await getCurrentUser())return json({status:'error',message:'로그인이 필요합니다.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({status:'error',message:'잘못된 요청입니다.'},403);
 try{
  const body=await req.json() as Record<string,unknown>;
  const q=parseAscQuery(body);
  await ensureSeedApps();
  const app=await getApp(q.app);
  if(!app?.appleAppId)return json({status:'error',message:'이 앱에 Apple App ID가 없습니다. 앱 행에 등록해 주세요.'},400);
  const row=await getDb().select().from(ascConnection).get();
  if(!row)return json({status:'error',message:'App Store Connect API 키를 먼저 연결해 주세요.',code:'not_configured'},503);
  const config=envelopeConfig();
  const account=validateAscAccount(await unseal(JSON.parse(row.envelope),JSON.parse(config.privateKey),config.kid,'asc'));
  const token=await ascJwt(account);
  const data=await fetchAscReport(app.appleAppId,token);
  return json({status:'success',data});
 }catch(error){
  const code=error instanceof AscError?error.code:(error instanceof Error?error.message:'provider_error');
  const message=({not_configured:'ASC 연결이 필요합니다.',permission_denied:'App Store Connect 권한이 필요합니다.',authentication_failed:'ASC 인증에 실패했습니다.',not_found:'Apple App ID를 확인해 주세요.',invalid_query:'조회 조건이 올바르지 않습니다.'} as Record<string,string>)[code]||'App Store 보고서를 가져오지 못했습니다.';
  return json({status:'error',message,code},error instanceof AscError?error.status:502);
 }
}
