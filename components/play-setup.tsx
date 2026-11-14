import {useEffect,useRef,useState} from 'react';
import {seal} from '@/lib/admob-crypto.mjs';
type Setup={configured:boolean;createdAt:string|null;verifiedAt:string|null;gcsBucket:string|null;publicKey:JsonWebKey;kid:string};
export default function PlaySetup(){
 const [setup,setSetup]=useState<Setup|null>(null),[file,setFile]=useState<File|null>(null),[bucket,setBucket]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('Play 연결 상태 확인 중…');
 const input=useRef<HTMLInputElement>(null);
 async function refresh(){try{const r=await fetch('/api/play/setup',{cache:'no-store'});const v=await r.json() as Setup & {message?:string};if(!r.ok)throw Error(v.message);setSetup(v);setBucket(v.gcsBucket||'');setMessage(v.configured?(v.gcsBucket?'Play 연결·GCS 버킷이 등록되어 있습니다. 아래 스토어 배치를 한 번 실행하면 설치 수가 Overview에 채워집니다.':'Play 서비스 계정은 등록됨. 설치 수를 보려면 GCS 버킷을 추가하고 스토어 배치를 실행하세요.'):'Play Console에 초대한 서비스 계정 JSON을 등록하세요.');}catch(e){setMessage(e instanceof Error?e.message:'상태를 불러오지 못했습니다.');}}
 useEffect(()=>{void refresh();},[]);
 async function connect(){
  if(!file||!setup||busy)return;setBusy(true);
  try{
   if(file.size>20000)throw Error('서비스 계정 JSON 파일을 확인해 주세요.');
   const account=JSON.parse(await file.text());
   if(account.type!=='service_account')throw Error('Play 서비스 계정 JSON이 아닙니다.');
   const envelope=await seal({type:'service_account',client_email:account.client_email,private_key:account.private_key,project_id:account.project_id},setup.publicKey,setup.kid,'play');
   const r=await fetch('/api/play/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...envelope,gcsBucket:bucket.trim()||null,action:setup.configured?'replace':undefined})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message||'등록 실패');
   setFile(null);if(input.current)input.current.value='';setMessage(v.message||'등록했습니다.');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Play 연결에 실패했습니다.');}
  finally{setBusy(false);}
 }
 async function saveBucket(){
  if(!setup?.configured||busy)return;setBusy(true);
  try{
   const r=await fetch('/api/play/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bucket',gcsBucket:bucket.trim()||null})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message||'버킷 저장 실패');
   setMessage(v.message||'버킷을 저장했습니다.');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'버킷 저장에 실패했습니다.');}
  finally{setBusy(false);}
 }
 return <section className="safenote ga4setup"><div className="sectiontitle"><h2>Google Play 연결</h2><span className="status">{setup?.configured?(setup.gcsBucket?'키·버킷 완료':'키만 완료'):'등록 대기'}</span></div>
 <p role="status" aria-live="polite">{message}</p>
 <div className="playsteps" aria-label="Play 설치 3단계">
  <div className={'playstep '+(setup?.configured?'done':'')}>1 키</div>
  <div className={'playstep '+(setup?.gcsBucket?'done':'')}>2 버킷</div>
  <div className="playstep">3 배치</div>
 </div>
 <ol>
  <li><strong>서비스 계정 초대</strong>: Play Console → <strong>사용자 및 권한</strong> → 사용자 초대. 서비스 계정 이메일을 넣고 권한은 최소한 <strong>앱 정보 보기(전체)</strong>. 재무까지면 <strong>재무 데이터 보기</strong>도 켭니다.</li>
  <li><strong>GCS 버킷 이름 복사</strong> — <em>앱 안 「통계」 화면이 아닙니다.</em>
   <p className="note">지금 보신 <strong>통계 → 앱 통계 → 보고서 내보내기</strong>는 화면용 내보내기이고, 대시보드가 쓰는 <code>pubsite_prod_rev_…</code> 버킷 URI가 아닙니다.</p>
   <ol className="nested">
    <li>왼쪽 맨 위 <strong>집(홈)</strong>을 눌러 특정 앱 화면에서 나갑니다. (모든 앱 / 개발자 계정 홈)</li>
    <li>왼쪽 메뉴를 <strong>아래로 끝까지</strong> 내리거나, 계정/설정 쪽에서 <strong>다운로드 보고서</strong> 또는 <strong>계정 관리 → Google Play 앱 보고서</strong>를 엽니다.</li>
    <li>그중 <strong>통계</strong>(Statistics)를 선택합니다. 페이지 제목 근처에 <strong>Cloud Storage URI 복사</strong> 버튼이 있습니다.</li>
    <li>복사된 값 예: <code>gs://pubsite_prod_rev_0123456789/stats/…</code> → 아래 칸에는 <strong>가운데 버킷 이름만</strong>: <code>pubsite_prod_rev_0123456789</code></li>
   </ol>
  </li>
  <li>서비스 계정 JSON 키를 아래에서 등록합니다.</li>
  <li>아래 <strong>스토어 배치</strong>를 한 번 실행합니다. (매일 UTC 21:00 ≈ KST 06:00)</li>
 </ol>
 <div className="setupactions">
  <label className="filelabel">서비스 계정 JSON<input ref={input} type="file" accept=".json,application/json" disabled={!setup||busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
  <label className="filelabel">GCS 버킷<input value={bucket} onChange={e=>setBucket(e.target.value)} placeholder="pubsite_prod_rev_…" disabled={busy}/></label>
  <button className="setupbutton" type="button" disabled={!file||!setup||busy} onClick={()=>void connect()}>{busy?'확인 중…':setup?.configured?'키 교체':'암호화하여 연결'}</button>
  {setup?.configured&&<button className="refresh" type="button" disabled={busy} onClick={()=>void saveBucket()}>버킷만 저장</button>}
 </div>
 <p className="note">Reporting API는 크래시·ANR(바이탈)만 제공합니다. 설치·평점·국가 분해는 GCS CSV(+배치)가 필요합니다. Play Console CSV는 UTF-16(압축)인 경우가 많아, 대시보드는 이를 자동 복호화합니다. 버킷만 있어도 Overview는 실시간 합계를 채울 수 있습니다.</p>
 </section>;
}
