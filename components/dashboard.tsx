import {useEffect,useState} from 'react';
import Link from '@/client/navigation';
import {useRouter} from '@/client/navigation';
import {ArrowUpRight,Check,ChevronRight,CalendarDays} from 'lucide-react';
import {apps} from '@/lib/apps';
import GA4Live from './ga4-live';
import GA4Setup from './ga4-setup';
import AdmobSetup from './admob-setup';
import AdmobLive from './admob-live';
import {admobPublisherId,admobApps} from '@/lib/admob-config';
const tasks=[
['화면 구조와 디자인 확정','완료','B 앱 비교형 메인 / C 서비스별 분석형 앱 상세. 흑백·회색 중심.'],
['메인과 앱별 상세 페이지','완료','만세력·스도쿠 고유 주소, 상단 풀다운과 앱 이름으로 이동. 탭 메뉴 제거 완료.'],
['기간·국가·OS 필터','완료','실제 GA4·AdMob 조회에 적용. 데이터가 없으면 조회 결과에 따라 표시.'],
['진행상황 및 연결 안내','완료','작업별 상태, 연결에 필요한 정보와 서비스별 미연결 상태 표시.'],
['GA4 인증 등록 화면','완료','브라우저 암호화, 서버 보관, 두 속성 권한 자동 검증 구현. 사용자 키 등록 후 실제 데이터 사용 가능.'],
['GA4 서버 조회 구현','완료','서비스 계정 인증, 앱별 허용 속성, 국가·OS 필터, 기간 활성 사용자와 일평균 DAU 분리 구현. 실제 계정 검증은 대기.'],
['GA4 실제 데이터 화면','완료','실제 조회·새로고침 및 앱별 연결 상태·오류 표시 구현.'],
['GA4 자동 검증','완료','서명, 요청 필터, 사용자 중복 집계 방지, 무데이터와 오류 응답 자동 검증.'],
['GA4 실제 계정 조회 검증','설정 필요','Viewer 권한과 API 사용 설정은 사용자 확인 완료. 데이터 연결 페이지에서 JSON 키 등록 후 검증.'],
['AdMob 광고 수익 연동','대기','게시자 ID와 앱·OS별 ID 4개 등록 완료. AdMob API와 Google OAuth 인증 후 수익·노출·eCPM 연동.'],
['AppsFlyer 유입 연동','대기','요금제와 API 권한 확인 후 설치·국가·매체별 지표 수집.'],
['자동 갱신·오류 처리','대기','실제 연동 후 수집 시각, 지연, 실패·재시도 처리와 안전한 서버 보관 구현.'],
['원본 콘솔 수치 대조','대기','동일 기간·시간대·통화·OS 기준으로 실제 수치 검증.']];
export default function Dashboard({page}:{page:string}){
 const router=useRouter();
 const [ga4Verified,setGa4Verified]=useState(false),[admobVerified,setAdmobVerified]=useState(false);
 useEffect(()=>{fetch('/api/admob/setup',{cache:'no-store'}).then(async r=>{if(r.ok){const v=await r.json() as {verifiedAt:string|null};setAdmobVerified(!!v.verifiedAt);}}).catch(()=>{});},[]);
 useEffect(()=>{fetch('/api/ga4/setup',{cache:'no-store'}).then(async r=>{if(!r.ok)return;const v=await r.json() as {configured:boolean,checks?:{ok:boolean}[]};setGa4Verified(v.checks?.length===2&&v.checks.every(c=>c.ok));}).catch(()=>{});},[]);
 const [days,setDays]=useState(7),[country,setCountry]=useState('all'),[os,setOs]=useState('all');
 const current=apps.find(a=>a.id===page),report=page==='overview'||!!current;
 const title=current?.name||({overview:'서비스 현황',progress:'진행상황',connections:'데이터 연결'} as Record<string,string>)[page];
 return <div className="shell">
 <div className="workspace"><header><div>워크스페이스 <ChevronRight size={13}/><select className="pagepicker" aria-label="페이지 및 앱 선택" value={page} onChange={e=>router.push(({overview:'/',bazi:'/apps/bazi',sudoku:'/apps/sudoku',progress:'/progress',connections:'/connections'} as Record<string,string>)[e.target.value])}><option value="overview">서비스 현황</option>{apps.map(app=><option key={app.id} value={app.id}>{app.name}</option>)}{!report&&<option value={page}>{title}</option>}</select></div><form method="post" action="/api/auth/logout"><button className="refresh">로그아웃</button></form></header><main><div className="titleline"><div><div className="eyebrow">{page==='overview'?'OVERVIEW':current?'APP REPORT':page==='progress'?'PROJECT STATUS':'CONNECTIONS'}</div><h1>{title}</h1><p className="subtitle">{current?current.pkg:page==='overview'?'운영하는 앱의 유입, 활동, 수익을 한눈에.':page==='progress'?'화면 구현부터 실제 데이터 검증까지 단계별로 진행합니다.':'각 서비스의 접근 권한과 앱 식별자를 연결합니다.'}</p></div></div>
 {report&&<><div className="notice"><span className="dot"/>GA4와 AdMob의 실제 보고서를 조회합니다. AppsFlyer는 아직 미연결입니다.<Link href="/connections">연결 안내 <ArrowUpRight size={13}/></Link></div><div className="filterbar"><CalendarDays size={15}/><label>기간<select aria-label="기간" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>최근 7일</option><option value={14}>최근 14일</option><option value={30}>최근 30일</option></select></label><label>국가<select aria-label="국가" value={country} onChange={e=>setCountry(e.target.value)}><option value="all">전체 국가</option><option value="KR">한국</option><option value="JP">일본</option><option value="US">미국</option></select></label><label>OS<select aria-label="OS" value={os} onChange={e=>setOs(e.target.value)}><option value="all">전체 OS</option><option value="android">Android</option><option value="ios">iOS</option></select></label><span className="range">각 데이터 제공 서비스의 시간대 기준</span></div>
 <GA4Live app={current?.id} days={days} country={country} os={os}/>
 <AdmobLive app={current?.id} days={days} country={country} os={os}/>
 </>}
 {page==='progress'&&<><div className="progresssummary"><div><strong>{8+Number(ga4Verified)+Number(admobVerified)} <span>/ 13</span></strong><p>완료한 작업</p></div><div className="progressbar"><div style={{width:`${(8+Number(ga4Verified)+Number(admobVerified))/13*100}%`}}/></div><span>{ga4Verified?'두 앱 실제 조회 검증 완료':'GA4 연결 및 권한 확인 진행 중'}</span></div>{tasks.map(([name,originalStatus,originalDetail],i)=>{const verified=(name==='GA4 실제 계정 조회 검증'&&ga4Verified)||(name==='AdMob 광고 수익 연동'&&admobVerified);const status=verified?'완료':originalStatus,detail=verified?(name==='AdMob 광고 수익 연동'?'실제 AdMob 보고서 조회 성공을 확인했습니다.':'두 앱의 실제 GA4 보고서 조회 성공을 확인했습니다.'):originalDetail;return <article className="task" key={name}><span className={'taskicon '+(status==='완료'?'done':'')}>{status==='완료'?<Check size={16}/>:String(i+1).padStart(2,'0')}</span><div><h2>{name}</h2><p>{detail}</p></div><span className="status">{status}</span></article>})}<p className="note">2026.11.08 기준 · 작업이 완료될 때 갱신합니다. 화면 구현과 실제 데이터 검증은 별도로 관리합니다.</p></>}
 {page==='connections'&&<><GA4Setup/><AdmobSetup/><div className="connectionlist">{[
 ['AppsFlyer','Android 앱 ID는 등록된 패키지명으로 확인할 수 있습니다.','API 사용 가능 요금제와 권한, 설치 집계 API 범위 확인이 필요합니다.'],
 ['Firebase / GA4','두 앱의 Firebase 프로젝트 ID와 GA4 속성 ID를 등록했습니다.','위 GA4 연결 화면에서 인증 정보를 등록하면 두 속성의 실제 보고서를 자동 검증합니다.'],
 ['Google AdMob','게시자 ID와 Android·iOS 앱 ID 4개를 등록했습니다.','위 AdMob 수익 연결에서 Google 승인을 진행하면 실제 보고서를 조회합니다.']
 ].map(([name,first,second])=><section className="connection" key={name}><div className="sectiontitle"><h2>{name}</h2><span className="status">설정 필요</span></div><p>{first}</p><p>{second}</p></section>)}</div><section className="projectids"><h2>AdMob 앱 연결 정보</h2><p className="note">게시자 ID: {admobPublisherId} · ID 등록 완료 / 수익 조회 인증 대기</p><div className="tablewrap"><table><thead><tr><th>앱</th><th>OS</th><th>AdMob 앱 ID</th></tr></thead><tbody>{admobApps.map(a=><tr key={a.appId}><td>{a.name}</td><td>{a.os==='ios'?'iOS':'Android'}</td><td>{a.appId}</td></tr>)}</tbody></table></div><p className="note">Android와 iOS는 별도 앱 ID로 구분합니다. 데이터가 없는 앱은 조회 결과에 따라 표시하며, ID 등록만으로 출시 여부를 판단하지 않습니다.</p></section><section className="projectids"><h2>앱별 연결 정보</h2><div className="tablewrap"><table><thead><tr><th>앱</th><th>Firebase 프로젝트 ID</th><th>GA4 속성 ID</th></tr></thead><tbody>{apps.map(app=><tr key={app.id}><td>{app.name}</td><td>{app.firebaseProjectId}</td><td>{app.ga4PropertyId}</td></tr>)}</tbody></table></div><p className="note">사용자 제공 Firebase 프로젝트 ID와 GA4 속성 ID를 앱별로 등록했습니다. 실제 계정 접근과 데이터 조회는 아직 검증하지 않았습니다.</p><p>설정 확인: GA4 뷰어 권한 추가 및 Data API 활성화 완료(사용자 확인). 실제 연결 상태는 위에서 확인하세요.</p><a href="https://developers.google.com/analytics/devguides/reporting/data/v1/property-id" target="_blank" rel="noreferrer">Google 공식 안내 ↗</a></section></>}
 <nav className="utilitylinks" aria-label="대시보드 관리"><Link href="/progress">진행상황 {8+Number(ga4Verified)+Number(admobVerified)}/13</Link><Link href="/connections">데이터 연결</Link></nav></main></div></div>
}
