import {eq} from 'drizzle-orm';
import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {marketingAccounts} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {seal,unseal} from '@/lib/admob-crypto.mjs';
import {validateGoogleAdsCreds} from '@/lib/marketing-google.mts';
import {validateMetaAdsCreds,normalizeAdAccountId} from '@/lib/marketing-meta.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});

export async function GET(){
 if(!await getCurrentUser())return json({message:'로그인이 필요합니다.'},403);
 try{
  const config=envelopeConfig();
  const rows=await getDb().select({
   id:marketingAccounts.id,platform:marketingAccounts.platform,label:marketingAccounts.label,
   appId:marketingAccounts.appId,externalId:marketingAccounts.externalId,
   createdAt:marketingAccounts.createdAt,verifiedAt:marketingAccounts.verifiedAt,
   lastSyncAt:marketingAccounts.lastSyncAt,lastError:marketingAccounts.lastError,
  }).from(marketingAccounts).all();
  return json({accounts:rows,publicKey:JSON.parse(config.publicKey),kid:config.kid});
 }catch{return json({message:'마케팅 연결 상태를 불러오지 못했습니다.'},503);}
}

export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return json({message:'로그인이 필요합니다.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({message:'잘못된 요청입니다.'},403);
 try{
  const body=await req.json() as Record<string,unknown>;
  const db=getDb();
  if(body.action==='delete'){
   const id=String(body.id||'');
   if(!id)return json({message:'계정 id가 필요합니다.'},400);
   await db.delete(marketingAccounts).where(eq(marketingAccounts.id,id));
   return json({ok:true,message:'계정을 삭제했습니다.'});
  }
  const platform=String(body.platform||'');
  const label=String(body.label||'').trim()||(platform==='google_ads'?'Google Ads':'Meta Ads');
  const appId=String(body.appId||'').trim();
  if(!appId)return json({message:'비용을 귀속할 앱을 선택하세요.'},400);
  const config=envelopeConfig();
  let creds:unknown;let externalId='';
  if(body.version===1&&body.ciphertext){
   creds=await unseal(body,JSON.parse(config.privateKey),config.kid,'marketing');
  }else{
   creds=body.creds||body;
  }
  if(platform==='google_ads'){
   const g=validateGoogleAdsCreds(creds);
   externalId=g.customer_id;
   creds=g;
  }else if(platform==='meta'){
   const m=validateMetaAdsCreds(creds);
   externalId=normalizeAdAccountId(m.ad_account_id);
   creds=m;
  }else return json({message:'platform은 google_ads 또는 meta 입니다.'},400);

  const id=String(body.id||`${platform}_${externalId}_${appId}`).slice(0,80);
  const envelope=body.version===1&&body.ciphertext
   ?{version:body.version,kid:body.kid,iv:body.iv,wrappedKey:body.wrappedKey,ciphertext:body.ciphertext}
   :await seal(creds,JSON.parse(config.publicKey),config.kid,'marketing');
  const now=new Date().toISOString();
  const existing=await db.select().from(marketingAccounts).where(eq(marketingAccounts.id,id)).get();
  if(existing){
   await db.update(marketingAccounts).set({
    platform,label,appId,externalId,envelope:JSON.stringify(envelope),verifiedAt:now,lastError:null,
   }).where(eq(marketingAccounts.id,id));
  }else{
   await db.insert(marketingAccounts).values({
    id,platform,label,appId,externalId,envelope:JSON.stringify(envelope),createdAt:now,verifiedAt:now,
   });
  }
  return json({ok:true,id,message:`${label} 계정을 저장했습니다. 「동기화」로 일별 비용을 가져오세요.`});
 }catch(e){
  const msg=e instanceof Error?e.message:'';
  if(msg==='invalid_google_ads')return json({message:'Google Ads 항목(client_id·secret·refresh_token·developer_token·customer_id)을 확인해 주세요.'},400);
  if(msg==='invalid_meta')return json({message:'Meta access_token과 ad_account_id를 확인해 주세요.'},400);
  return json({message:'마케팅 계정 저장에 실패했습니다.'},502);
 }
}
