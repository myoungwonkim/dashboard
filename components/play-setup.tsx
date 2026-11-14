import {useEffect,useRef,useState} from 'react';
import {seal} from '@/lib/admob-crypto.mjs';
type Setup={configured:boolean;createdAt:string|null;verifiedAt:string|null;gcsBucket:string|null;publicKey:JsonWebKey;kid:string};

/** Accept full gs:// URI or bare bucket name → pubsite_prod_rev_… */
function normalizeBucketInput(raw:string){
 let v=raw.trim();
 if(!v)return '';
 v=v.replace(/^gs:\/\//i,'');
 v=v.split('/')[0]||'';
 return v.trim();
}

export default function PlaySetup(){
 const [setup,setSetup]=useState<Setup|null>(null),[file,setFile]=useState<File|null>(null),[bucket,setBucket]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('Play 연결 상태 확인 중…');
 const input=useRef<HTMLInputElement>(null);
 async function refresh(){try{const r=await fetch('/api/play/setup',{cache:'no-store'});const v=await r.json() as Setup & {message?:string};if(!r.ok)throw Error(v.message);setSetup(v);setBucket(v.gcsBucket||'');setMessage(v.configured?(v.gcsBucket?'Play 연결·GCS 버킷이 등록되어 있습니다. 아래 스토어 배치를 한 번 실행하면 설치 수가 Overview에 채워집니다.':'Play 서비스 계정은 등록됨. 설치 수를 보려면 GCS 버킷을 추가하고 「버킷만 저장」을 누르세요.'):'Play Console에 초대한 서비스 계정 JSON을 등록하세요.');}catch(e){setMessage(e instanceof Error?e.message:'상태를 불러오지 못했습니다.');}}
 useEffect(()=>{void refresh();},[]);
 async function connect(){
  if(!file||!setup||busy)return;setBusy(true);
  try{
   if(file.size>20000)throw Error('서비스 계정 JSON 파일을 확인해 주세요.');
   const account=JSON.parse(await file.text());
   if(account.type!=='service_account')throw Error('Play 서비스 계정 JSON이 아닙니다.');
   const envelope=await seal({type:'service_account',client_email:account.client_email,private_key:account.private_key,project_id:account.project_id},setup.publicKey,setup.kid,'play');
   const gcsBucket=normalizeBucketInput(bucket)||null;
   const r=await fetch('/api/play/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...envelope,gcsBucket,action:setup.configured?'replace':undefined})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message||'등록 실패');
   setFile(null);if(input.current)input.current.value='';setMessage(v.message||'등록했습니다.');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Play 연결에 실패했습니다.');}
  finally{setBusy(false);}
 }
 async function saveBucket(){
  if(!setup?.configured||busy)return;setBusy(true);
  try{
   const gcsBucket=normalizeBucketInput(bucket)||null;
   setBucket(gcsBucket||'');
   const r=await fetch('/api/play/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bucket',gcsBucket})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message||'버킷 저장 실패');
   setMessage(v.message||'버킷을 저장했습니다.');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'버킷 저장에 실패했습니다.');}
  finally{setBusy(false);}
 }
 return <section className="safenote ga4setup" id="play"><div className="sectiontitle"><h2>Google Play 연결</h2><span className="status">{setup?.configured?(setup.gcsBucket?'키·버킷 완료':'키만 완료'):'등록 대기'}</span></div>
 <p role="status" aria-live="polite">{message}</p>
 <div className="playsteps" aria-label="Play 설치 3단계">
  <div className={'playstep '+(setup?.configured?'done':'')}>1 키</div>
  <div className={'playstep '+(setup?.gcsBucket?'done':'')}>2 버킷</div>
  <div className="playstep">3 배치</div>
 </div>
 <ol>
  <li><strong>서비스 계정 초대</strong>: Play Console → <strong>사용자 및 권한</strong> → 사용자 초대. 서비스 계정 이메일을 넣고 권한은 최소한 <strong>앱 정보 보기(전체)</strong>.</li>
  <li><strong>Cloud Storage URI 복사</strong> (앱 안 「통계」 화면 아님)
   <ol className="nested">
    <li>Play Console 왼쪽 맨 위 <strong>집(홈)</strong> → 앱 화면에서 나감</li>
    <li><strong>다운로드 보고서</strong>(또는 계정 관리 → Google Play 앱 보고서) → <strong>통계</strong></li>
    <li>설치 섹션 제목 오른쪽 <strong>Cloud Storage URI 복사</strong></li>
    <li>복사 예: <code>gs://pubsite_prod_rev_0123456789/stats/…</code></li>
   </ol>
  </li>
  <li><strong>어디에 붙여넣나</strong> — 이 대시보드 페이지입니다.
   <ol className="nested">
    <li>브라우저에서 <a href="/connections">https://dashboard.nolsoopgames.com/connections</a> 열기 (데이터 연결)</li>
    <li>아래로 스크롤 → 제목 <strong>Google Play 연결</strong> 섹션</li>
    <li>입력칸 라벨 <strong>GCS 버킷</strong> (placeholder: <code>pubsite_prod_rev_…</code>)에 붙여넣기</li>
    <li>전체 URI를 붙여넣어도 됩니다. 저장 시 <code>gs://</code>와 경로를 자동으로 빼고 버킷 이름만 남깁니다.</li>
    <li>이미 키가 등록돼 있으면 <strong>버킷만 저장</strong> 버튼을 누릅니다. 키를 같이 올릴 때는 JSON 선택 후 <strong>암호화하여 연결</strong>.</li>
    <li>그다음 같은 페이지 아래 <strong>스토어 배치 → 지금 배치 실행</strong></li>
    <li>Overview로 가서 <strong>새로고침</strong> → Play 설치 열 확인</li>
   </ol>
  </li>
 </ol>
 <div className="setupactions">
  <label className="filelabel">서비스 계정 JSON<input ref={input} type="file" accept=".json,application/json" disabled={!setup||busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
  <label className="filelabel">GCS 버킷 (여기에 URI/버킷 이름 붙여넣기)<input value={bucket} onChange={e=>setBucket(e.target.value)} onBlur={()=>setBucket(normalizeBucketInput(bucket))} placeholder="pubsite_prod_rev_… 또는 gs://pubsite_prod_rev_…/…" disabled={busy} aria-describedby="gcs-bucket-help"/></label>
  <button className="setupbutton" type="button" disabled={!file||!setup||busy} onClick={()=>void connect()}>{busy?'확인 중…':setup?.configured?'키 교체':'암호화하여 연결'}</button>
  {setup?.configured&&<button className="refresh" type="button" disabled={busy||!normalizeBucketInput(bucket)} onClick={()=>void saveBucket()}>버킷만 저장</button>}
 </div>
 <p id="gcs-bucket-help" className="note"><strong>붙여넣기 위치 = 바로 위 「GCS 버킷」 입력칸</strong>입니다. Play Console이 아니라 이 Connections 페이지입니다. Reporting API는 크래시·ANR만 주고, 설치 수는 이 버킷의 CSV로 채웁니다.</p>
 </section>;
}
