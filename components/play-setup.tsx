import {useEffect,useRef,useState} from 'react';
import {seal} from '@/lib/admob-crypto.mjs';
type Setup={configured:boolean;createdAt:string|null;verifiedAt:string|null;gcsBucket:string|null;publicKey:JsonWebKey;kid:string};
export default function PlaySetup(){
 const [setup,setSetup]=useState<Setup|null>(null),[file,setFile]=useState<File|null>(null),[bucket,setBucket]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('Play 연결 상태 확인 중…');
 const input=useRef<HTMLInputElement>(null);
 async function refresh(){try{const r=await fetch('/api/play/setup',{cache:'no-store'});const v=await r.json() as Setup & {message?:string};if(!r.ok)throw Error(v.message);setSetup(v);setBucket(v.gcsBucket||'');setMessage(v.configured?'Play 서비스 계정이 등록되어 있습니다. 설치 CSV는 GCS 버킷 연결 후 배치로 반영됩니다.':'Play Console에 초대한 서비스 계정 JSON을 등록하세요.');}catch(e){setMessage(e instanceof Error?e.message:'상태를 불러오지 못했습니다.');}}
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
 return <section className="safenote ga4setup"><div className="sectiontitle"><h2>Google Play 연결</h2><span className="status">{setup?.configured?'키 저장 완료':'등록 대기'}</span></div>
 <p role="status" aria-live="polite">{message}</p>
 <ol>
  <li>Play Console → 사용자 및 권한 → 새 사용자에 서비스 계정 초대 (재무·앱 정보·검토 응답 등 읽기)</li>
  <li>선택: Cloud Storage 리포트 버킷 이름 (설치·평점 CSV 배치용)</li>
  <li>JSON 키를 암호화하여 등록합니다. 앱별 패키지명은 앱 행의 androidPkg를 사용합니다.</li>
 </ol>
 <div className="setupactions">
  <label className="filelabel">서비스 계정 JSON<input ref={input} type="file" accept=".json,application/json" disabled={!setup||busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
  <label className="filelabel">GCS 버킷 (선택)<input value={bucket} onChange={e=>setBucket(e.target.value)} placeholder="pubsite_prod_rev_…" disabled={busy}/></label>
  <button className="setupbutton" type="button" disabled={!file||!setup||busy} onClick={()=>void connect()}>{busy?'확인 중…':setup?.configured?'키 교체':'암호화하여 연결'}</button>
 </div>
 <p className="note">리뷰·바이탈은 API로 조회하고, 설치 수 CSV는 버킷이 있을 때 배치 적재합니다. 연결 전 앱 상세에는 가짜 숫자를 넣지 않습니다.</p>
 </section>;
}
