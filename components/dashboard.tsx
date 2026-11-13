import DateRangePicker from './date-range-picker';
import {presetRange,validateRange} from '@/lib/date-range.mts';
import {useEffect,useMemo,useState} from 'react';
import Link from '@/client/navigation';
import {useRouter} from '@/client/navigation';
import {ArrowUpRight,Check,ChevronRight} from 'lucide-react';
import {appBadges,type AppRecord} from '@/lib/apps';
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
type StoreRow={playInstalls?:number|null;ascDownloads?:number|null};

export default function Dashboard({page}:{page:string}){
 const router=useRouter();
 const [apps,setApps]=useState<AppRecord[]>([]);
 const [appsLoaded,setAppsLoaded]=useState(false);
 const [appsError,setAppsError]=useState('');
 const [appsRetry,setAppsRetry]=useState(0);
 const [ga4Verified,setGa4Verified]=useState(false),[admobVerified,setAdmobVerified]=useState(false);
 const [showForm,setShowForm]=useState(false);
 const [editing,setEditing]=useState<AppRecord|null>(null);
 const [compare,setCompare]=useState<Record<string,{ga4?:Ga4Row;admob?:AdmobRow;store?:StoreRow}>>({});
 useEffect(()=>{
  setAppsError('');
  fetch('/api/apps',{cache:'no-store'}).then(async r=>{
   if(!r.ok){setAppsError(r.status===401?'로그인이 필요합니다.':'앱 목록을 불러오지 못했습니다.');setApps([]);return;}
   const v=await r.json() as {apps?:AppRecord[];message?:string};
   setApps(v.apps||[]);
  }).catch(()=>{setAppsError('앱 목록을 불러오지 못했습니다.');setApps([]);}).finally(()=>setAppsLoaded(true));
 },[appsRetry]);
 useEffect(()=>{fetch('/api/admob/setup',{cache:'no-store'}).then(async r=>{if(r.ok){const v=await r.json() as {verifiedAt:string|null};setAdmobVerified(!!v.verifiedAt);}}).catch(()=>{});},[]);
 useEffect(()=>{fetch('/api/ga4/setup',{cache:'no-store'}).then(async r=>{if(!r.ok)return;const v=await r.json() as {configured:boolean,checks?:{ok:boolean}[]};setGa4Verified(!!v.checks?.length&&v.checks.every(c=>c.ok));}).catch(()=>{});},[]);
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
 const needsSetup=!ga4Verified||!admobVerified||apps.some(a=>!a.androidPkg)||!!missingAsc.length;

 useEffect(()=>{
  if(page!=='overview'||!apps.length)return;
  const controller=new AbortController();
  setCompare({});
  Promise.all(apps.map(async a=>{
   const next:{ga4?:Ga4Row;admob?:AdmobRow;store?:StoreRow}={store:{}};
   if(a.ga4PropertyId){
    try{const res=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate,country,os}),signal:controller.signal});const body=await res.json() as {status:string;data?:Ga4Row};if(res.ok&&body.status==='success'&&body.data)next.ga4=body.data;}catch{}
   }
   if(a.admobAndroidAppId||a.admobIosAppId){
    try{const res=await fetch('/api/admob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate:dateRange.startDate,endDate:dateRange.endDate,country,os}),signal:controller.signal});const body=await res.json() as {status:string;data?:AdmobRow&{ctr?:number;clicks:number;impressions:number}};if(res.ok&&body.status==='success'&&body.data)next.admob={...body.data,ctr:body.data.ctr??(body.data.impressions?body.data.clicks/body.data.impressions:0)};}catch{}
   }
   if(a.androidPkg){
    try{const res=await fetch('/api/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days}),signal:controller.signal});const body=await res.json() as {status:string;data?:{installs:number|null}};if(res.ok&&body.status==='success')next.store!.playInstalls=body.data?.installs??null;}catch{}
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

 return <div className="shell">
 <div className="workspace"><header><div>워크스페이스 <ChevronRight size={13}/><select className="pagepicker" aria-label="페이지 및 앱 선택" value={page==='overview'||page==='progress'||page==='connections'?page:(current?page:'overview')} onChange={e=>{const v=e.target.value;router.push(v==='overview'?'/':v==='progress'?'/progress':v==='connections'?'/connections':`/apps/${v}`);}}>{pageOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div><form method="post" action="/api/auth/logout"><button className="refresh">로그아웃</button></form></header><main><div className="titleline"><div><div className="eyebrow">{page==='overview'?'OVERVIEW':current?'APP REPORT':page==='progress'?'PROJECT STATUS':'CONNECTIONS'}</div><h1>{title}</h1><p className="subtitle">{current?(current.androidPkg||current.id):page==='overview'?'운영하는 앱의 유입, 활동, 수익을 한눈에.':page==='progress'?'P0–P3 코드는 배포됨. 남은 항목은 계정 연결과 수치 대조입니다.':'계정 연결과 앱 식별자를 등록합니다.'}</p></div>{page==='connections'&&!showForm&&!editing&&<button type="button" className="setupbutton" onClick={()=>{setEditing(null);setShowForm(true);}}>앱 추가</button>}</div>
 {appsError&&<div className="notice" role="status"><span className="dot"/>{appsError}<button type="button" className="refresh" onClick={()=>{setAppsLoaded(false);setAppsRetry(v=>v+1);}}>다시 시도</button></div>}
 {report&&<><div className="notice"><span className="dot"/>GA4·AdMob·스토어 실제 보고서를 조회합니다. AppsFlyer 무료(Zero)는 API 미연동입니다.<Link href="/connections">연결 안내 <ArrowUpRight size={13}/></Link></div>
 {page==='overview'&&needsSetup&&appsLoaded&&!appsError&&<div className="notice setuphint"><span className="dot"/>수치가 — 이면 미연결이거나 배치 전입니다. GA4 키 · AdMob OAuth · Play/ASC 키 · 앱 수정(Apple ID) · 스토어 배치를 Connections에서 완료하세요.<Link href="/connections">데이터 연결 <ArrowUpRight size={13}/></Link></div>}
 <div className="filterbar"><DateRangePicker value={dateRange} onChange={setDateRange}/><label>국가<select aria-label="국가" value={country} onChange={e=>setCountry(e.target.value)}><option value="all">전체 국가</option><option value="KR">한국</option><option value="JP">일본</option><option value="US">미국</option></select></label><label>OS<select aria-label="OS" value={os} onChange={e=>setOs(e.target.value)}><option value="all">전체 OS</option><option value="android">Android</option><option value="ios">iOS</option></select></label><span className="range">각 데이터 제공 서비스의 시간대 기준</span></div>
 {page==='overview'&&<div className="sectiontitle"><h2>앱 비교</h2><span>같은 필터 · 행 클릭 시 상세</span></div>}
 {page==='overview'&&appsLoaded&&!apps.length&&!appsError&&<div className="empty"><h2>등록된 앱이 없습니다</h2><p>마이그레이션·시드 후 Connections에서 앱을 추가하세요.</p><p className="note"><Link href="/connections">데이터 연결로 이동</Link></p></div>}
 {page==='overview'&&!!apps.length&&<div className="tablewrap"><table><thead><tr><th>앱</th><th>DAU</th><th>활성</th><th>신규</th><th>Play 설치</th><th>ASC 다운</th><th>세션</th><th>수익</th><th>eCPM</th><th>CTR</th></tr></thead><tbody>{apps.map(a=>{const row=compare[a.id];return <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>router.push(`/apps/${a.id}`)}><td><div className="applink"><span className="appicon">{a.symbol||a.name.slice(0,1)}</span><span>{a.name}<small>{a.androidPkg||a.id}</small></span></div></td><td>{row?.ga4?row.ga4.averageDau.toLocaleString():'—'}</td><td>{row?.ga4?row.ga4.activeUsers.toLocaleString():'—'}</td><td>{row?.ga4?(row.ga4.newUsers??0).toLocaleString():'—'}</td><td>{row?.store?.playInstalls!=null?row.store.playInstalls.toLocaleString():'—'}</td><td>{row?.store?.ascDownloads!=null?row.store.ascDownloads.toLocaleString():'—'}</td><td>{row?.ga4?row.ga4.sessions.toLocaleString():'—'}</td><td>{row?.admob?'$'+row.admob.revenue.toFixed(2):'—'}</td><td>{row?.admob?'$'+row.admob.ecpm.toFixed(2):'—'}</td><td>{row?.admob?(row.admob.ctr*100).toFixed(2)+'%':'—'}</td></tr>;})}</tbody></table></div>}
 <GA4Live apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os}/>
 <AdmobLive apps={apps} app={current?.id} days={days} startDate={dateRange.startDate} endDate={dateRange.endDate} country={country} os={os}/>
 <StoreLive apps={apps} app={current?.id} days={days}/>
 </>}
 {page==='progress'&&<><div className="progresssummary"><div><strong>{doneBase} <span>/ 13</span></strong><p>완료·검증한 작업</p></div><div className="progressbar"><div style={{width:`${doneBase/13*100}%`}}/></div><span>코드 {codeDone}/12 · {ga4Verified?'GA4 실조회 확인':'GA4 연결 대기'}{admobVerified?' · AdMob OAuth 확인':' · AdMob OAuth 대기'}</span></div>{tasks.map(([name,originalStatus,originalDetail],i)=>{const verified=(name==='GA4 인증 등록 화면'&&ga4Verified)||(name.startsWith('AdMob')&&admobVerified);const status=verified?'완료':originalStatus,detail=verified?(name.startsWith('AdMob')?'실제 AdMob 보고서 조회 성공을 확인했습니다.':'등록된 앱의 실제 GA4 보고서 조회 성공을 확인했습니다.'):originalDetail;const done=status==='완료'||status==='코드 완료'||status==='제외';return <article className="task" key={name}><span className={'taskicon '+(done?'done':'')}>{done?<Check size={16}/>:String(i+1).padStart(2,'0')}</span><div><h2>{name}</h2><p>{detail}</p></div><span className="status">{status}</span></article>})}<p className="note">P0–P3 기능 코드는 배포된 상태입니다. 「대기」는 본인 계정 연결·수치 대조만 남았다는 뜻입니다.</p></>}
 {page==='connections'&&<>
 {(showForm||editing)&&<section className="ga4setup"><div className="sectiontitle"><h2>{editing?'앱 수정':'앱 추가'}</h2></div><AppForm initial={editing||undefined} onCancel={()=>{setShowForm(false);setEditing(null);}} onSaved={app=>{setApps(list=>{const next=list.filter(a=>a.id!==app.id);next.push(app);return next.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));});setShowForm(false);setEditing(null);if(!editing)router.push(`/apps/${app.id}`);}}/></section>}
 <div className="sectiontitle"><h2>등록된 앱</h2><span>{apps.length} active</span></div>
 {appsError&&<p className="note" role="status">{appsError}</p>}
 {!appsError&&!apps.length&&appsLoaded&&<div className="empty"><h2>시드 앱이 없습니다</h2><p>D1 마이그레이션 적용 후 새로고침하거나 앱을 추가하세요.</p></div>}
 <div className="appslist">{apps.map(a=>{const b=appBadges(a);return <div className="approw" key={a.id}><span className="appicon">{a.symbol||a.name.slice(0,1)}</span><div className="meta"><strong><Link href={`/apps/${a.id}`}>{a.name}</Link></strong><span>{a.id}{a.androidPkg?` · ${a.androidPkg}`:''}{a.appleAppId?` · ASC ${a.appleAppId}`:''}</span></div><div className="badges"><span className={'pill '+(b.ga4?'ok':'warn')}>GA4</span><span className={'pill '+(b.admob?'ok':'warn')}>AdMob</span><span className={'pill '+(b.play?'ok':'warn')}>Play</span><span className={'pill '+(b.asc?'ok':'warn')}>ASC</span><span className="pill">AF 메타</span></div><button type="button" className="refresh" onClick={()=>{setShowForm(false);setEditing(a);}}>수정</button></div>;})}</div>
 {!!missingAsc.length&&<p className="note">ASC 수치가 안 보이면 앱 수정에서 Apple ID(숫자)를 입력하세요. 대상: {missingAsc.map(a=>a.name).join(', ')}</p>}
 <GA4Setup/><AdmobSetup/><PlaySetup/><AscSetup/><StoreBatchPanel/>
 <div className="connectionlist">{[
 ['AppsFlyer','무료 Zero — Pull API 없음. 앱 ID만 보관합니다.','유료/트라이얼 전환 시 Aggregate 연동을 검토합니다.'],
 ['Firebase / GA4','앱별 GA4 속성 ID를 레지스트리에 저장합니다.','위 GA4 연결 화면에서 서비스 계정을 등록하면 속성 조회를 검증합니다.'],
 ['스토어 배치','Play GCS CSV · ASC Sales Report → D1.','매일 UTC 21:00 또는 수동 실행.']
 ].map(([name,first,second])=><section className="connection" key={name}><div className="sectiontitle"><h2>{name}</h2><span className="status">안내</span></div><p>{first}</p><p>{second}</p></section>)}</div>
 <section className="projectids"><h2>AdMob 게시자</h2><p className="note">게시자 ID: {admobPublisherId} · 앱별 ca-app-pub ID는 앱 행에 저장</p></section>
 </>}
 <nav className="utilitylinks" aria-label="대시보드 관리"><Link href="/progress">진행상황 {doneBase}/13</Link><Link href="/connections">데이터 연결</Link></nav></main></div></div>;
}
