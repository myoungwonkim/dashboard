import {useEffect,useState} from 'react';
import {seal} from '@/lib/admob-crypto.mjs';
type Setup={configured:boolean;createdAt:string|null;verifiedAt:string|null;publicKey:JsonWebKey;kid:string};
export default function AscSetup(){
 const [setup,setSetup]=useState<Setup|null>(null),[issuerId,setIssuerId]=useState(''),[keyId,setKeyId]=useState(''),[privateKey,setPrivateKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('App Store Connect 연결 상태 확인 중…');
 async function refresh(){try{const r=await fetch('/api/asc/setup',{cache:'no-store'});const v=await r.json() as Setup & {message?:string};if(!r.ok)throw Error(v.message);setSetup(v);setMessage(v.configured?'ASC API 키가 등록되어 있습니다. 다운로드 Analytics는 리포트 구독 후 배치로 반영됩니다.':'Users and Access → Keys에서 .p8 · Issuer ID · Key ID를 등록하세요.');}catch(e){setMessage(e instanceof Error?e.message:'상태를 불러오지 못했습니다.');}}
 useEffect(()=>{void refresh();},[]);
 async function connect(){
  if(!setup||busy)return;setBusy(true);
  try{
   const account={issuerId:issuerId.trim(),keyId:keyId.trim(),privateKey:privateKey.trim()};
   const envelope=await seal(account,setup.publicKey,setup.kid,'asc');
   const r=await fetch('/api/asc/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...envelope,action:setup.configured?'replace':undefined})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message||'등록 실패');
   setPrivateKey('');setMessage(v.message||'등록했습니다.');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'ASC 연결에 실패했습니다.');}
  finally{setBusy(false);}
 }
 return <section className="safenote ga4setup"><div className="sectiontitle"><h2>App Store Connect 연결</h2><span className="status">{setup?.configured?'키 저장 완료':'등록 대기'}</span></div>
 <p role="status" aria-live="polite">{message}</p>
 <ol>
  <li>App Store Connect → Users and Access → Integrations → App Store Connect API → 키 생성</li>
  <li>.p8 파일 · Key ID · Issuer ID를 아래에 입력합니다 (한 번만 표시되는 .p8 내용을 붙여넣기)</li>
  <li>앱별 Apple ID는 앱 행의 appleAppId에 저장합니다.</li>
 </ol>
 <div className="form" style={{marginTop:16}}>
  <label>Issuer ID<input value={issuerId} onChange={e=>setIssuerId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={busy}/></label>
  <label>Key ID<input value={keyId} onChange={e=>setKeyId(e.target.value)} placeholder="ABCDEFGHIJ" disabled={busy}/></label>
  <label>.p8 개인키<textarea value={privateKey} onChange={e=>setPrivateKey(e.target.value)} rows={6} placeholder="-----BEGIN PRIVATE KEY-----" disabled={busy} style={{font: 'inherit',padding:10,border:'1px solid #ddd',borderRadius:7}}/></label>
 </div>
 <div className="setupactions"><button className="setupbutton" type="button" disabled={!issuerId||!keyId||!privateKey||!setup||busy} onClick={()=>void connect()}>{busy?'확인 중…':setup?.configured?'키 교체':'암호화하여 연결'}</button></div>
 <p className="note">키는 브라우저에서 암호화한 뒤 서버에 보관합니다. 연결 전에는 다운로드·평점 자리에 가짜 값을 표시하지 않습니다.</p>
 </section>;
}
