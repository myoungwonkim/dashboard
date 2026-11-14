import {useEffect,useState} from 'react';
import {seal} from '@/lib/admob-crypto.mjs';
type Setup={configured:boolean;createdAt:string|null;verifiedAt:string|null;publicKey:JsonWebKey;kid:string};
export default function AscSetup(){
 const [setup,setSetup]=useState<Setup|null>(null),[issuerId,setIssuerId]=useState(''),[keyId,setKeyId]=useState(''),[privateKey,setPrivateKey]=useState(''),[vendorNumber,setVendorNumber]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('App Store Connect 연결 상태 확인 중…');
 async function refresh(){try{const r=await fetch('/api/asc/setup',{cache:'no-store'});const v=await r.json() as Setup & {message?:string};if(!r.ok)throw Error(v.message);setSetup(v);setMessage(v.configured?'ASC API 키가 등록되어 있습니다. Vendor Number가 있으면 Sales Report 배치로 다운로드를 적재합니다.':'Users and Access → Keys에서 .p8 · Issuer ID · Key ID를 등록하세요.');}catch(e){setMessage(e instanceof Error?e.message:'상태를 불러오지 못했습니다.');}}
 useEffect(()=>{void refresh();},[]);
 async function connect(){
  if(!setup||busy)return;setBusy(true);
  try{
   const account={issuerId:issuerId.trim(),keyId:keyId.trim(),privateKey:privateKey.trim(),vendorNumber:vendorNumber.trim()||null};
   const envelope=await seal(account,setup.publicKey,setup.kid,'asc');
   const r=await fetch('/api/asc/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...envelope,action:setup.configured?'replace':undefined})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message||'등록 실패');
   setPrivateKey('');setMessage(v.message||'등록했습니다.');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'ASC 연결에 실패했습니다.');}
  finally{setBusy(false);}
 }
 const issuerOk=/^[0-9a-fA-F-]{36}$/.test(issuerId.trim());
 const keyOk=/^[A-Z0-9]{10}$/.test(keyId.trim());
 const pemOk=privateKey.includes('PRIVATE KEY')&&privateKey.trim().length>80;
 const canSubmit=!!setup&&issuerOk&&keyOk&&pemOk&&!busy;
 const blockReason=!setup?'연결 설정을 불러오는 중이거나 실패했습니다. 페이지를 새로고침해 주세요.'
  :!issuerOk?'Issuer ID는 이름이 아니라 UUID입니다. 예: ********-****-****-****-************'
  :!keyOk?'Key ID는 영문 대문자·숫자 10자리여야 합니다.'
  :!pemOk?'.p8 전체 내용(BEGIN~END PRIVATE KEY)을 붙여 넣어 주세요.'
  :'';
 return <section className="safenote ga4setup"><div className="sectiontitle"><h2>App Store Connect 연결</h2><span className="status">{setup?.configured?'키 저장 완료':'등록 대기'}</span></div>
 <p role="status" aria-live="polite">{message}</p>
 <ol>
  <li>App Store Connect → Users and Access → Integrations → App Store Connect API → 키 생성</li>
  <li>같은 페이지 상단의 <strong>Issuer ID</strong>(UUID) · Key ID · .p8 내용을 입력. Vendor Number는 선택</li>
  <li>앱별 Apple ID는 앱 행의 appleAppId에 저장합니다.</li>
 </ol>
 <div className="form" style={{marginTop:16}}>
  <label>Issuer ID (UUID)<input value={issuerId} onChange={e=>setIssuerId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={busy} autoComplete="off"/></label>
  {issuerId&&!issuerOk&&<p className="formerror" role="status">이름이 아니라 키 페이지에 보이는 UUID를 넣으세요. 지금 값으로는 버튼이 활성화되지 않습니다.</p>}
  <label>Key ID<input value={keyId} onChange={e=>setKeyId(e.target.value)} placeholder="ABCDEFGHIJ" disabled={busy} autoComplete="off"/></label>
  <label>Vendor Number (선택)<input value={vendorNumber} onChange={e=>setVendorNumber(e.target.value)} placeholder="12345678" disabled={busy}/></label>
  <label>.p8 개인키<textarea value={privateKey} onChange={e=>setPrivateKey(e.target.value)} rows={6} placeholder="-----BEGIN PRIVATE KEY-----" disabled={busy} style={{font:'inherit',padding:10,border:'1px solid #ddd',borderRadius:7}}/></label>
 </div>
 <div className="setupactions"><button className="setupbutton" type="button" disabled={!canSubmit} onClick={()=>void connect()}>{busy?'확인 중…':setup?.configured?'키 교체':'암호화하여 연결'}</button></div>
 {!canSubmit&&blockReason&&<p className="note" role="status">{blockReason}</p>}
 <p className="note">키는 브라우저에서 암호화한 뒤 서버에 보관합니다. 연결 전에는 다운로드·평점 자리에 가짜 값을 표시하지 않습니다.</p>
 </section>;
}
