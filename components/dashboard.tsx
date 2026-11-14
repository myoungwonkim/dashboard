import DateRangePicker from './date-range-picker';
import {presetRange,validateRange} from '@/lib/date-range.mts';
import {COUNTRY_OPTIONS} from '@/lib/countries.mts';
import {useEffect,useMemo,useState} from 'react';
import Link from '@/client/navigation';
import {useRouter} from '@/client/navigation';
import {ArrowUpRight,Check,ChevronRight,RefreshCw} from 'lucide-react';
import {appBadges,type AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import GA4Live from './ga4-live';
import GA4Setup from './ga4-setup';
import AdmobSetup from './admob-setup';
import AdmobLive from './admob-live';
import AppForm from './app-form';
import PlaySetup from './play-setup';
import AscSetup from './asc-setup';
import StoreLive from './store-live';
import StoreBatchPanel from './store-batch-panel';
import {admobPublisherId} from '@/lib/admob-config';
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
 const [wideTable,setWideTable]=useState(false);
 const [showDeep,setShowDeep]=useState(false);
 const [refreshing,setRefreshing]=useState(false);
 type CompareRow={ga4?:Ga4Row;admob?:AdmobRow;store?:StoreRow;ga4Error?:string;admobError?:string;playError?:string};
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
 const pageOptions=useMemo(()=>[['overview','서비스 현황'],...apps.map(a=>[a.id,a.name] as [string,string]),['progress','진행상황'],['connections','데이터 연결']],[apps]);
 const missingAsc=apps.filter(a=>!a.appleAppId);
 const needsSetup=!ga4Verified||!admobVerified||apps.some(a=>!a.androidPkg)||!playSetup?.gcsBucket;
 const overviewGa4Errors=apps.map(a=>compare[a.id]?.ga4Error?`${a.name}: ${compare[a.id]!.ga4Error}`:'').filter(Boolean);
 const playInstallGap=apps.some(a=>a.androidPkg&&compare[a.id]?.store&&compare[a.id]!.store!.playInstalls==null);
 const totals=useMemo(()=>{
  let dau=0,play=0,rev=0,dauN=0,playN=0,revN=0;
  for(const a of apps){
   const row=compare[a.id];
   if(row?.ga4){dau+=row.ga4.averageDau;dauN++;}
   if(row?.store?.playInstalls!=null){play+=row.store.playInstalls;playN++;}
   if(row?.admob){rev+=row.admob.revenue;revN++;}
  }
  return {dau,play,rev,dauN,playN,revN};
 },[apps,compare]);

 useEffect(()=>{
  if(page!=='overview'||!apps.length)return;
  const controller=new AbortController();
  setCompare({});
  Promise.all(apps.map(async a=>{
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
     const body=await res.json() as {status:string;data?:{installs:number|null;installsSource?:string|null;note?:string};message?:string};
     if(res.ok&&body.status==='success'){
      next.store!.playInstalls=body.data?.installs??null;
      next.store!.playSource=body.data?.installsSource??null;
      next.store!.playNote=body.data?.note??null;
     }else next.playError=body.message||'Play 조회 실패';
    }catch{next.playError='Play 서버 연결 실패';}
   }
   if(a.appleAppId){
    try{const res=await fetch('/api/asc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days}),signal:controller.signal});const body=await res.json() as {status:string;data?:{downloads:number|null}};if(res.ok&&body.status==='success')next.store!.ascDownloads=body.data?.downloads??null;}catch{}
   }
   if(!controller.signal.aborted)setCompare(prev=>({...prev,[a.id]:next}));
  }));
  return ()=>controller.abort();
 },[page,apps,days,dateRange.startDate,dateRange.endDate,country,os]);

 if(page!=='overview'&&page!=='progress'&&page!=='connections'&&appsLoaded&&!current){
  return <div className="shell"><div className="workspace"><main><h1>앱을 찾을 수 없습니다</h1><p className="subtitle">등록되지 않았거나 보관된 앱입니다.</p><p className="note"><Link href="/connections">데이터 연결에서 앱 확인</Link></p></main></div></div>;
 }

 function refreshPage(){
  setRefreshing(true);
  window.location.reload();
 }

 function playCell(a:AppRecord,row?:CompareRow){
  if(!a.androidPkg)return '—';
  if(row?.playError)return <span className="batchwait" onClick={e=>e.stopPropagation()}><Link href="/connections">연결 오류</Link></span>;
  if(row?.store?.playInstalls!=null)return row.store.playInstalls.toLocaleString();
  if(row?.store&&row.store.playInstalls==null){
   const reason=!playSetup?.configured?'키 필요':!playSetup?.gcsBucket?'버킷 필요':'배치/CSV 대기';
   return <span className="batchwait" onClick={e=>e.stopPropagation()}><Link href="/connections">{reason}</Link></span>;
  }
  return '…';
 }

 const checklist=[
  {ok:ga4Verified,label:'GA4 서비스 계정 · 속성 조회',href:'#ga4'},
  {ok:admobVerified,label:'AdMob OAuth · 수익 조회',href:'#admob'},
  {ok:!!playSetup?.configured,label:'Play 서비스 계정 JSON',href:'#play'},
  {ok:!!playSetup?.gcsBucket,label:'Play GCS 버킷 (설치 CSV)',href:'#play'},
  {ok:apps.every(a=>!!a.androidPkg),label:'앱별 Android 패키지명',href:'#apps'},
 ];

 return <div className="shell">
 <div className="workspace"><header><div>워크스페이스 <ChevronRight size={13}/><select className="pagepicker" aria-label="페이지 및 앱 선택" value={page==='overview'||page==='progress'||page==='connections'?page:(current?page:'overview')} onChange={e=>{const v=e.target.value;router.push(v==='overview'?'/':v==='progress'?'/progress':v==='connections'?'/connections':`/apps/${v}`);}}>{pageOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div><div className="headeractions"><button type="button" className="refresh" disabled={refreshing} onClick={refreshPage} aria-label="페이지 새로고침"><RefreshCw size={14}/> {refreshing?'새로고침 중…':'새로고침'}</button><form method="post" action="/api/auth/logout"><button className="refresh">로그아웃</button></form></div></header><main><div className="titleline"><div><div className="eyebrow">{page==='overview'?'OVERVIEW':current?'APP REPORT':page==='progress'?'PROJECT STATUS':'CONNECTIONS'}</div><h1>{title}</h1><p className="subtitle">{current?(current.androidPkg||current.id):page==='overview'?'유입 · 활동 · 수익 핵심만 먼저 봅니다.':page==='progress'?'남은 일은 계정 연결과 콘솔 수치 대조입니다.':'필수 연결을 위에서부터 순서대로 완료하세요.'}</p></div><div className="titleactions">{report&&<button type="button" className="refresh" disabled={refreshing} onClick={refreshPage}><RefreshCw size={14}/> 데이터 새로고침</button>}{page==='connections'&&!showForm&&!editing&&<button type="button" className="setupbutton" onClick={()=>{setEditing(null);setShowForm(true);}}>앱 추가</button>}</div></div>
 {appsError&&<div className="notice" role="status"><span className="dot"/>{appsError}<button type="button" className="refresh" onClick={()=>{setAppsLoaded(false);setAppsRetry(v=>v+1);}}>다시 시도</button></div>}
 {report&&<><div className="notice"><span className="dot"/>표시 숫자는 실조회입니다. AppsFlyer Zero는 API 없음.<Link href="/connections">연결 <ArrowUpRight size={13}/></Link></div>
 {page==='overview'&&needsSetup&&appsLoaded&&!appsError&&<div className="notice setuphint"><span className="dot"/>미연결 항목이 있으면 — 로 나옵니다. Play 설치가 비면 GCS 버킷·배치를 확인하세요. iOS/ASC는 출시 전 생략 가능.<Link href="/connections">데이터 연결 <ArrowUpRight size={13}/></Link></div>}
 {page==='overview'&&playInstallGap&&!needsSetup&&<div className="notice setuphint" role="status"><span className="dot"/>Play 설치가 아직 비어 있습니다. Connections → GCS 버킷 → 스토어 배치를 실행한 뒤 새로고침하세요.</div>}
 {os==='ios'&&<div className="notice setuphint" role="status"><span className="dot"/>OS 필터가 iOS입니다. iOS 미출시면 수치가 0 또는 — 로 나옵니다. Android 또는 전체 OS로 바꿔 보세요.</div>}
 {!!overviewGa4Errors.length&&<div className="notice setuphint" role="status"><span className="dot"/>GA4 조회 오류 — {overviewGa4Errors.join(' · ')}</div>}
 <div className="filterbar"><DateRangePicker value={dateRange} onChange={setDateRange}/><label>국가<select aria-label="국가" value={country} onChange={e=>setCountry(e.target.value)}>{COUNTRY_OPTIONS.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></label><label>OS<select aria-label="OS" value={os} onChange={e=>setOs(e.target.value)}><option value="all">전체 OS</option><option value="android">Android</option><option value="ios">iOS</option></select></label><span className="range">각 서비스 시간대 기준 · {days}일</span></div>

 {page==='overview'&&!!apps.length&&<>
  <div className="metrics overviewkpi" aria-label="핵심 합계">
   <div className="metric"><span>평균 DAU 합</span><strong>{totals.dauN?Math.round(totals.dau).toLocaleString():'—'}</strong><small>GA4 · 앱 {totals.dauN}/{apps.length}</small></div>
   <div className="metric"><span>Play 설치 합</span><strong>{totals.playN?totals.play.toLocaleString():'—'}</strong><small>{playSetup?.gcsBucket?'GCS/배치':'버킷 미등록'} · 앱 {totals.playN}/{apps.filter(a=>a.androidPkg).length}</small></div>
   <div className="metric"><span>광고 수익 합</span><strong>{totals.revN?'$'+totals.rev.toFixed(2):'—'}</strong><small>AdMob · 앱 {totals.revN}/{apps.length}</small></div>
  </div>
  <div className="sectiontitle"><h2>앱 비교</h2><div className="viewmode" role="group" aria-label="표 모드"><button type="button" className={!wideTable?'selected':''} aria-pressed={!wideTable} onClick={()=>setWideTable(false)}>핵심</button><button type="button" className={wideTable?'selected':''} aria-pressed={wideTable} onClick={()=>setWideTable(true)}>확장</button></div></div>
 </>}
 {page==='overview'&&appsLoaded&&!apps.length&&!appsError&&<div className="empty"><h2>등록된 앱이 없습니다</h2><p>Connections에서 앱을 추가하세요.</p><p className="note"><Link href="/connections">데이터 연결로 이동</Link></p></div>}
 {page==='overview'&&!!apps.length&&<div className="tablewrap"><table><thead><tr><th>앱</th><th>DAU</th><th>Play 설치</th><th>수익</th>{wideTable&&<><th>활성</th><th>신규</th><th>ASC</th><th>세션</th><th>eCPM</th><th>CTR</th></>}</tr></thead><tbody>{apps.map(a=>{const row=compare[a.id];const ascPending=!!a.appleAppId&&!!row?.store&&row.store.ascDownloads==null;return <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>router.push(`/apps/${a.id}`)}><td><div className="applink"><span className="appicon" style={{boxShadow:`inset 0 0 0 2px ${appColor(a.id)}`}}>{a.symbol||a.name.slice(0,1)}</span><span><span className="appdot" style={{background:appColor(a.id)}} aria-hidden/>{a.name}<small>{a.androidPkg||a.id}{row?.store?.playSource?` · ${row.store.playSource}`:''}{row?.ga4Error?' · GA4 오류':''}</small></span></div></td><td>{row?.ga4?row.ga4.averageDau.toLocaleString():'—'}</td><td>{playCell(a,row)}</td><td>{row?.admob?'$'+row.admob.revenue.toFixed(2):'—'}</td>{wideTable&&<><td>{row?.ga4?row.ga4.activeUsers.toLocaleString():'—'}</td><td>{row?.ga4?(row.ga4.newUsers??0).toLocaleString():'—'}</td><td>{row?.store?.ascDownloads!=null?row.store.ascDownloads.toLocaleString():ascPending?<span className="batchwait" onClick={e=>e.stopPropagation()}><Link href="/connections">배치 대기</Link></span>:(a.appleAppId?'—':'iOS 미출시')}</td><td>{row?.ga4?row.ga4.sessions.toLocaleString():'—'}</td><td>{row?.admob?'$'+row.admob.ecpm.toFixed(2):'—'}</td><td>{row?.admob?(row.admob.ctr*100).toFixed(2)+'%':'—'}</td></>}</tr>;})}</tbody></table></div>}

 {(!!current||(page==='overview'&&showDeep))&&<>
  <GA4Live apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os}/>
  <AdmobLive apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os}/>
  <StoreLive apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate}/>
 </>}
 {page==='overview'&&!!apps.length&&<div className="deeptoggle"><button type="button" className="refresh" onClick={()=>setShowDeep(v=>!v)}>{showDeep?'상세 리포트 접기':'GA4 · AdMob · 스토어 상세 펼치기'}</button><p className="note">앱 행을 클릭하면 해당 앱 상세로 이동합니다.</p></div>}
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
 {page==='connections'&&<>
 <section className="verifychecklist" id="checklist"><div className="sectiontitle"><h2>필수 연결 체크</h2><span>{checklist.filter(c=>c.ok).length}/{checklist.length}</span></div>
 <ul className="checklist">{checklist.map(c=><li key={c.label} className={c.ok?'ok':''}><span>{c.ok?'✓':'○'}</span><a href={c.href}>{c.label}</a></li>)}</ul>
 <p className="note">Play 설치 = ① JSON 키 → ② GCS 버킷 → ③ 스토어 배치. 버킷만 있어도 실시간 CSV 합계는 가능합니다.</p>
 </section>
 {(showForm||editing)&&<section className="ga4setup" id="apps"><div className="sectiontitle"><h2>{editing?'앱 수정':'앱 추가'}</h2></div><AppForm initial={editing||undefined} onCancel={()=>{setShowForm(false);setEditing(null);}} onSaved={app=>{setApps(list=>{const next=list.filter(a=>a.id!==app.id);next.push(app);return next.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));});setShowForm(false);setEditing(null);if(!editing)router.push(`/apps/${app.id}`);}}/></section>}
 <div className="sectiontitle" id="apps"><h2>등록된 앱</h2><span>{apps.length} active</span></div>
 {appsError&&<p className="note" role="status">{appsError}</p>}
 {!appsError&&!apps.length&&appsLoaded&&<div className="empty"><h2>시드 앱이 없습니다</h2><p>D1 마이그레이션 적용 후 새로고침하거나 앱을 추가하세요.</p></div>}
 <div className="appslist">{apps.map(a=>{const b=appBadges(a);return <div className="approw" key={a.id}><span className="appicon" style={{boxShadow:`inset 0 0 0 2px ${appColor(a.id)}`}}>{a.symbol||a.name.slice(0,1)}</span><div className="meta"><strong><span className="appdot" style={{background:appColor(a.id)}} aria-hidden/><Link href={`/apps/${a.id}`}>{a.name}</Link></strong><span>{a.id}{a.androidPkg?` · ${a.androidPkg}`:''}{a.appleAppId?` · ASC ${a.appleAppId}`:''}</span></div><div className="badges"><span className={'pill '+(b.ga4?'ok':'warn')}>GA4</span><span className={'pill '+(b.admob?'ok':'warn')}>AdMob</span><span className={'pill '+(b.play?'ok':'warn')}>Play</span><span className={'pill '+(b.asc?'ok':'warn')}>ASC</span><span className="pill">AF 메타</span></div><button type="button" className="refresh" onClick={()=>{setShowForm(false);setEditing(a);}}>수정</button></div>;})}</div>
 {!!missingAsc.length&&<p className="note">iOS 출시 전이면 ASC/Apple ID는 나중에 넣으면 됩니다. 출시 후 앱 수정에서 Apple ID를 등록하세요.</p>}
 <div id="ga4"><GA4Setup/></div><div id="admob"><AdmobSetup/></div><div id="play"><PlaySetup/></div><AscSetup/><StoreBatchPanel/>
 <div className="connectionlist">{[
 ['AppsFlyer','무료 Zero — Pull API 없음. 앱 ID만 보관합니다.','유료/트라이얼 전환 시 Aggregate 연동을 검토합니다.'],
 ['Firebase / GA4','앱별 GA4 속성 ID를 레지스트리에 저장합니다.','위 GA4 연결 화면에서 서비스 계정을 등록하면 속성 조회를 검증합니다.'],
 ['스토어 배치','Play GCS CSV · ASC Sales Report → D1.','매일 UTC 21:00 또는 수동 실행.']
 ].map(([name,first,second])=><section className="connection" key={name}><div className="sectiontitle"><h2>{name}</h2><span className="status">안내</span></div><p>{first}</p><p>{second}</p></section>)}</div>
 <section className="projectids"><h2>AdMob 게시자</h2><p className="note">게시자 ID: {admobPublisherId} · 앱별 ca-app-pub ID는 앱 행에 저장</p></section>
 </>}
 <nav className="utilitylinks" aria-label="대시보드 관리"><Link href="/progress">진행상황 {doneBase}/13</Link><Link href="/connections">데이터 연결</Link></nav></main></div></div>;
}
