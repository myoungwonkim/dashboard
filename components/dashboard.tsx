import DateRangePicker from './date-range-picker';
import {presetRange,validateRange} from '@/lib/date-range.mts';
import {COUNTRY_OPTIONS} from '@/lib/countries.mts';
import {useEffect,useMemo,useState} from 'react';
import Link from '@/client/navigation';
import {useRouter} from '@/client/navigation';
import {ArrowUpRight,Check,ChevronDown,ChevronRight,RefreshCw} from 'lucide-react';
import {type AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import AppIcon from './app-icon';
import GA4Live from './ga4-live';
import AdmobLive from './admob-live';
import StoreLive from './store-live';
import MarketingLive from './marketing-live';
import OverviewCombined from './overview-combined';
import ConnectionsPage from './connections-page';
import PagePicker from './page-picker';
import {adArpu,fmtUsd} from '@/lib/arpu.mts';
const tasks=[
['화면 구조와 디자인 확정','완료','B 앱 비교형 메인 / C 서비스별 분석형 앱 상세. 흑백·회색 중심.'],
['메인과 앱별 상세 페이지','완료','앱 레지스트리 기반 동적 주소, 상단 풀다운으로 이동.'],
['기간·국가·OS 필터','완료','실제 GA4·AdMob 조회에 적용. 데이터가 없으면 조회 결과에 따라 표시.'],
['앱 레지스트리·추가 마법사','완료','D1 앱 목록, Connections에서 앱 추가·수정, 부분 연결 허용.'],
['GA4 인증 등록 화면','완료','브라우저 암호화, 서버 보관, 등록 앱 속성 검증.'],
['GA4 서버 조회 구현','완료','서비스 계정 인증, 앱별 속성, 국가·OS 필터, DAU 분리.'],
['GA4·AdMob 일별 추세','완료','이미 조회하던 daily 시리즈를 차트와 CTR로 표시.'],
['GA4·AdMob 심화 지표','완료','newUsers·참여·firstUser·국가·버전·Crash-free·요청/매칭·포맷.'],
['AdMob 광고 수익 연동','코드 완료','조회·차트 코드는 배포됨. Google OAuth 승인 후 수익 수치가 채워집니다.'],
['Play / App Store 연동','완료','키 연결·리뷰 실시간·GCS/Sales 배치 적재·일별 차트.'],
['스토어 분해·전환·급변','완료','국가/버전/트래픽·store performance·ASC Analytics ONGOING·급변 배지.'],
['AppsFlyer 유입 연동','제외','무료 Zero — API 수집 없음. 앱 ID 메타만 보관.'],
['원본 콘솔 수치 대조','대기','동일 기간·시간대·통화·OS 기준으로 실제 수치 검증.']];

type Ga4Row={activeUsers:number;averageDau:number;sessions:number;events:number;newUsers?:number};
type AdmobRow={revenue:number;impressions:number;clicks:number;ecpm:number;ctr:number;matchRate?:number};
type StoreRow={playInstalls?:number|null;ascDownloads?:number|null;playSource?:string|null;playNote?:string|null};
type PlaySetupState={configured:boolean;gcsBucket:string|null;verifiedAt:string|null};

export default function Dashboard({page}:{page:string}){
 const router=useRouter();
 const [apps,setApps]=useState<AppRecord[]>([]);
 const [appsLoaded,setAppsLoaded]=useState(false);
 const [appsError,setAppsError]=useState('');
 const [appsRetry,setAppsRetry]=useState(0);
 const [ga4Verified,setGa4Verified]=useState(false),[admobVerified,setAdmobVerified]=useState(false);
 const [playSetup,setPlaySetup]=useState<PlaySetupState|null>(null);
 const [showForm,setShowForm]=useState(false);
 const [editing,setEditing]=useState<AppRecord|null>(null);
 const [showNotices,setShowNotices]=useState(false);
 const [refreshing,setRefreshing]=useState(false);
 type CompareRow={ga4?:Ga4Row;admob?:AdmobRow;store?:StoreRow;spend?:number;ga4Error?:string;admobError?:string;playError?:string;playCode?:string};
 const [compare,setCompare]=useState<Record<string,CompareRow>>({});
 useEffect(()=>{
  setAppsError('');
  fetch('/api/apps',{cache:'no-store'}).then(async r=>{
   if(!r.ok){setAppsError(r.status===401?'로그인이 필요합니다.':'앱 목록을 불러오지 못했습니다.');setApps([]);return;}
   const v=await r.json() as {apps?:AppRecord[];message?:string};
   setApps(v.apps||[]);
  }).catch(()=>{setAppsError('앱 목록을 불러오지 못했습니다.');setApps([]);}).finally(()=>setAppsLoaded(true));
 },[appsRetry]);
 useEffect(()=>{fetch('/api/admob/setup',{cache:'no-store'}).then(async r=>{if(r.ok){const v=await r.json() as {verifiedAt:string|null};setAdmobVerified(!!v.verifiedAt);}}).catch(()=>{});},[]);
 useEffect(()=>{fetch('/api/ga4/setup',{cache:'no-store'}).then(async r=>{if(!r.ok)return;const v=await r.json() as {configured:boolean,checks?:{ok:boolean}[]};setGa4Verified(!!v.checks?.some(c=>c.ok));}).catch(()=>{});},[]);
 useEffect(()=>{fetch('/api/play/setup',{cache:'no-store'}).then(async r=>{if(!r.ok)return;const v=await r.json() as PlaySetupState;setPlaySetup({configured:!!v.configured,gcsBucket:v.gcsBucket||null,verifiedAt:v.verifiedAt||null});}).catch(()=>{});},[]);
 const [dateRange,setDateRange]=useState(()=>presetRange('7'));
 const days=validateRange(dateRange.startDate,dateRange.endDate).days;
 const [country,setCountry]=useState('all'),[os,setOs]=useState('all');
 const current=apps.find(a=>a.id===page);
 const report=page==='overview'||!!current;
 const title=current?.name||({overview:'서비스 현황',progress:'진행상황',connections:'데이터 연결'} as Record<string,string>)[page]||page;
 const codeDone=11+Number(ga4Verified);
 const doneBase=codeDone+Number(admobVerified);
 const progressLabel=`진행상황 ${doneBase}/13`;
 const needsSetup=!ga4Verified||!admobVerified||apps.some(a=>!a.androidPkg)||!playSetup?.gcsBucket;
 const overviewGa4Errors=apps.map(a=>compare[a.id]?.ga4Error?`${a.name}: ${compare[a.id]!.ga4Error}`:'').filter(Boolean);
 const playInstallGap=apps.some(a=>a.androidPkg&&compare[a.id]?.store&&compare[a.id]!.store!.playInstalls==null);
 const totals=useMemo(()=>{
  let dau=0,play=0,rev=0,users=0,spend=0,dauN=0,playN=0,revN=0,userN=0,spendN=0;
  for(const a of apps){
   const row=compare[a.id];
   if(row?.ga4){dau+=row.ga4.averageDau;dauN++;users+=row.ga4.activeUsers;userN++;}
   if(row?.store?.playInstalls!=null){play+=row.store.playInstalls;playN++;}
   if(row?.admob){rev+=row.admob.revenue;revN++;}
   if(row?.spend!=null){spend+=row.spend;spendN++;}
  }
  return {dau,play,rev,users,spend,dauN,playN,revN,userN,spendN,arpu:adArpu(revN&&userN?rev:null,userN?users:null),roas:spend>0&&revN?rev/spend:null};
 },[apps,compare]);
 const revenueByApp=useMemo(()=>{
  const out:Record<string,number|undefined>={};
  for(const a of apps)out[a.id]=compare[a.id]?.admob?.revenue;
  return out;
 },[apps,compare]);
 const newUsersByApp=useMemo(()=>{
  const out:Record<string,number|undefined>={};
  for(const a of apps)out[a.id]=compare[a.id]?.ga4?.newUsers;
  return out;
 },[apps,compare]);

 useEffect(()=>{
  const scope=page==='overview'?apps:(current?[current]:[]);
  if(!scope.length)return;
  const controller=new AbortController();
  setCompare({});
  Promise.all(scope.map(async a=>{
   const next:CompareRow={store:{}};
   if(a.ga4PropertyId){
    try{const res=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate,country,os}),signal:controller.signal});const body=await res.json() as {status:string;data?:Ga4Row;message?:string};if(res.ok&&body.status==='success'&&body.data)next.ga4=body.data;else next.ga4Error=body.message||'GA4 조회 실패';}catch{next.ga4Error='GA4 서버 연결 실패';}
   }
   if(a.admobAndroidAppId||a.admobIosAppId){
    try{const res=await fetch('/api/admob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate,country,os}),signal:controller.signal});const body=await res.json() as {status:string;data?:AdmobRow&{ctr?:number;clicks:number;impressions:number};message?:string};if(res.ok&&body.status==='success'&&body.data)next.admob={...body.data,ctr:body.data.ctr??(body.data.impressions?body.data.clicks/body.data.impressions:0)};else next.admobError=body.message||'AdMob 조회 실패';}catch{next.admobError='AdMob 서버 연결 실패';}
   }
   if(a.androidPkg){
    try{
     const res=await fetch('/api/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate}),signal:controller.signal});
     const body=await res.json() as {status:string;data?:{installs:number|null;installsSource?:string|null;note?:string};message?:string;code?:string};
     if(res.ok&&body.status==='success'){
      next.store!.playInstalls=body.data?.installs??null;
      next.store!.playSource=body.data?.installsSource??null;
      next.store!.playNote=body.data?.note??null;
     }else{next.playError=body.message||'Play 조회 실패';next.playCode=body.code;}
    }catch{next.playError='Play 서버 연결 실패';}
   }
   if(a.appleAppId){
    try{const res=await fetch('/api/asc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days}),signal:controller.signal});const body=await res.json() as {status:string;data?:{downloads:number|null}};if(res.ok&&body.status==='success')next.store!.ascDownloads=body.data?.downloads??null;}catch{}
   }
   try{
    const res=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate,revenue:next.admob?.revenue}),signal:controller.signal});
    const body=await res.json() as {status:string;data?:{spend:number}};
    if(res.ok&&body.status==='success')next.spend=body.data?.spend??0;
   }catch{}
   if(!controller.signal.aborted)setCompare(prev=>({...prev,[a.id]:next}));
  }));
  return ()=>controller.abort();
 },[page,current?.id,apps,days,dateRange.startDate,dateRange.endDate,country,os]);

 if(page!=='overview'&&page!=='progress'&&page!=='connections'&&appsLoaded&&!current){
  return <div className="shell"><div className="workspace"><main><h1>앱을 찾을 수 없습니다</h1><p className="subtitle">등록되지 않았거나 보관된 앱입니다.</p><p className="note"><Link href="/connections">데이터 연결에서 앱 확인</Link></p></main></div></div>;
 }

 function refreshPage(){
  setRefreshing(true);
  window.location.reload();
 }

 function playCell(a:AppRecord,row?:CompareRow){
  if(!a.androidPkg)return '—';
  if(row?.playError){
   const label=row.playCode==='not_configured'||!playSetup?.configured?'키 필요'
    :row.playCode==='permission_denied'?'권한 필요'
    :row.playCode==='authentication_failed'?'인증 실패'
    :!playSetup?.gcsBucket?'버킷·연결 확인'
    :'연결 오류';
   return <span className="batchwait" title={row.playError} onClick={e=>e.stopPropagation()}><Link href="/connections">{label}</Link></span>;
  }
  if(row?.store?.playInstalls!=null)return row.store.playInstalls.toLocaleString();
  if(row?.store&&row.store.playInstalls==null){
   const reason=!playSetup?.configured?'키 필요':!playSetup?.gcsBucket?'버킷 필요':'배치/CSV 대기';
   return <span className="batchwait" title={row.store.playNote||undefined} onClick={e=>e.stopPropagation()}><Link href="/connections">{reason}</Link></span>;
  }
  return '…';
 }
 const overviewPlayErrors=apps.map(a=>{
  const row=compare[a.id];
  if(!a.androidPkg||!row?.playError)return '';
  return `${a.name}: ${row.playError}`;
 }).filter(Boolean);
 const noticeCount=1
  +Number(page==='overview'&&needsSetup&&appsLoaded&&!appsError)
  +Number(page==='overview'&&playInstallGap&&!needsSetup)
  +Number(os==='ios')
  +Number(!!overviewGa4Errors.length)
  +Number(!!overviewPlayErrors.length)
  +Number(!overviewPlayErrors.length&&page==='overview'&&!!playSetup&&!playSetup.gcsBucket&&!!apps.some(a=>a.androidPkg));

 const checklist=[
  {ok:ga4Verified,label:'GA4 서비스 계정 · 속성 조회',href:'#ga4',tab:'ga4' as const},
  {ok:admobVerified,label:'AdMob OAuth · 수익 조회',href:'#admob',tab:'admob' as const},
  {ok:!!playSetup?.configured,label:'Play 서비스 계정 JSON',href:'#play',tab:'play' as const},
  {ok:!!playSetup?.gcsBucket,label:'Play GCS 버킷 (설치 CSV)',href:'#play',tab:'play' as const},
  {ok:apps.every(a=>!!a.androidPkg),label:'앱별 Android 패키지명',href:'#apps',tab:'apps' as const},
 ];

 return <div className="shell">
 <div className={'workspace'+(current?' appreport':'')}><header><div>워크스페이스 <ChevronRight size={13}/><PagePicker page={page} apps={apps} progressLabel={progressLabel}/></div><div className="headeractions"><button type="button" className="refresh header-refresh" disabled={refreshing} onClick={refreshPage} aria-label="데이터 새로고침"><RefreshCw size={14}/> {refreshing?'새로고침 중…':'새로고침'}</button><form method="post" action="/api/auth/logout"><button className="refresh">로그아웃</button></form></div></header><main><div className="titleline"><div><div className="eyebrow">{page==='overview'?'OVERVIEW':current?'APP REPORT':page==='progress'?'PROJECT STATUS':'CONNECTIONS'}</div><h1>{title}</h1><p className="subtitle">{current?'KPI · 추세 · 서비스 섹션 순서는 현황과 같습니다.':page==='overview'?'유입 · 활동 · 수익 핵심만 먼저 봅니다.':page==='progress'?'남은 일은 계정 연결과 콘솔 수치 대조입니다.':'왼쪽에서 항목을 고르고, 입력칸 옆 ?로 최신 콘솔 경로를 확인하세요.'}</p></div></div>
 {appsError&&<div className="notice" role="status"><span className="dot"/>{appsError}<button type="button" className="refresh" onClick={()=>{setAppsLoaded(false);setAppsRetry(v=>v+1);}}>다시 시도</button></div>}
 {report&&<><div className="noticefold">
  <button type="button" className="noticefold-toggle" aria-expanded={showNotices} onClick={()=>setShowNotices(v=>!v)}>
   <span>안내 · 알림 {noticeCount}건</span>
   <span className="noticefold-action">{showNotices?'접기':'펼치기'} <ChevronDown size={14} className={showNotices?'open':undefined} aria-hidden/></span>
  </button>
  {showNotices&&<div className="noticefold-body">
   <div className="notice"><span className="dot"/>표시 숫자는 실조회입니다. AppsFlyer Zero는 API 없음.<Link href="/connections">연결 <ArrowUpRight size={13}/></Link></div>
   {page==='overview'&&needsSetup&&appsLoaded&&!appsError&&<div className="notice setuphint"><span className="dot"/>미연결 항목이 있으면 — 로 나옵니다. Play 설치가 비면 GCS 버킷·배치를 확인하세요. iOS/ASC는 출시 전 생략 가능.<Link href="/connections">데이터 연결 <ArrowUpRight size={13}/></Link></div>}
   {page==='overview'&&playInstallGap&&!needsSetup&&<div className="notice setuphint" role="status"><span className="dot"/>Play 설치가 아직 비어 있습니다. Connections → GCS 버킷 → 스토어 배치를 실행한 뒤 새로고침하세요.</div>}
   {os==='ios'&&<div className="notice setuphint" role="status"><span className="dot"/>OS 필터가 iOS입니다. iOS 미출시면 수치가 0 또는 — 로 나옵니다. Android 또는 전체 OS로 바꿔 보세요.</div>}
   {!!overviewGa4Errors.length&&<div className="notice setuphint" role="status"><span className="dot"/>GA4 조회 오류 — {overviewGa4Errors.join(' · ')}</div>}
   {!!overviewPlayErrors.length&&<div className="notice setuphint" role="status"><span className="dot"/>Play 조회 오류 — {overviewPlayErrors.join(' · ')}{!playSetup?.gcsBucket?' · GCS 버킷을 Connections에 등록하세요.':''}<Link href="/connections">연결 <ArrowUpRight size={13}/></Link></div>}
   {!overviewPlayErrors.length&&page==='overview'&&playSetup&&!playSetup.gcsBucket&&!!apps.some(a=>a.androidPkg)&&<div className="notice setuphint" role="status"><span className="dot"/>Play 설치는 GCS 버킷이 필요합니다. 앱 안 「통계→보고서 내보내기」가 아니라, 홈으로 나간 뒤 <strong>다운로드 보고서(또는 계정 관리→Google Play 앱 보고서)→통계→Cloud Storage URI 복사</strong>로 <code>pubsite_prod_rev_…</code>를 Connections에 넣으세요.<Link href="/connections">데이터 연결 <ArrowUpRight size={13}/></Link></div>}
  </div>}
 </div>
 <div className="filterbar"><DateRangePicker value={dateRange} onChange={setDateRange}/><label>국가<select aria-label="국가" value={country} onChange={e=>setCountry(e.target.value)}>{COUNTRY_OPTIONS.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></label><label>OS<select aria-label="OS" value={os} onChange={e=>setOs(e.target.value)}><option value="all">전체 OS</option><option value="android">Android</option><option value="ios">iOS</option></select></label><span className="range">각 서비스 시간대 기준 · {days}일</span></div>

 {page==='overview'&&!!apps.length&&<>
  <div className="metrics overviewkpi" aria-label="핵심 합계">
   <div className="metric"><span>평균 DAU 합</span><strong>{totals.dauN?Math.round(totals.dau).toLocaleString():'—'}</strong><small>GA4 · 앱 {totals.dauN}/{apps.length}</small></div>
   <div className="metric"><span>Play 설치 합</span><strong>{totals.playN?totals.play.toLocaleString():'—'}</strong><small>{playSetup?.gcsBucket?'GCS/배치':'버킷 미등록'} · 앱 {totals.playN}/{apps.filter(a=>a.androidPkg).length}</small></div>
   <div className="metric"><span>광고 수익 합</span><strong>{totals.revN?'$'+totals.rev.toFixed(2):'—'}</strong><small>AdMob · 앱 {totals.revN}/{apps.length}</small></div>
   <div className="metric"><span>마케팅 비용</span><strong>{totals.spendN?'$'+totals.spend.toFixed(2):'—'}</strong><small>Ads · 수동 · 앱 {totals.spendN}/{apps.length}</small></div>
   <div className="metric"><span>ROAS</span><strong>{totals.roas!=null?totals.roas.toFixed(2)+'x':'—'}</strong><small>AdMob÷마케팅 비용</small></div>
   <div className="metric"><span>유저당 광고 수익</span><strong>{fmtUsd(totals.arpu)}</strong><small>AdMob÷GA4 활성 · 앱 합산</small></div>
  </div>
  <div className="sectiontitle"><h2>앱 비교</h2><span>같은 필터 · 행 클릭 시 상세</span></div>
 </>}
 {!!current&&(()=>{
  const row=compare[current.id];
  const arpu=adArpu(row?.admob?.revenue,row?.ga4?.activeUsers);
  const appRoas=row?.spend&&row.spend>0&&row.admob?row.admob.revenue/row.spend:null;
  return <div className="metrics overviewkpi" aria-label="앱 핵심 지표">
   <div className="metric"><span>평균 DAU</span><strong>{row?.ga4?Math.round(row.ga4.averageDau).toLocaleString():'—'}</strong><small>GA4</small></div>
   <div className="metric"><span>Play 설치</span><strong>{row?.store?.playInstalls!=null?row.store.playInstalls.toLocaleString():'—'}</strong><small>{playSetup?.gcsBucket?'GCS/배치':(current.androidPkg?'버킷 미등록':'Android 미등록')}</small></div>
   <div className="metric"><span>ASC 다운로드</span><strong>{row?.store?.ascDownloads!=null?row.store.ascDownloads.toLocaleString():'—'}</strong><small>{current.appleAppId?'App Store':'iOS 미출시'}</small></div>
   <div className="metric"><span>광고 수익</span><strong>{row?.admob?'$'+row.admob.revenue.toFixed(2):'—'}</strong><small>AdMob</small></div>
   <div className="metric"><span>마케팅 비용</span><strong>{row?.spend!=null?'$'+row.spend.toFixed(2):'—'}</strong><small>Ads · 수동</small></div>
   <div className="metric"><span>ROAS</span><strong>{appRoas!=null?appRoas.toFixed(2)+'x':'—'}</strong><small>AdMob÷마케팅 비용</small></div>
   <div className="metric"><span>유저당 광고 수익</span><strong>{fmtUsd(arpu)}</strong><small>AdMob÷GA4 활성</small></div>
   <div className="metric"><span>eCPM</span><strong>{row?.admob?'$'+row.admob.ecpm.toFixed(2):'—'}</strong><small>AdMob</small></div>
   <div className="metric"><span>신규 사용자</span><strong>{row?.ga4?.newUsers!=null?row.ga4.newUsers.toLocaleString():'—'}</strong><small>GA4</small></div>
  </div>;
 })()}
 {page==='overview'&&appsLoaded&&!apps.length&&!appsError&&<div className="empty"><h2>등록된 앱이 없습니다</h2><p>Connections에서 앱을 추가하세요.</p><p className="note"><Link href="/connections">데이터 연결로 이동</Link></p></div>}
 {page==='overview'&&!!apps.length&&<div className="tablewrap comparewrap"><table className="dense"><thead><tr><th>앱</th><th>DAU</th><th>Play</th><th>ASC</th><th>수익</th><th>비용</th><th>ROAS</th><th>유저당</th><th>eCPM</th></tr></thead><tbody>{apps.map(a=>{const row=compare[a.id];const ascPending=!!a.appleAppId&&!!row?.store&&row.store.ascDownloads==null;const arpu=adArpu(row?.admob?.revenue,row?.ga4?.activeUsers);const appRoas=row?.spend&&row.spend>0&&row.admob?row.admob.revenue/row.spend:null;return <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>router.push(`/apps/${a.id}`)} title={row?.ga4?`세션 ${row.ga4.sessions.toLocaleString()} · 활성 ${row.ga4.activeUsers.toLocaleString()}${row?.admob?` · CTR ${(row.admob.ctr*100).toFixed(2)}%`:''}`:undefined}><td><div className="applink"><AppIcon app={a}/><span><span className="appdot" style={{background:appColor(a.id)}} aria-hidden/>{a.name}<small>{a.androidPkg||a.id}{row?.store?.playSource?` · ${row.store.playSource}`:''}{row?.ga4Error?' · GA4 오류':''}</small></span></div></td><td>{row?.ga4?row.ga4.averageDau.toLocaleString():'—'}</td><td>{playCell(a,row)}</td><td>{row?.store?.ascDownloads!=null?row.store.ascDownloads.toLocaleString():ascPending?<span className="batchwait" onClick={e=>e.stopPropagation()}><Link href="/connections">배치 대기</Link></span>:(a.appleAppId?'—':'iOS 미출시')}</td><td>{row?.admob?'$'+row.admob.revenue.toFixed(2):'—'}</td><td>{row?.spend!=null?'$'+row.spend.toFixed(2):'—'}</td><td>{appRoas!=null?appRoas.toFixed(2)+'x':'—'}</td><td>{fmtUsd(arpu)}</td><td>{row?.admob?'$'+row.admob.ecpm.toFixed(2):'—'}</td></tr>;})}</tbody></table></div>}

 {page==='overview'&&!!apps.length&&<OverviewCombined apps={apps} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os}/>}
 {!!current&&<OverviewCombined apps={[current]} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os}/>}

 {(!!current||page==='overview')&&<>
  <GA4Live apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os} showCharts={false}/>
  <AdmobLive apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os} showCharts={false}/>
  <MarketingLive apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} revenueByApp={revenueByApp} newUsersByApp={newUsersByApp} showCharts={false}/>
  <StoreLive apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} showCharts={false}/>
 </>}
 {page==='overview'&&!!apps.length&&<p className="note">앱 행을 클릭하면 해당 앱 상세로 이동합니다.</p>}
 </>}
 {page==='progress'&&<><div className="progresssummary"><div><strong>{doneBase} <span>/ 13</span></strong><p>완료·검증한 작업</p></div><div className="progressbar"><div style={{width:`${doneBase/13*100}%`}}/></div><span>코드 {codeDone}/12 · {ga4Verified?'GA4 실조회 확인':'GA4 연결 대기'}{admobVerified?' · AdMob OAuth 확인':' · AdMob OAuth 대기'}</span></div>
 <section className="verifychecklist"><div className="sectiontitle"><h2>콘솔 수치 대조</h2><span>운영 확인</span></div>
 <ol>
  <li>기간을 대시보드와 <strong>동일하게</strong> 맞춥니다 (프리셋 7일 = 어제까지인지 오늘 포함인지 확인).</li>
  <li>GA4: 속성 → 보고서 → 참여도/사용자. OS·국가 필터를 대시보드와 같게.</li>
  <li>AdMob: 앱별 수익·eCPM. 통화 USD, 시차는 AdMob 계정 시간대.</li>
  <li>Play Console: 통계 → 설치 수(기기). GCS CSV 합계와 ±1일 오차는 수출 지연으로 흔함.</li>
  <li>차이가 크면 Connections에서 속성 ID·패키지명·버킷을 재확인한 뒤 배치를 다시 실행합니다.</li>
 </ol>
 <p className="note">「원본 콘솔 수치 대조」가 완료되면 Progress에서 대기로 남아 있어도 실사용에는 문제 없습니다. 수치만 직접 확인하면 됩니다.</p>
 </section>
 {tasks.map(([name,originalStatus,originalDetail],i)=>{const verified=(name==='GA4 인증 등록 화면'&&ga4Verified)||(name.startsWith('AdMob')&&admobVerified);const status=verified?'완료':originalStatus,detail=verified?(name.startsWith('AdMob')?'실제 AdMob 보고서 조회 성공을 확인했습니다.':'등록된 앱의 실제 GA4 보고서 조회 성공을 확인했습니다.'):originalDetail;const done=status==='완료'||status==='코드 완료'||status==='제외';return <article className="task" key={name}><span className={'taskicon '+(done?'done':'')}>{done?<Check size={16}/>:String(i+1).padStart(2,'0')}</span><div><h2>{name}</h2><p>{detail}</p></div><span className="status">{status}</span></article>})}<p className="note">P0–P3 기능 코드는 배포된 상태입니다. 「대기」는 본인 계정 연결·수치 대조만 남았다는 뜻입니다.</p></>}
 {page==='connections'&&<ConnectionsPage
  apps={apps}
  appsLoaded={appsLoaded}
  appsError={appsError}
  onRetryApps={()=>{setAppsLoaded(false);setAppsRetry(v=>v+1);}}
  onAppsChange={setApps}
  checklist={checklist}
  showForm={showForm}
  setShowForm={setShowForm}
  editing={editing}
  setEditing={setEditing}
  onSavedNew={(app,isNew)=>{if(isNew)router.push(`/apps/${app.id}`);}}
 />}
 <nav className="utilitylinks" aria-label="대시보드 관리"><Link href="/">서비스 현황</Link><Link href="/progress">{progressLabel}</Link><Link href="/connections">데이터 연결</Link></nav></main></div></div>;
}
