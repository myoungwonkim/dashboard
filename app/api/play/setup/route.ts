import {eq} from 'drizzle-orm';
import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {playConnection} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {seal,unseal} from '@/lib/admob-crypto.mjs';
import {validatePlayAccount,playAccessToken,PlayError} from '@/lib/play-core.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export async function GET(){
 if(!await getCurrentUser())return json({message:'로그인이 필요합니다.'},403);
 try{
  const config=envelopeConfig();
  const row=await getDb().select({createdAt:playConnection.createdAt,verifiedAt:playConnection.verifiedAt,gcsBucket:playConnection.gcsBucket,checks:playConnection.checks}).from(playConnection).get();
  return json({configured:!!row,createdAt:row?.createdAt||null,verifiedAt:row?.verifiedAt||null,gcsBucket:row?.gcsBucket||null,checks:row?.checks?JSON.parse(row.checks):null,publicKey:JSON.parse(config.publicKey),kid:config.kid});
 }catch{return json({message:'Play 연결 상태를 불러오지 못했습니다.'},503);}
}
export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return json({message:'로그인이 필요합니다.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({message:'잘못된 요청입니다.'},403);
 try{
  if(Number(req.headers.get('content-length')||0)>40000)return json({message:'파일 크기가 너무 큽니다.'},413);
  const body=await req.text();if(body.length>40000)return json({message:'파일 크기가 너무 큽니다.'},413);
  let input;try{input=JSON.parse(body);}catch{return json({message:'잘못된 요청입니다.'},400);}
  const db=getDb();const existing=await db.select().from(playConnection).get();
  const config=envelopeConfig();
  if(input?.action==='bucket'){
   if(!existing)return json({message:'Play 키를 먼저 등록해 주세요.'},400);
   let bucket:string|null=null;
   try{bucket=validatePlayAccount(await unseal(JSON.parse(existing.envelope),JSON.parse(config.privateKey),config.kid,'play'),input.gcsBucket).gcsBucket||null;}
   catch{return json({message:'버킷 이름이 올바른지 확인해 주세요. 예: pubsite_prod_rev_…'},400);}
   await db.update(playConnection).set({gcsBucket:bucket}).where(eq(playConnection.id,'primary'));
   return json({configured:true,gcsBucket:bucket,createdAt:existing.createdAt,verifiedAt:existing.verifiedAt,message:bucket?'GCS 버킷을 저장했습니다. 스토어 배치를 실행하세요.':'GCS 버킷을 제거했습니다.'});
  }
  if(existing&&input?.action!=='replace')return json({message:'이미 Play 키가 등록되어 있습니다.'},409);
  let account;
  try{
   if(input?.version===1&&input.ciphertext){
    account=validatePlayAccount(await unseal(input,JSON.parse(config.privateKey),config.kid,'play'),input.gcsBucket);
   }else{
    account=validatePlayAccount(input.account||input,input.gcsBucket);
   }
  }catch{return json({message:'올바른 Play 서비스 계정 JSON인지 확인해 주세요.'},400);}
  await playAccessToken(account.client_email,account.private_key);
  const envelope=input?.version===1&&input.ciphertext?{version:input.version,kid:input.kid,iv:input.iv,wrappedKey:input.wrappedKey,ciphertext:input.ciphertext}:await seal({type:'service_account',client_email:account.client_email,private_key:account.private_key,project_id:account.project_id},JSON.parse(config.publicKey),config.kid,'play');
  const createdAt=new Date().toISOString();
  if(existing)await db.delete(playConnection);
  await db.insert(playConnection).values({id:'primary',ownerId:user.userId,envelope:JSON.stringify(envelope),gcsBucket:account.gcsBucket,createdAt,verifiedAt:createdAt,checks:JSON.stringify({token:true})});
  return json({configured:true,createdAt,verifiedAt:createdAt,gcsBucket:account.gcsBucket,message:'Play 서비스 계정을 암호화 저장하고 토큰을 확인했습니다.'});
 }catch(error){
  const code=error instanceof PlayError?error.code:(error instanceof Error?error.message:'');
  return json({message:code==='authentication_failed'?'서비스 계정 인증에 실패했습니다. Play Console에 초대했는지 확인해 주세요.':'Play 연결에 실패했습니다.'},502);
 }
}
