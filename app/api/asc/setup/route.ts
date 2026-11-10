import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {ascConnection} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {seal,unseal} from '@/lib/admob-crypto.mjs';
import {validateAscAccount,ascJwt,AscError} from '@/lib/asc-core.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export async function GET(){
 if(!await getCurrentUser())return json({message:'로그인이 필요합니다.'},403);
 try{
  const config=envelopeConfig();
  const row=await getDb().select({createdAt:ascConnection.createdAt,verifiedAt:ascConnection.verifiedAt,checks:ascConnection.checks}).from(ascConnection).get();
  return json({configured:!!row,createdAt:row?.createdAt||null,verifiedAt:row?.verifiedAt||null,checks:row?.checks?JSON.parse(row.checks):null,publicKey:JSON.parse(config.publicKey),kid:config.kid});
 }catch{return json({message:'ASC 연결 상태를 불러오지 못했습니다.'},503);}
}
export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return json({message:'로그인이 필요합니다.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({message:'잘못된 요청입니다.'},403);
 try{
  if(Number(req.headers.get('content-length')||0)>40000)return json({message:'입력이 너무 큽니다.'},413);
  const body=await req.text();if(body.length>40000)return json({message:'입력이 너무 큽니다.'},413);
  let input;try{input=JSON.parse(body);}catch{return json({message:'잘못된 요청입니다.'},400);}
  const db=getDb();const existing=await db.select({id:ascConnection.id}).from(ascConnection).get();
  if(existing&&input?.action!=='replace')return json({message:'이미 ASC 키가 등록되어 있습니다.'},409);
  const config=envelopeConfig();
  let account;
  try{
   if(input?.version===1&&input.ciphertext)account=validateAscAccount(await unseal(input,JSON.parse(config.privateKey),config.kid,'asc'));
   else account=validateAscAccount(input.account||input);
  }catch{return json({message:'Issuer ID · Key ID · .p8 형식을 확인해 주세요.'},400);}
  await ascJwt(account);
  const envelope=input?.version===1&&input.ciphertext?{version:input.version,kid:input.kid,iv:input.iv,wrappedKey:input.wrappedKey,ciphertext:input.ciphertext}:await seal(account,JSON.parse(config.publicKey),config.kid,'asc');
  const createdAt=new Date().toISOString();
  if(existing)await db.delete(ascConnection);
  await db.insert(ascConnection).values({id:'primary',ownerId:user.userId,envelope:JSON.stringify(envelope),createdAt,verifiedAt:createdAt,checks:JSON.stringify({jwt:true})});
  return json({configured:true,createdAt,verifiedAt:createdAt,message:'App Store Connect API 키를 암호화 저장했습니다.'});
 }catch(error){
  const code=error instanceof AscError?error.code:'';
  return json({message:code==='invalid_credentials'?'키 재료가 올바르지 않습니다.':'.p8 키 등록에 실패했습니다.'},502);
 }
}
