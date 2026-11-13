import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {ga4Connection} from '@/db/schema';
import {eq} from 'drizzle-orm';
import {envelopeConfig,ga4Credentials} from '@/lib/ga4-context';
import {decryptAccount,expectedEmail} from '@/lib/ga4-envelope.mjs';
import {accessToken,verifyProperties,GAError} from '@/lib/ga4-core.mjs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
async function owner(){const u=await getCurrentUser();return u;}
export async function GET(){
 if(!await owner())return json({message:'대시보드 소유자로 로그인해 주세요.'},403);
 try{const config=envelopeConfig(),row=await getDb().select({createdAt:ga4Connection.createdAt,checks:ga4Connection.checks,checkedAt:ga4Connection.checkedAt}).from(ga4Connection).get();return json({configured:!!row,createdAt:row?.createdAt||null,checks:row?.checks?JSON.parse(row.checks):[],checkedAt:row?.checkedAt||null,publicKey:JSON.parse(config.publicKey),kid:config.kid,email:expectedEmail});}
 catch{return json({message:'연결 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);}
}
export async function POST(req:Request){
 const user=await owner();if(!user)return json({message:'대시보드 소유자로 로그인해 주세요.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({message:'잘못된 요청입니다.'},403);
 let stage='등록 정보';
 try{
 if(Number(req.headers.get('content-length')||0)>30000)return json({message:'파일 크기가 너무 큽니다.'},413);
 const body=await req.text();if(body.length>30000)return json({message:'파일 크기가 너무 큽니다.'},413);
 let input;try{input=JSON.parse(body);}catch{return json({message:'잘못된 요청입니다.'},400);}
 const db=getDb();const row=await db.select({id:ga4Connection.id,createdAt:ga4Connection.createdAt}).from(ga4Connection).get();
 let token:string,createdAt=row?.createdAt;
 if(input?.action==='verify'){
  if(!row)return json({message:'먼저 JSON 키를 등록해 주세요.'},409);
  stage='Google 인증';
  try{const account=await ga4Credentials();token=await accessToken(account.email,account.key);}
  catch(error){
   const code=error instanceof GAError?error.code:'authentication_failed';
   return json({message:`저장된 키로 Google 인증에 실패했습니다 (${code}). JSON 키를 다시 업로드해 교체해 주세요.`,code,canReplace:true},502);
  }
 }else{
  const replace=input?.action==='replace'||!!row;
  const config=envelopeConfig();let account;
  const envelope=input?.envelope&&typeof input.envelope==='object'?input.envelope:input;
  try{account=await decryptAccount(envelope,JSON.parse(config.privateKey),config.kid);}catch{return json({message:`올바른 JSON 키인지 확인해 주세요. client_email은 ${expectedEmail}, project_id는 sudoku-master-8998c 여야 합니다.`},400);}
  stage='Google 인증';token=await accessToken(account.client_email,account.private_key);
  stage='암호화 저장';createdAt=new Date().toISOString();
  const payload={ownerId:user.userId,envelope:JSON.stringify({version:envelope.version,kid:envelope.kid,iv:envelope.iv,wrappedKey:envelope.wrappedKey,ciphertext:envelope.ciphertext}),createdAt};
  if(replace&&row){
   await db.update(ga4Connection).set(payload).where(eq(ga4Connection.id,'primary'));
  }else{
   const saved=await db.insert(ga4Connection).values({id:'primary',...payload}).onConflictDoNothing().returning({id:ga4Connection.id});
   if(!saved.length)return json({message:'이미 키가 등록되어 있습니다. 권한 다시 검사 또는 키 교체를 사용해 주세요.',canReplace:true},409);
  }
 }
 stage='앱별 조회';
 const {ensureSeedApps,listApps}=await import('@/lib/apps-store.mts');
 await ensureSeedApps();
 const registered=await listApps();
 const targets=registered.filter(a=>a.ga4PropertyId).map(a=>({app:a.id,propertyId:a.ga4PropertyId!}));
 if(!targets.length)return json({message:'GA4 속성 ID가 등록된 앱이 없습니다. Connections에서 앱을 먼저 확인해 주세요.'},409);
 const checks=await verifyProperties(token,targets),checkedAt=new Date().toISOString();
 await db.update(ga4Connection).set({checks:JSON.stringify(checks),checkedAt}).where(eq(ga4Connection.id,'primary'));
 // Bounded diagnostic codes only: never log tokens, credentials, or Google response bodies.
 console.info(JSON.stringify({event:'ga4_connection_check',checks,checkedAt}));
 const failed=checks.filter(c=>!c.ok);
 const hint=failed.length?` 실패: ${failed.map(c=>`${c.app}(${c.code})`).join(', ')}.`:'';
 return json({configured:true,createdAt,checks,checkedAt,message:(checks.every(c=>c.ok)?'등록된 앱의 GA4 조회를 확인했습니다.':'키는 저장했습니다. 아래 앱별 검사 결과를 확인해 주세요.')+hint});
 }catch(error){const code=error instanceof GAError?error.code:'internal_error';console.warn(JSON.stringify({event:'ga4_setup_error',stage,code}));const reason=({authentication_failed:'키가 유효한지·폐기되지 않았는지 확인해 주세요.',invalid_credentials:'dashboard-reader@sudoku-master-8998c 서비스 계정 JSON인지 확인해 주세요.',not_configured:'서버 암호화 키(GA4_ENVELOPE_*)가 없습니다. npm run keys 후 Secret을 등록하세요.',quota_exceeded:'잠시 후 다시 시도해 주세요.',api_disabled:'sudoku-master-8998c 프로젝트에서 Analytics Data API를 사용 설정해 주세요.',permission_denied:'GA4 속성에 서비스 계정 뷰어 권한을 추가해 주세요.'} as Record<string,string>)[code];return json({message:`${stage} 단계에서 실패했습니다. ${reason||'잠시 후 연결 상태를 다시 확인해 주세요.'}`,code,canReplace:code==='authentication_failed'||code==='invalid_credentials'},502);}
}
