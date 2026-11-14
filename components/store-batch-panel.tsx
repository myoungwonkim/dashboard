import {useEffect,useState} from 'react';
type Run={id:string;startedAt:string;finishedAt:string|null;status:string;detail:unknown};
export default function StoreBatchPanel(){
 const [runs,setRuns]=useState<Run[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function refresh(){try{const r=await fetch('/api/store/batch',{cache:'no-store'});const v=await r.json() as {runs?:Run[];message?:string};if(!r.ok)throw Error(v.message);setRuns(v.runs||[]);}catch(e){setMessage(e instanceof Error?e.message:'배치 이력을 불러오지 못했습니다.');}}
 useEffect(()=>{void refresh();},[]);
 async function run(){setBusy(true);setMessage('스토어 배치 실행 중…');try{const r=await fetch('/api/store/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const v=await r.json() as {status?:string;message?:string;detail?:unknown};if(!r.ok&&!v.status)throw Error(v.message||'배치 실패');setMessage(v.status==='ok'?'배치가 완료되었습니다. Overview·앱 상세를 새로고침하세요.':v.status==='partial'?'일부만 성공했습니다. 아래 이력을 확인하세요.':(v.message||'배치가 실패했습니다.'));await refresh();}catch(e){setMessage(e instanceof Error?e.message:'배치 실행에 실패했습니다.');}finally{setBusy(false);}}
 return <section className="safenote ga4setup"><div className="sectiontitle"><h2>스토어 배치</h2><span className="status">필수 · Play GCS · ASC Sales</span></div>
 <p><strong>Play 설치 수가 Overview에 나오려면</strong> 위에서 GCS 버킷을 등록한 뒤 이 배치를 실행해야 합니다. (버킷만 있으면 조회 시 CSV를 실시간으로도 읽습니다.) 매일 자동(UTC 21:00 ≈ KST 06:00) 또는 수동 실행.</p>
 <div className="setupactions"><button className="setupbutton" type="button" disabled={busy} onClick={()=>void run()}>{busy?'실행 중…':'지금 배치 실행'}</button><button className="refresh" type="button" disabled={busy} onClick={()=>void refresh()}>이력 새로고침</button></div>
 {message&&<p role="status">{message}</p>}
 {!!runs.length&&<div className="tablewrap" style={{marginTop:16}}><table><thead><tr><th>시작</th><th>상태</th><th>종료</th></tr></thead><tbody>{runs.map(r=><tr key={r.id}><td>{new Date(r.startedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</td><td>{r.status}</td><td>{r.finishedAt?new Date(r.finishedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—'}</td></tr>)}</tbody></table></div>}
 {!runs.length&&<p className="note">아직 배치 이력이 없습니다. Play GCS 또는 ASC Vendor Number가 준비되면 「지금 배치 실행」을 누르세요.</p>}
 <p className="note">Play: GCS 버킷·패키지명 · ASC: Vendor Number·Apple App ID. 배치 실패 시 서비스 계정 권한·버킷 이름을 다시 확인하세요.</p>
 </section>;
}
