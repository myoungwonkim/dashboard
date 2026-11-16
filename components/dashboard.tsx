import DateRangePicker from './date-range-picker';
import {presetRange,validateRange} from '@/lib/date-range.mts';
import {COUNTRY_OPTIONS} from '@/lib/countries.mts';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from '@/client/navigation';
import {useRouter} from '@/client/navigation';
import {ArrowUpRight,Check,ChevronDown,ChevronRight,RefreshCw} from 'lucide-react';
import {type AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import AppIcon from './app-icon';
import GA4Live from './ga4-live';
import AdmobLive from './admob-live';
import MarketingLive from './marketing-live';
import OverviewCombined from './overview-combined';
import ConnectionsPage from './connections-page';
import PagePicker from './page-picker';
import MetricTable,{type MetricCol} from './metric-table';
import SectionJumps,{type SectionJump} from './section-jumps';
import AppToggle,{useAppFilter} from './app-toggle';
import LoadingHourglass,{useBusyFlags} from './loading-hourglass';
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
 const {busy,setBusy}=useBusyFlags();
 const markCompare=useCallback((v:boolean)=>setBusy('compare',v),[setBusy]);
 const markTrends=useCallback((v:boolean)=>setBusy('trends',v),[setBusy]);
 const markGa4=useCallback((v:boolean)=>setBusy('ga4',v),[setBusy]);
 const markAdmob=useCallback((v:boolean)=>setBusy('admob',v),[setBusy]);
 const markMarketing=useCallback((v:boolean)=>setBusy('marketing',v),[setBusy]);
 type CompareRow={ga4?:Ga4Row;admob?:AdmobRow;spend?:number;ga4Error?:string;admobError?:string};
 const [compare,setCompare]=useState<Record<string,CompareRow>>({});
 useEffect(()=>{
  setAppsError('');
  setBusy('apps',true);
  fetch('/api/apps',{cache:'no-store'}).then(async r=>{
   if(!r.ok){setAppsError(r.status===401?'로그인이 필요합니다.':'앱 목록을 불러오지 못했습니다.');setApps([]);return;}
   const v=await r.json() as {apps?:AppRecord[];message?:string};
   setApps(v.apps||[]);
  }).catch(()=>{setAppsError('앱 목록을 불러오지 못했습니다.');setApps([]);}).finally(()=>{setAppsLoaded(true);setBusy('apps',false);});
 },[appsRetry,setBusy]);
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
 const needsSetup=!ga4Verified||!admobVerified;
 const overviewGa4Errors=apps.map(a=>compare[a.id]?.ga4Error?`${a.name}: ${compare[a.id]!.ga4Error}`:'').filter(Boolean);
 const compareAppOpts=useMemo(()=>apps.map(a=>({id:a.id,name:a.name})),[apps]);
 const compareFilter=useAppFilter(compareAppOpts);
 const compareApps=useMemo(()=>apps.filter(a=>compareFilter.includes(a.id)),[apps,compareFilter.selected,compareFilter.allOn]);
 const totals=useMemo(()=>{
  let dau=0,rev=0,users=0,spend=0,dauN=0,revN=0,userN=0,spendN=0;
  for(const a of compareApps){
   const row=compare[a.id];
   if(row?.ga4){dau+=row.ga4.averageDau;dauN++;users+=row.ga4.activeUsers;userN++;}
   if(row?.admob){rev+=row.admob.revenue;revN++;}
   if(row?.spend!=null){spend+=row.spend;spendN++;}
  }
  return {dau,rev,users,spend,dauN,revN,userN,spendN,arpu:adArpu(revN&&userN?rev:null,userN?users:null),roas:spend>0&&revN?rev/spend:null};
 },[compareApps,compare]);
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
  if(!scope.length){markCompare(false);return;}
  const controller=new AbortController();
  setCompare({});
  markCompare(true);
  Promise.all(scope.map(async a=>{
   const next:CompareRow={};
   if(a.ga4PropertyId){
    try{const res=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate,country,os}),signal:controller.signal});const body=await res.json() as {status:string;data?:Ga4Row;message?:string};if(res.ok&&body.status==='success'&&body.data)next.ga4=body.data;else next.ga4Error=body.message||'GA4 조회 실패';}catch{next.ga4Error='GA4 서버 연결 실패';}
   }
   if(a.admobAndroidAppId||a.admobIosAppId){
    try{const res=await fetch('/api/admob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate,country,os}),signal:controller.signal});const body=await res.json() as {status:string;data?:AdmobRow&{ctr?:number;clicks:number;impressions:number};message?:string};if(res.ok&&body.status==='success'&&body.data)next.admob={...body.data,ctr:body.data.ctr??(body.data.impressions?body.data.clicks/body.data.impressions:0)};else next.admobError=body.message||'AdMob 조회 실패';}catch{next.admobError='AdMob 서버 연결 실패';}
   }
   try{
    const res=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate,revenue:next.admob?.revenue}),signal:controller.signal});
    const body=await res.json() as {status:string;data?:{spend:number}};
    if(res.ok&&body.status==='success')next.spend=body.data?.spend??0;
   }catch{}
   if(!controller.signal.aborted)setCompare(prev=>({...prev,[a.id]:next}));
  })).finally(()=>{if(!controller.signal.aborted)markCompare(false);});
  return ()=>{controller.abort();markCompare(false);};
 },[page,current?.id,apps,days,dateRange.startDate,dateRange.endDate,country,os,markCompare]);

 if(page!=='overview'&&page!=='progress'&&page!=='connections'&&appsLoaded&&!current){
  return <div className="shell"><div className="workspace"><main><h1>앱을 찾을 수 없습니다</h1><p className="subtitle">등록되지 않았거나 보관된 앱입니다.</p><p className="note"><Link href="/connections">데이터 연결에서 앱 확인</Link></p></main></div></div>;
 }

 function refreshPage(){
  setRefreshing(true);
  window.location.reload();
 }

 const compareCols=useMemo(():MetricCol<AppRecord>[]=>[
  {key:'name',label:'앱',get:a=>a.name,render:a=>{const row=compare[a.id];return <div className="applink"><AppIcon app={a}/><span><span className="appdot" style={{background:appColor(a.id)}} aria-hidden/>{a.name}<small>{a.androidPkg||a.id}{row?.ga4Error?' · GA4 오류':''}</small></span></div>;}},
  {key:'dau',label:'DAU',get:a=>compare[a.id]?.ga4?.averageDau??null,render:a=>{const row=compare[a.id];return row?.ga4?row.ga4.averageDau.toLocaleString():'—';}},
  {key:'rev',label:'수익',get:a=>compare[a.id]?.admob?.revenue??null,render:a=>{const row=compare[a.id];return row?.admob?'$'+row.admob.revenue.toFixed(2):'—';}},
  {key:'spend',label:'비용',get:a=>compare[a.id]?.spend??null,render:a=>{const row=compare[a.id];return row?.spend!=null?'$'+row.spend.toFixed(2):'—';}},
  {key:'roas',label:'ROAS',get:a=>{const row=compare[a.id];return row?.spend&&row.spend>0&&row.admob?row.admob.revenue/row.spend:null;},render:a=>{const row=compare[a.id];const appRoas=row?.spend&&row.spend>0&&row.admob?row.admob.revenue/row.spend:null;return appRoas!=null?appRoas.toFixed(2)+'x':'—';}},
  {key:'arpu',label:'유저당',get:a=>adArpu(compare[a.id]?.admob?.revenue,compare[a.id]?.ga4?.activeUsers),render:a=>fmtUsd(adArpu(compare[a.id]?.admob?.revenue,compare[a.id]?.ga4?.activeUsers))},
  {key:'ecpm',label:'eCPM',get:a=>compare[a.id]?.admob?.ecpm??null,render:a=>{const row=compare[a.id];return row?.admob?'$'+row.admob.ecpm.toFixed(2):'—';}},
 ],[compare]);
 const noticeCount=1
  +Number(page==='overview'&&needsSetup&&appsLoaded&&!appsError)
  +Number(os==='ios')
  +Number(!!overviewGa4Errors.length);

 const checklist=[
  {ok:ga4Verified,label:'GA4 서비스 계정 · 속성 조회',href:'#ga4',tab:'ga4' as const},
  {ok:admobVerified,label:'AdMob OAuth · 수익 조회',href:'#admob',tab:'admob' as const},
  {ok:!!playSetup?.configured,label:'Play 서비스 계정 JSON',href:'#play',tab:'play' as const},
  {ok:!!playSetup?.gcsBucket,label:'Play GCS 버킷 (설치 CSV)',href:'#play',tab:'play' as const},
  {ok:apps.every(a=>!!a.androidPkg),label:'앱별 Android 패키지명',href:'#apps',tab:'apps' as const},
 ];

 const reportJumps=useMemo(():SectionJump[]=>{
  if(page==='overview')return [
   {id:'section-compare',label:'앱 비교'},
   {id:'section-trends',label:'합산 추세'},
   {id:'section-ga4',label:'GA4'},
   {id:'section-map',label:'지도'},
   {id:'section-retention',label:'리텐션'},
   {id:'section-admob',label:'AdMob'},
   {id:'section-marketing',label:'마케팅'},
  ];
  if(current)return [
   {id:'section-trends',label:'핵심 추세'},
   {id:'section-ga4',label:'GA4'},
   {id:'section-map',label:'지도'},
   {id:'section-retention',label:'리텐션'},
   {id:'section-acquisition',label:'유입'},
   {id:'section-countries',label:'국가'},
   {id:'section-versions',label:'앱 버전'},
   {id:'section-admob',label:'AdMob'},
   {id:'section-marketing',label:'마케팅'},
  ];
  return [];
 },[page,current?.id]);

 const showHourglass=busy||refreshing||(report&&!appsLoaded);

 return <div className="shell">
 <div className={'workspace'+(current?' appreport':'')}><header><div>워크스페이스 <ChevronRight size={13}/><PagePicker page={page} apps={apps} progressLabel={progressLabel}/></div><div className="headeractions"><button type="button" className="refresh header-refresh" disabled={refreshing} onClick={refreshPage} aria-label="데이터 새로고침"><RefreshCw size={14}/> {refreshing?'새로고침 중…':'새로고침'}</button><form method="post" action="/api/auth/logout"><button className="refresh">로그아웃</button></form></div></header><main><LoadingHourglass show={showHourglass}/><div className="titleline"><div><div className="eyebrow">{page==='overview'?'OVERVIEW':current?'APP REPORT':page==='progress'?'PROJECT STATUS':'CONNECTIONS'}</div><div className="title-with-jumps"><h1>{title}</h1>{!!reportJumps.length&&<SectionJumps items={reportJumps}/>}</div></div></div>
 {appsError&&<div className="notice" role="status"><span className="dot"/>{appsError}<button type="button" className="refresh" onClick={()=>{setAppsLoaded(false);setAppsRetry(v=>v+1);}}>다시 시도</button></div>}
 {report&&<><div className="noticefold">
  <button type="button" className="noticefold-toggle" aria-expanded={showNotices} onClick={()=>setShowNotices(v=>!v)}>
   <span>안내 · 알림 {noticeCount}건</span>
   <span className="noticefold-action">{showNotices?'접기':'펼치기'} <ChevronDown size={14} className={showNotices?'open':undefined} aria-hidden/></span>
  </button>
  {showNotices&&<div className="noticefold-body">
   <div className="notice"><span className="dot"/>표시 숫자는 실조회입니다. AppsFlyer Zero는 API 없음.<Link href="/connections">연결 <ArrowUpRight size={13}/></Link></div>
   {page==='overview'&&needsSetup&&appsLoaded&&!appsError&&<div className="notice setuphint"><span className="dot"/>미연결 항목이 있으면 — 로 나옵니다. GA4·AdMob 키와 앱 매핑을 확인하세요.<Link href="/connections">데이터 연결 <ArrowUpRight size={13}/></Link></div>}
   {os==='ios'&&<div className="notice setuphint" role="status"><span className="dot"/>OS 필터가 iOS입니다. iOS 미출시면 수치가 0 또는 — 로 나옵니다. Android 또는 전체 OS로 바꿔 보세요.</div>}
   {!!overviewGa4Errors.length&&<div className="notice setuphint" role="status"><span className="dot"/>GA4 조회 오류 — {overviewGa4Errors.join(' · ')}</div>}
  </div>}
 </div>
 <div className="filterbar"><DateRangePicker value={dateRange} onChange={setDateRange}/><label>국가<select aria-label="국가" value={country} onChange={e=>setCountry(e.target.value)}>{COUNTRY_OPTIONS.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></label><label>OS<select aria-label="OS" value={os} onChange={e=>setOs(e.target.value)}><option value="all">전체 OS</option><option value="android">Android</option><option value="ios">iOS</option></select></label><span className="range">각 서비스 시간대 기준 · {days}일</span></div>

 {page==='overview'&&!!apps.length&&<>
  <div className="sectiontitle marketing-title" id="section-compare"><div className="marketing-title-row"><h2>앱 비교</h2><AppToggle apps={compareAppOpts} allOn={compareFilter.allOn} selected={compareFilter.selected} onSelectAll={compareFilter.selectAll} onToggle={compareFilter.toggle} label="비교 앱"/></div><span>{compareFilter.label} · 행 클릭 시 상세</span></div>
  <div className="metrics overviewkpi" aria-label="핵심 합계">
   <div className="metric"><span>평균 DAU 합</span><strong>{totals.dauN?Math.round(totals.dau).toLocaleString():'—'}</strong><small>GA4 · 앱 {totals.dauN}/{compareApps.length}</small></div>
   <div className="metric"><span>광고 수익 합</span><strong>{totals.revN?'$'+totals.rev.toFixed(2):'—'}</strong><small>AdMob · 앱 {totals.revN}/{compareApps.length}</small></div>
   <div className="metric"><span>마케팅 비용</span><strong>{totals.spendN?'$'+totals.spend.toFixed(2):'—'}</strong><small>Ads · 수동 · 앱 {totals.spendN}/{compareApps.length}</small></div>
   <div className="metric"><span>ROAS</span><strong>{totals.roas!=null?totals.roas.toFixed(2)+'x':'—'}</strong><small>AdMob÷마케팅 비용</small></div>
   <div className="metric"><span>유저당 광고 수익</span><strong>{fmtUsd(totals.arpu)}</strong><small>AdMob÷GA4 활성 · {compareFilter.label}</small></div>
  </div>
 </>}
 {!!current&&(()=>{
  const row=compare[current.id];
  const arpu=adArpu(row?.admob?.revenue,row?.ga4?.activeUsers);
  const appRoas=row?.spend&&row.spend>0&&row.admob?row.admob.revenue/row.spend:null;
  return <div className="metrics overviewkpi" aria-label="앱 핵심 지표">
   <div className="metric"><span>평균 DAU</span><strong>{row?.ga4?Math.round(row.ga4.averageDau).toLocaleString():'—'}</strong><small>GA4</small></div>
   <div className="metric"><span>광고 수익</span><strong>{row?.admob?'$'+row.admob.revenue.toFixed(2):'—'}</strong><small>AdMob</small></div>
   <div className="metric"><span>마케팅 비용</span><strong>{row?.spend!=null?'$'+row.spend.toFixed(2):'—'}</strong><small>Ads · 수동</small></div>
   <div className="metric"><span>ROAS</span><strong>{appRoas!=null?appRoas.toFixed(2)+'x':'—'}</strong><small>AdMob÷마케팅 비용</small></div>
   <div className="metric"><span>유저당 광고 수익</span><strong>{fmtUsd(arpu)}</strong><small>AdMob÷GA4 활성</small></div>
   <div className="metric"><span>eCPM</span><strong>{row?.admob?'$'+row.admob.ecpm.toFixed(2):'—'}</strong><small>AdMob</small></div>
   <div className="metric"><span>신규 사용자</span><strong>{row?.ga4?.newUsers!=null?row.ga4.newUsers.toLocaleString():'—'}</strong><small>GA4</small></div>
  </div>;
 })()}
 {page==='overview'&&appsLoaded&&!apps.length&&!appsError&&<div className="empty"><h2>등록된 앱이 없습니다</h2><p>Connections에서 앱을 추가하세요.</p><p className="note"><Link href="/connections">데이터 연결로 이동</Link></p></div>}
 {page==='overview'&&!!compareApps.length&&<MetricTable rows={compareApps} columns={compareCols} rowKey={a=>a.id} wrapClassName="tablewrap comparewrap" defaultSort={{key:'dau',dir:'desc'}} onRowClick={a=>router.push(`/apps/${a.id}`)} rowTitle={a=>{const row=compare[a.id];return row?.ga4?`세션 ${row.ga4.sessions.toLocaleString()} · 활성 ${row.ga4.activeUsers.toLocaleString()}${row?.admob?` · CTR ${(row.admob.ctr*100).toFixed(2)}%`:''}`:undefined;}}/>}

 {page==='overview'&&!!apps.length&&<OverviewCombined apps={apps} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os} onLoadingChange={markTrends}/>}
 {!!current&&<OverviewCombined apps={[current]} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os} onLoadingChange={markTrends}/>}

 {(!!current||page==='overview')&&<>
  <GA4Live apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os} showCharts={false} onLoadingChange={markGa4}/>
  <AdmobLive apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os} showCharts={false} onLoadingChange={markAdmob}/>
  <MarketingLive apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} revenueByApp={revenueByApp} newUsersByApp={newUsersByApp} showCharts={false} onLoadingChange={markMarketing}/>
 </>}
 {page==='overview'&&!!apps.length&&<p className="note">앱 행을 클릭하면 해당 앱 상세로 이동합니다.</p>}
 </>}
 {page==='progress'&&<><div className="progresssummary"><div><strong>{doneBase} <span>/ 13</span></strong><p>완료·검증한 작업</p></div><div className="progressbar"><div style={{width:`${doneBase/13*100}%`}}/></div><span>코드 {codeDone}/12 · {ga4Verified?'GA4 실조회 확인':'GA4 연결 대기'}{admobVerified?' · AdMob OAuth 확인':' · AdMob OAuth 대기'}</span></div>
 <section className="verifychecklist"><div className="sectiontitle"><h2>콘솔 수치 대조</h2><span>운영 확인</span></div>
 <ol>
  <li>기간을 대시보드와 <strong>동일하게</strong> 맞춥니다 (프리셋 7일 = 어제까지인지 오늘 포함인지 확인).</li>
  <li>GA4: 속성 → 보고서 → 참여도/사용자. OS·국가 필터를 대시보드와 같게.</li>
  <li>AdMob: 앱별 수익·eCPM. 통화 USD, 시차는 AdMob 계정 시간대.</li>
  <li>차이가 크면 Connections에서 속성 ID·패키지명·AdMob 앱 ID를 재확인합니다.</li>
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
