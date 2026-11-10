import {getCurrentUser} from '@/worker/identity';
import {ga4Credentials} from '@/lib/ga4-context';
import {GAError,parseQuery,accessToken,fetchReport} from '@/lib/ga4-core.mjs';
import {ensureSeedApps,getApp} from '@/lib/apps-store.mts';
export const dynamic='force-dynamic';
const messages:Record<string,string>={api_disabled:'스도쿠 Google Cloud 프로젝트에서 Google Analytics Data API를 사용 설정해 주세요.',scope_insufficient:'Analytics 읽기 인증 범위를 확인해 주세요.',not_configured:'서버 인증 정보가 아직 설정되지 않았습니다.',invalid_credentials:'서버 인증 설정을 확인해 주세요.',authentication_failed:'Google 인증에 실패했습니다.',permission_denied:'GA4 속성의 읽기 권한 또는 Data API 사용 설정을 확인해 주세요.',quota_exceeded:'조회 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',provider_error:'GA4 조회에 실패했습니다.',invalid_response:'GA4 응답을 확인하지 못했습니다.',invalid_query:'조회 조건이 올바르지 않습니다.',network_error:'네트워크 연결 또는 응답 시간을 확인해 주세요.',app_missing:'등록된 앱이 아니거나 GA4 속성이 없습니다.'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function POST(req:Request){
 const user=await getCurrentUser();
 if(!user)return json({status:'error',code:'login_required',message:'로그인이 필요합니다.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({status:'error',code:'invalid_origin'},403);
 try{
 if(Number(req.headers.get('content-length')||0)>2048)throw new GAError('invalid_query',400);
 const text=await req.text();if(text.length>2048)throw new GAError('invalid_query',400);
 let input:Record<string,unknown>;try{input=JSON.parse(text);if(!input||typeof input!=='object'||Array.isArray(input))throw 0;}catch{throw new GAError('invalid_query',400);}
 const q=parseQuery(input);
 await ensureSeedApps();
 const app=await getApp(q.app);
 if(!app||app.status!=='active'||!app.ga4PropertyId)throw new GAError('app_missing',400);
 const credentials=await ga4Credentials();
 const token=await accessToken(credentials.email,credentials.key);
 return json({status:'success',data:await fetchReport(q,token,app.ga4PropertyId)});
 }catch(error){const code=error instanceof GAError?error.code:'network_error';return json({status:'error',code,message:messages[code]||messages.provider_error},error instanceof GAError?error.status:502);}
}
