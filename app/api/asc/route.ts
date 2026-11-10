import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {ascConnection} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {unseal} from '@/lib/admob-crypto.mjs';
import {parseAscQuery,validateAscAccount,ascJwt,fetchAscReport,AscError} from '@/lib/asc-core.mts';
import {ensureSeedApps,getApp} from '@/lib/apps-store.mts';
import {loadStorePerf,loadStoreRange,summarizeStoreDays} from '@/lib/store-batch.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
function ymd(d:Date){return d.toISOString().slice(0,10).replaceAll('-','');}
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
  const data=await fetchAscReport(app.appleAppId,token,{vendorNumber:account.vendorNumber,days:Math.min(q.days,14)});
  const end=ymd(new Date(Date.now()-86400000));
  const start=ymd(new Date(Date.now()-(q.days)*86400000));
  const stored=await loadStoreRange(app.id,'asc',start,end);
  const summary=summarizeStoreDays(stored);
  const hasBatch=stored.length>0;
  const perfRows=await loadStorePerf(app.id,'asc',start,end);
  const perf=perfRows.length?{
   visitors:perfRows.reduce((s,r)=>s+(r.storeListingVisitors||0),0),
   acquisitions:perfRows.reduce((s,r)=>s+(r.storeListingAcquisitions||0),0),
   conversionRate:perfRows.filter(r=>r.conversionRate!=null).slice(-1)[0]?.conversionRate??null,
   daily:perfRows.map(r=>({date:r.date,visitors:r.storeListingVisitors||0,acquisitions:r.storeListingAcquisitions||0,conversionRate:r.conversionRate})),
  }:null;
  return json({status:'success',data:{
   ...data,
   downloads:hasBatch?summary.installs:(data.downloads??null),
   daily:hasBatch?summary.daily.map(d=>({date:d.date,downloads:d.installs})):(data.daily||[]),
   spike:summary.spike,
   perf,
   note:hasBatch?'배치(Sales/Analytics) 다운로드·전환 + 실시간 리뷰':data.note,
   limited:!hasBatch&&data.downloads==null,
  }});
 }catch(error){
  const code=error instanceof AscError?error.code:(error instanceof Error?error.message:'provider_error');
  const message=({not_configured:'ASC 연결이 필요합니다.',permission_denied:'App Store Connect 권한이 필요합니다.',authentication_failed:'ASC 인증에 실패했습니다.',not_found:'Apple App ID를 확인해 주세요.',invalid_query:'조회 조건이 올바르지 않습니다.'} as Record<string,string>)[code]||'App Store 보고서를 가져오지 못했습니다.';
  return json({status:'error',message,code},error instanceof AscError?error.status:502);
 }
}
