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
 <ol>
  <li>Play Console → 사용자 및 권한 → 새 사용자에 서비스 계정 초대 (앱 정보 보기·재무 데이터·리뷰 응답 등 읽기)</li>
  <li><strong>설치 수용 GCS 버킷</strong>: Play Console → 다운로드 리포트(또는 설정 → API 액세스)에서 Cloud Storage URI의 버킷 이름만 복사합니다. 예: <code>pubsite_prod_rev_0123456789</code> (<code>gs://</code>·경로 제외)</li>
  <li>서비스 계정에 해당 버킷 읽기 권한이 있는지 확인한 뒤 JSON 키를 등록합니다.</li>
  <li>아래 <strong>스토어 배치</strong>를 한 번 실행합니다. (또는 UTC 21:00 cron) 배치 전에는 Overview에 「배치 대기」가 보입니다.</li>
 </ol>
 <div className="setupactions">
  <label className="filelabel">서비스 계정 JSON<input ref={input} type="file" accept=".json,application/json" disabled={!setup||busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
  <label className="filelabel">GCS 버킷<input value={bucket} onChange={e=>setBucket(e.target.value)} placeholder="pubsite_prod_rev_…" disabled={busy}/></label>
  <button className="setupbutton" type="button" disabled={!file||!setup||busy} onClick={()=>void connect()}>{busy?'확인 중…':setup?.configured?'키 교체':'암호화하여 연결'}</button>
  {setup?.configured&&<button className="refresh" type="button" disabled={busy} onClick={()=>void saveBucket()}>버킷만 저장</button>}
 </div>
 <p className="note">Reporting API는 크래시·ANR(바이탈)만 제공합니다. 설치·평점·국가 분해는 GCS CSV(+배치)가 필요합니다. 버킷이 있으면 조회 시 CSV를 실시간으로도 읽어 설치 합계를 채울 수 있습니다.</p>
 </section>;
}
