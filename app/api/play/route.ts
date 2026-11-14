import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {playConnection} from '@/db/schema';
import {envelopeConfig} from '@/lib/ga4-context';
import {unseal} from '@/lib/admob-crypto.mjs';
import {parsePlayQuery,playAccessToken,fetchPlayReport,fetchPlayAcquisitionInstalls,validatePlayAccount,PlayError} from '@/lib/play-core.mts';
import {fetchPlayInstallsLive} from '@/lib/play-gcs.mts';
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
  const toYmd=(s?:string)=>{if(!s)return null;const n=s.replaceAll('-','');return /^\d{8}$/.test(n)?n:null;};
  // Prefer explicit picker range so Overview filters match Play installs.
  const end=toYmd(q.endDate)||ymd(new Date(Date.now()-86400000));
  const start=toYmd(q.startDate)||ymd(new Date(Date.now()-(q.days)*86400000));
  // Load installs from D1/GCS first; reviews/vitals are soft-fail and must not block installs.
  const stored=await loadStoreRange(app.id,'play',start,end);
  const data=await fetchPlayReport(app.androidPkg,token);
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
  let installs:number|null=hasBatch?summary.installs:null;
  let uninstalls:number|null=hasBatch?summary.uninstalls:null;
  let daily=summary.daily.map(d=>({date:d.date,installs:d.installs}));
  let installsSource:string|null=hasBatch?'batch':null;
  let note=hasBatch
   ?'GCS 배치(설치·평점·국가/버전·스토어 성과) + 실시간 리뷰/바이탈'
   :'설치·평점·분해 CSV는 GCS 버킷 연결 후 스토어 배치 실행 시 적재됩니다.';

  if(!hasBatch){
   const api=await fetchPlayAcquisitionInstalls(app.androidPkg,token,start,end);
   if(api){
    installs=api.installs;daily=api.daily;installsSource='reporting_api';
    note='Reporting API 설치(실험) + 실시간 리뷰/바이탈. 국가·평점 분해는 스토어 배치가 필요합니다.';
   }else if(account.gcsBucket){
    try{
     const live=await fetchPlayInstallsLive(account.gcsBucket,app.androidPkg,token,start,end);
     if(live.daily.length){
      installs=live.installs;uninstalls=live.uninstalls;daily=live.daily.map(d=>({date:d.date,installs:d.installs}));
      installsSource='gcs_live';
      note='GCS CSV 실시간 설치(배치 전). 국가·버전·평점 분해는 Connections에서 스토어 배치를 실행하세요.';
     }else{
      note='GCS 버킷은 연결됐지만 설치 CSV가 없거나 기간에 데이터가 없습니다. 버킷 이름·CSV 경로·스토어 배치를 확인하세요.';
     }
    }catch(error){
     // Auth/permission on the bucket should surface; other month-level misses are soft.
     if(error instanceof PlayError&&(error.code==='permission_denied'||error.code==='authentication_failed'))throw error;
     note='GCS 실시간 설치 조회에 실패했습니다. 버킷 이름·서비스 계정 권한을 확인하세요.';
    }
   }else{
    note='Play Reporting API는 설치 수를 제공하지 않습니다. Connections에서 GCS 리포트 버킷을 등록한 뒤 스토어 배치를 실행하세요.';
   }
  }

  return json({status:'success',data:{
   ...data,
   installs,
   uninstalls,
   ratings:summary.ratingAvg!=null?{average:summary.ratingAvg,count:summary.ratingCount||0}:null,
   daily,
   spike:hasBatch?summary.spike:null,
   countries,versions,traffic,perf:perfRows.length?perf:null,
   installsSource,
   note,
  }});
 }catch(error){
  const code=error instanceof PlayError?error.code:(error instanceof Error?error.message:'provider_error');
  const message=({not_configured:'Play 연결이 필요합니다.',permission_denied:'Play Console에서 서비스 계정 권한이 필요합니다.',authentication_failed:'Play 인증에 실패했습니다.',invalid_query:'조회 조건이 올바르지 않습니다.'} as Record<string,string>)[code]||'Play 보고서를 가져오지 못했습니다.';
  return json({status:'error',message,code},error instanceof PlayError?error.status:502);
 }
}
