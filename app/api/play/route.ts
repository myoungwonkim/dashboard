import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {playConnection} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {unseal} from '@/lib/admob-crypto.mjs';
import {parsePlayQuery,playAccessToken,fetchPlayReport,validatePlayAccount,PlayError} from '@/lib/play-core.mts';
import {ensureSeedApps,getApp} from '@/lib/apps-store.mts';
import {aggregateDims,loadStoreDims,loadStorePerf,loadStoreRange,summarizeStoreDays} from '@/lib/store-batch.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
function ymd(d:Date){return d.toISOString().slice(0,10).replaceAll('-','');}
export async function POST(req:Request){
 if(!await getCurrentUser())return json({status:'error',message:'로그인이 필요합니다.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({status:'error',message:'잘못된 요청입니다.'},403);
 try{
  const body=await req.json() as Record<string,unknown>;
  const q=parsePlayQuery(body);
  await ensureSeedApps();
  const app=await getApp(q.app);
  if(!app?.androidPkg)return json({status:'error',message:'이 앱에 Android 패키지명이 없습니다. 앱 행에 등록해 주세요.'},400);
  const row=await getDb().select().from(playConnection).get();
  if(!row)return json({status:'error',message:'Play 서비스 계정을 먼저 연결해 주세요.',code:'not_configured'},503);
  const config=envelopeConfig();
  const account=validatePlayAccount(await unseal(JSON.parse(row.envelope),JSON.parse(config.privateKey),config.kid,'play'),row.gcsBucket);
  const token=await playAccessToken(account.client_email,account.private_key);
  const data=await fetchPlayReport(app.androidPkg,token);
  const end=ymd(new Date(Date.now()-86400000));
  const start=ymd(new Date(Date.now()-(q.days)*86400000));
  const stored=await loadStoreRange(app.id,'play',start,end);
  const summary=summarizeStoreDays(stored);
  const hasBatch=stored.length>0;
  const countries=aggregateDims(await loadStoreDims(app.id,'play','country',start,end));
  const versions=aggregateDims(await loadStoreDims(app.id,'play','app_version',start,end));
  const traffic=aggregateDims(await loadStoreDims(app.id,'play','traffic_source',start,end));
  const perfRows=await loadStorePerf(app.id,'play',start,end);
  const perf={
   visitors:perfRows.reduce((s,r)=>s+(r.storeListingVisitors||0),0),
   acquisitions:perfRows.reduce((s,r)=>s+(r.storeListingAcquisitions||0),0),
   conversionRate:perfRows.length?perfRows.filter(r=>r.conversionRate!=null).slice(-1)[0]?.conversionRate??null:null,
   daily:perfRows.map(r=>({date:r.date,visitors:r.storeListingVisitors||0,acquisitions:r.storeListingAcquisitions||0,conversionRate:r.conversionRate})),
  };
  return json({status:'success',data:{
   ...data,
   installs:hasBatch?summary.installs:null,
   uninstalls:hasBatch?summary.uninstalls:null,
   ratings:summary.ratingAvg!=null?{average:summary.ratingAvg,count:summary.ratingCount||0}:null,
   daily:summary.daily.map(d=>({date:d.date,installs:d.installs})),
   spike:summary.spike,
   countries,versions,traffic,perf:perfRows.length?perf:null,
   note:hasBatch?'GCS 배치(설치·평점·국가/버전·스토어 성과) + 실시간 리뷰/바이탈':'설치·평점·분해 CSV는 GCS 버킷 연결 후 배치 실행 시 적재됩니다.',
  }});
 }catch(error){
  const code=error instanceof PlayError?error.code:(error instanceof Error?error.message:'provider_error');
  const message=({not_configured:'Play 연결이 필요합니다.',permission_denied:'Play Console에서 서비스 계정 권한이 필요합니다.',authentication_failed:'Play 인증에 실패했습니다.',invalid_query:'조회 조건이 올바르지 않습니다.'} as Record<string,string>)[code]||'Play 보고서를 가져오지 못했습니다.';
  return json({status:'error',message,code},error instanceof PlayError?error.status:502);
 }
}
