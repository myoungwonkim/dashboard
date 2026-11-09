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
  stage='Google 인증';const account=await ga4Credentials();token=await accessToken(account.email,account.key);
 }else{
  if(row)return json({message:'이미 키가 등록되어 있습니다. 권한 다시 검사를 눌러 주세요.'},409);
  const config=envelopeConfig();let account;
  try{account=await decryptAccount(input,JSON.parse(config.privateKey),config.kid);}catch{return json({message:'올바른 JSON 키인지 확인하고 페이지를 새로고침해 주세요.'},400);}
  stage='Google 인증';token=await accessToken(account.client_email,account.private_key);
  stage='암호화 저장';createdAt=new Date().toISOString();
  const saved=await db.insert(ga4Connection).values({id:'primary',ownerId:user.userId,envelope:JSON.stringify({version:input.version,kid:input.kid,iv:input.iv,wrappedKey:input.wrappedKey,ciphertext:input.ciphertext}),createdAt}).onConflictDoNothing().returning({id:ga4Connection.id});
  if(!saved.length)return json({message:'이미 키가 등록되어 있습니다. 권한 다시 검사를 눌러 주세요.'},409);
 }
 stage='앱별 조회';const checks=await verifyProperties(token),checkedAt=new Date().toISOString();
 await db.update(ga4Connection).set({checks:JSON.stringify(checks),checkedAt}).where(eq(ga4Connection.id,'primary'));
 // Bounded diagnostic codes only: never log tokens, credentials, or Google response bodies.
 console.info(JSON.stringify({event:'ga4_connection_check',checks,checkedAt}));
 return json({configured:true,createdAt,checks,checkedAt,message:checks.every(c=>c.ok)?'두 앱의 GA4 조회를 확인했습니다.':'키는 암호화 저장했습니다. 아래 앱별 검사 결과를 확인해 주세요.'});
 }catch(error){const code=error instanceof GAError?error.code:'internal_error';console.warn(JSON.stringify({event:'ga4_setup_error',stage,code}));const reason=({authentication_failed:'키가 유효한지 확인해 주세요.',invalid_credentials:'올바른 서비스 계정 JSON 키를 선택해 주세요.',quota_exceeded:'잠시 후 다시 시도해 주세요.'} as Record<string,string>)[code];return json({message:`${stage} 단계에서 실패했습니다. ${reason||'잠시 후 연결 상태를 다시 확인해 주세요.'}`},502);}
}
