import {useEffect,useRef,useState} from 'react';
import Link from '@/client/navigation';
import {encryptAccount,expectedEmail} from '@/lib/ga4-envelope.mjs';
type Check={app:string;propertyId:string;ok:boolean;code:string};
type Setup={checks:Check[];checkedAt:string|null;configured:boolean;createdAt:string|null;publicKey:JsonWebKey;kid:string};
export default function GA4Setup(){
 const [setup,setSetup]=useState<Setup|null>(null),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('연결 상태를 확인하고 있습니다.'),[failed,setFailed]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 async function refresh(){try{const r=await fetch('/api/ga4/setup',{cache:'no-store'}),data=await r.json() as Setup & {message?:string};if(!r.ok)throw Error(data.message);setSetup(data);setFailed(false);setMessage(data.configured?'인증 키가 등록되어 있습니다. 앱별 조회 결과를 확인해 주세요.':'JSON 키를 등록하면 두 앱의 조회 권한을 각각 검사합니다.');}catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'연결 상태 확인에 실패했습니다.');}}
 useEffect(()=>{void refresh();},[]);
 async function connect(){
 if(!setup||busy||(!setup.configured&&!file))return;setBusy(true);setFailed(false);setMessage('파일을 암호화하고 두 앱의 조회 권한을 확인하고 있습니다.');
 try{
 if(file&&file.size>20000)throw Error('Google에서 내려받은 서비스 계정 JSON 파일을 선택해 주세요.');
 let envelope;try{envelope=setup.configured?{action:'verify'}:await encryptAccount(JSON.parse(await file!.text()),setup.publicKey,setup.kid);}catch{throw Error('선택한 파일이 올바르지 않습니다. 아래 서비스 계정에서 발급한 JSON 키인지 확인해 주세요.');}
 const r=await fetch('/api/ga4/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope)}),data=await r.json() as Setup & {message?:string};
 if(!r.ok)throw Error(data.message||'등록에 실패했습니다.');setSetup({...setup,...data});setFile(null);if(input.current)input.current.value='';setMessage(data.message||'두 앱의 연결을 확인했습니다.');
 }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');}
 finally{setBusy(false);}
 }
 return <section className="safenote ga4setup"><div className="sectiontitle"><h2>GA4 연결</h2><span className="status">{setup?.configured?(setup.checks?.every(c=>c.ok)&&setup.checks.length===2?'두 앱 연결 완료':'키 저장 완료'):'등록 대기'}</span></div>
 <p role="status" aria-live="polite">{message}</p>
 {setup?.configured?<><p>등록 시각: {new Date(setup.createdAt!).toLocaleString('ko-KR')}</p><div className="setupactions"><button className="setupbutton" disabled={busy} onClick={()=>void connect()}>{busy?'검사 중…':'권한 다시 검사'}</button><Link href="/">실제 데이터 보기 →</Link></div></>:<>
 <ol><li><a href="https://console.cloud.google.com/iam-admin/serviceaccounts/details/112806435627414481090/keys?project=sudoku-master-8998c" target="_blank" rel="noreferrer">서비스 계정의 키 페이지 열기 ↗</a><p>Google 계정: nolsoop.games@gmail.com</p></li><li>키 추가 → 새 키 만들기 → JSON → 만들기</li><li>다운로드한 JSON 파일을 아래에서 선택한 뒤 연결합니다.</li></ol>
 <p className="accountemail">{expectedEmail}</p>
 <div className="setupactions"><label className="filelabel">JSON 키 파일<input ref={input} type="file" accept=".json,application/json" disabled={!setup||busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button className="setupbutton" type="button" disabled={!file||!setup||busy} onClick={()=>void connect()}>{busy?'두 앱 확인 중…':'암호화하여 연결'}</button></div>
 <p className="note">파일은 이 브라우저에서 암호화한 뒤 개인 대시보드 서버로 전송합니다. 서버가 Google 인증 성공 후 키를 암호화된 상태로 저장하고, 두 앱의 조회 권한을 각각 검사합니다. 키 내용은 화면이나 채팅에 표시하지 않습니다.</p>
 {failed&&<button type="button" onClick={()=>void refresh()} disabled={busy}>연결 상태 다시 확인</button>}</>}
 {setup?.checks?.map(c=><article className="connection" key={c.app} style={{marginTop:16}}><div className="sectiontitle"><h2>{c.app==='bazi'?'읽어주는 만세력':'스도쿠 마스터'} · {c.propertyId}</h2><span className="status">{c.ok?'조회 성공':'확인 필요'}</span></div><p>{c.ok?'실제 GA4 보고서 조회에 성공했습니다.':c.code==='api_disabled'?'스도쿠 Google Cloud 프로젝트의 Google Analytics Data API가 비활성화되어 있습니다.':c.code==='permission_denied'?'이 GA4 속성의 접근 권한이 거부되었습니다. 아래 서비스 계정 이메일에 뷰어 권한이 있는지 확인해 주세요.':`조회 실패 (${c.code}). 잠시 후 다시 검사해 주세요.`}</p>{!c.ok&&c.code==='permission_denied'&&<><p className="accountemail">{expectedEmail}</p><p>Google Analytics → 해당 속성 선택 → 관리 → 속성 액세스 관리 → + → 사용자 추가 → 위 이메일 입력 → 뷰어</p><a href={'https://analytics.google.com/analytics/web/#/p'+c.propertyId+'/admin'} target="_blank" rel="noreferrer">해당 GA4 속성 관리 열기 ↗</a></>}{!c.ok&&c.code==='api_disabled'&&<a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=sudoku-master-8998c" target="_blank" rel="noreferrer">Data API 사용 설정 열기 ↗</a>}</article>)}
 {setup?.checkedAt&&<p className="note">마지막 검사: {new Date(setup.checkedAt).toLocaleString('ko-KR')}</p>}
 </section>;
}
