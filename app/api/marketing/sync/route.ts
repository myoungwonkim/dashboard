import {eq} from 'drizzle-orm';
import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {marketingAccounts} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {unseal} from '@/lib/admob-crypto.mjs';
import {validateGoogleAdsCreds,fetchGoogleAdsDailySpend} from '@/lib/marketing-google.mts';
import {validateMetaAdsCreds,fetchMetaDailySpend} from '@/lib/marketing-meta.mts';
import {upsertMarketingDays,type MarketingDay} from '@/lib/marketing-core.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});

export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return json({message:'로그인이 필요합니다.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({message:'잘못된 요청입니다.'},403);
 try{
  const body=await req.json() as {accountId?:string;startDate?:string;endDate?:string};
  const startDate=body.startDate||'';const endDate=body.endDate||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||startDate>endDate){
   return json({message:'조회 기간(startDate·endDate)이 올바르지 않습니다.'},400);
  }
  const db=getDb();
  const accounts=body.accountId
   ?await db.select().from(marketingAccounts).where(eq(marketingAccounts.id,body.accountId)).all()
   :await db.select().from(marketingAccounts).all();
  if(!accounts.length)return json({message:'동기화할 마케팅 계정이 없습니다.'},400);
  const config=envelopeConfig();
  const results:{id:string;platform:string;rows:number;error?:string}[]=[];
  for(const acc of accounts){
   try{
    const creds=await unseal(JSON.parse(acc.envelope),JSON.parse(config.privateKey),config.kid,'marketing');
    const days:MarketingDay[]=[];
    if(acc.platform==='google_ads'){
     const g=validateGoogleAdsCreds(creds);
     const series=await fetchGoogleAdsDailySpend(g,startDate,endDate);
     for(const d of series)days.push({appId:acc.appId,source:'google_ads',date:d.date,spend:d.spend,currency:'USD',note:acc.label});
    }else if(acc.platform==='meta'){
     const m=validateMetaAdsCreds(creds);
     const series=await fetchMetaDailySpend(m,startDate,endDate);
     for(const d of series)days.push({appId:acc.appId,source:'meta',date:d.date,spend:d.spend,currency:(d.currency||'USD').toUpperCase(),note:acc.label});
    }else{
     results.push({id:acc.id,platform:acc.platform,rows:0,error:'unsupported'});
     continue;
    }
    const n=await upsertMarketingDays(days);
    const now=new Date().toISOString();
    await db.update(marketingAccounts).set({lastSyncAt:now,lastError:null,verifiedAt:now}).where(eq(marketingAccounts.id,acc.id));
    results.push({id:acc.id,platform:acc.platform,rows:n});
   }catch(e){
    const code=e instanceof Error?e.message:'sync_failed';
    const message=({
     google_auth_failed:'Google OAuth 갱신 실패',
     google_ads_permission:'Google Ads 권한 부족',
     google_ads_bad_request:'Google Ads 요청 거부 (개발자 토큰·고객 ID 확인)',
     meta_permission:'Meta 토큰 권한 부족',
     meta_api_error:'Meta API 오류',
    } as Record<string,string>)[code]||code;
    await db.update(marketingAccounts).set({lastError:message}).where(eq(marketingAccounts.id,acc.id));
    results.push({id:acc.id,platform:acc.platform,rows:0,error:message});
   }
  }
  const ok=results.filter(r=>!r.error).length;
  return json({ok:true,results,message:`${ok}/${results.length}개 계정 동기화 · ${results.reduce((s,r)=>s+r.rows,0)}행`});
 }catch{return json({message:'마케팅 동기화에 실패했습니다.'},502);}
}
