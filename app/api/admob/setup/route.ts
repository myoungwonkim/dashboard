import {getDb} from '@/db';
import {admobConnection} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {validateOAuthClient,admobRedirect} from '@/lib/admob-crypto.mjs';
import {admobOwner,admobJson,sameOrigin,decryptSecret,encryptSecret,errorText} from '@/lib/admob-server';
export const dynamic='force-dynamic';
export async function GET(){
 if(!await admobOwner())return admobJson({message:'소유자로 로그인해 주세요.'},403);
 try{const c=envelopeConfig(),row=await getDb().select({id:admobConnection.id,token:admobConnection.tokenEnvelope,verifiedAt:admobConnection.verifiedAt}).from(admobConnection).get();return admobJson({configured:!!row,authorized:!!row?.token,verifiedAt:row?.verifiedAt||null,publicKey:JSON.parse(c.publicKey),kid:c.kid,redirectUri:admobRedirect});}catch{return admobJson({message:'연결 설정을 불러오지 못했습니다.'},503);}
}
export async function POST(req:Request){
 const user=await admobOwner();if(!user||!sameOrigin(req))return admobJson({message:'접근할 수 없습니다.'},403);
 try{
 const body=await req.text();if(body.length>30000)return admobJson({message:'파일이 너무 큽니다.'},413);
 const raw=await decryptSecret(body,'client-upload');const client=validateOAuthClient(raw);
 const result=await getDb().insert(admobConnection).values({id:'primary',ownerId:user.userId,clientEnvelope:await encryptSecret(client,'client'),createdAt:new Date().toISOString()}).onConflictDoNothing().returning({id:admobConnection.id});
 if(!result.length)return admobJson({message:'OAuth 설정은 이미 등록되어 있습니다.'},409);
 return admobJson({configured:true,authorized:false});
 }catch{return admobJson({message:'스도쿠 프로젝트에서 만든 웹 애플리케이션 OAuth JSON인지, 리디렉션 URI가 안내와 일치하는지 확인해 주세요.'},400);}
}
