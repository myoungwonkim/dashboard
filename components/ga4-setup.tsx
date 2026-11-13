import {useEffect,useRef,useState} from 'react';
import Link from '@/client/navigation';
import {encryptAccount,expectedEmail} from '@/lib/ga4-envelope.mjs';
type Check={app:string;propertyId:string;ok:boolean;code:string};
type Setup={checks:Check[];checkedAt:string|null;configured:boolean;createdAt:string|null;publicKey:JsonWebKey;kid:string};
const checkHelp=(code:string)=>code==='api_disabled'?'Google Cloud 프로젝트의 Google Analytics Data API가 비활성화되어 있습니다.'
 :code==='permission_denied'?'이 GA4 속성의 접근 권한이 거부되었습니다. 아래 서비스 계정에 뷰어를 추가해 주세요.'
 :code==='authentication_failed'?'서비스 계정 키가 폐기되었거나 잘못되었습니다. JSON 키를 다시 만들어 교체해 주세요.'
 :code==='quota_exceeded'?'조회 한도입니다. 잠시 후 다시 검사해 주세요.'
 :`조회 실패 (${code}). 잠시 후 다시 검사해 주세요.`;
export default function GA4Setup(){
 const [setup,setSetup]=useState<Setup|null>(null),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('연결 상태를 확인하고 있습니다.'),[failed,setFailed]=useState(false),[replaceMode,setReplaceMode]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 async function refresh(){try{const r=await fetch('/api/ga4/setup',{cache:'no-store'}),data=await r.json() as Setup & {message?:string};if(!r.ok)throw Error(data.message);setSetup(data);setFailed(false);setReplaceMode(false);setMessage(data.configured?(data.checks?.length&&data.checks.every(c=>c.ok)?'인증 키가 등록되어 있고 앱 조회가 확인되었습니다.':'키는 등록됨. 앱별 권한 검사 결과를 확인하거나 다시 검사하세요.'):'JSON 키를 등록하면 등록 앱의 조회 권한을 각각 검사합니다.');}catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'연결 상태 확인에 실패했습니다. 서버 암호화 키(GA4_ENVELOPE_*)가 있는지 확인해 주세요.');}}
 useEffect(()=>{void refresh();},[]);
 async function connect(mode:'upload'|'verify'|'replace'){
 if(!setup||busy)return;
 if((mode==='upload'||mode==='replace')&&!file)return;
 setBusy(true);setFailed(false);setMessage(mode==='verify'?'저장된 키로 앱 조회 권한을 확인하고 있습니다.':'파일을 암호화하고 Google 인증·앱 조회를 확인합니다.');
 try{
  if(file&&file.size>20000)throw Error('Google에서 내려받은 서비스 계정 JSON 파일을 선택해 주세요.');
  let body:Record<string,unknown>;
  if(mode==='verify')body={action:'verify'};
  else{
   let envelope;try{envelope=await encryptAccount(JSON.parse(await file!.text()),setup.publicKey,setup.kid);}
   catch{throw Error(`선택한 파일이 올바르지 않습니다. client_email이 ${expectedEmail} 이고 project_id가 sudoku-master-8998c 인 JSON인지 확인하세요.`);}
   body=mode==='replace'?{action:'replace',envelope}:envelope;
  }
  const r=await fetch('/api/ga4/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json() as Setup & {message?:string;canReplace?:boolean};
  if(!r.ok){if(data.canReplace)setReplaceMode(true);throw Error(data.message||'등록에 실패했습니다.');}
  setSetup({...setup,...data});setFile(null);if(input.current)input.current.value='';setReplaceMode(false);setMessage(data.message||'연결을 확인했습니다.');
 }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');}
 finally{setBusy(false);}
 }
 const showUpload=!setup?.configured||replaceMode;
 return <section className="safenote ga4setup"><div className="sectiontitle"><h2>GA4 연결</h2><span className="status">{setup?.configured?(setup.checks?.length&&setup.checks.every(c=>c.ok)?'앱 연결 완료':'키 저장 · 권한 확인 필요'):'등록 대기'}</span></div>
 <p role="status" aria-live="polite">{message}</p>
 {setup?.configured&&!replaceMode&&<><p>등록 시각: {new Date(setup.createdAt!).toLocaleString('ko-KR')}</p><div className="setupactions"><button className="setupbutton" disabled={busy} onClick={()=>void connect('verify')}>{busy?'검사 중…':'권한 다시 검사'}</button><button type="button" className="refresh" disabled={busy} onClick={()=>setReplaceMode(true)}>JSON 키 교체</button><Link href="/">실제 데이터 보기 →</Link></div></>}
 {showUpload&&setup&&<>
 <ol><li><a href="https://console.cloud.google.com/iam-admin/serviceaccounts/details/112806435627414481090/keys?project=sudoku-master-8998c" target="_blank" rel="noreferrer">서비스 계정의 키 페이지 열기 ↗</a><p>Google 계정: nolsoop.games@gmail.com</p></li><li>키 추가 → 새 키 만들기 → JSON → 만들기</li><li>다운로드한 JSON을 선택합니다. 이메일은 아래와 같아야 합니다.</li></ol>
 <p className="accountemail">{expectedEmail}</p>
 <div className="setupactions"><label className="filelabel">JSON 키 파일<input ref={input} type="file" accept=".json,application/json" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button className="setupbutton" type="button" disabled={!file||busy} onClick={()=>void connect(setup.configured?'replace':'upload')}>{busy?'앱 확인 중…':setup.configured?'암호화하여 교체':'암호화하여 연결'}</button>{replaceMode&&<button type="button" className="refresh" disabled={busy} onClick={()=>{setReplaceMode(false);setFile(null);if(input.current)input.current.value='';}}>교체 취소</button>}</div>
 <p className="note">파일은 이 브라우저에서 암호화한 뒤 서버로 전송합니다. 키 내용은 화면에 표시하지 않습니다.</p>
 </>}
 {failed&&<button type="button" className="refresh" onClick={()=>void refresh()} disabled={busy}>연결 상태 다시 확인</button>}
 {setup?.checks?.map(c=><article className="connection" key={c.app} style={{marginTop:16}}><div className="sectiontitle"><h2>{c.app} · {c.propertyId}</h2><span className="status">{c.ok?'조회 성공':'확인 필요'}</span></div><p>{c.ok?'실제 GA4 보고서 조회에 성공했습니다.':checkHelp(c.code)}</p>{!c.ok&&c.code==='permission_denied'&&<><p className="accountemail">{expectedEmail}</p><p>Google Analytics → 속성 {c.propertyId} → 관리 → 속성 액세스 관리 → + → 사용자 추가 → 위 이메일 → 뷰어</p><a href={'https://analytics.google.com/analytics/web/#/p'+c.propertyId+'/admin'} target="_blank" rel="noreferrer">해당 GA4 속성 관리 열기 ↗</a></>}{!c.ok&&c.code==='api_disabled'&&<a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=sudoku-master-8998c" target="_blank" rel="noreferrer">Data API 사용 설정 열기 ↗</a>}</article>)}
 {setup?.checkedAt&&<p className="note">마지막 검사: {new Date(setup.checkedAt).toLocaleString('ko-KR')}</p>}
 <div className="connection" style={{marginTop:20}}><div className="sectiontitle"><h2>실패 시 체크리스트</h2><span className="status">안내</span></div>
 <ol>
  <li>JSON의 <code>client_email</code>이 <span className="accountemail">{expectedEmail}</span> 인지</li>
  <li><a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=sudoku-master-8998c" target="_blank" rel="noreferrer">Analytics Data API</a>가 sudoku-master-8998c에서 사용 설정인지</li>
  <li>만세력 속성 550050295 · 스도쿠 속성 558243778 각각에 위 이메일이 <strong>뷰어</strong>인지</li>
  <li>키가 폐기됐으면 새 JSON을 만들고 「JSON 키 교체」</li>
 </ol></div>
 </section>;
}
