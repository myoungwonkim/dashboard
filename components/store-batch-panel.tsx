import {useEffect,useState} from 'react';
type Run={id:string;startedAt:string;finishedAt:string|null;status:string;detail:unknown};
function detailLines(detail:unknown){
 if(!detail||typeof detail!=='object')return [] as string[];
 const d=detail as Record<string,unknown>;
 const lines:string[]=[];
 if(typeof d.playError==='string')lines.push(`Play 계정: ${d.playError}`);
 if(typeof d.ascError==='string')lines.push(`ASC 계정: ${d.ascError}`);
 if(d.playSkipped)lines.push(`Play 건너뜀: ${String(d.playSkipped)}`);
 if(d.ascSkipped)lines.push(`ASC 건너뜀: ${String(d.ascSkipped)}`);
 if(Array.isArray(d.play)){
  for(const row of d.play as {app?:string;error?:string;rows?:number}[]){
   if(row.error)lines.push(`Play ${row.app}: ${row.error}`);
   else if(row.app!=null)lines.push(`Play ${row.app}: 설치일 ${row.rows??0}건`);
  }
 }
 if(Array.isArray(d.asc)){
  for(const row of d.asc as {app?:string;error?:string;salesRows?:number}[]){
   if(row.error)lines.push(`ASC ${row.app}: ${row.error}`);
   else if(row.app!=null)lines.push(`ASC ${row.app}: sales ${row.salesRows??0}건`);
  }
 }
 if(typeof d.error==='string')lines.push(d.error);
 return lines;
}
export default function StoreBatchPanel(){
 const [runs,setRuns]=useState<Run[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function refresh(){try{const r=await fetch('/api/store/batch',{cache:'no-store'});const v=await r.json() as {runs?:Run[];message?:string};if(!r.ok)throw Error(v.message);setRuns(v.runs||[]);}catch(e){setMessage(e instanceof Error?e.message:'배치 이력을 불러오지 못했습니다.');}}
 useEffect(()=>{void refresh();},[]);
 async function run(){setBusy(true);setMessage('스토어 배치 실행 중…');try{const r=await fetch('/api/store/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const v=await r.json() as {status?:string;message?:string;detail?:unknown};if(!r.ok&&!v.status)throw Error(v.message||'배치 실패');const extra=detailLines(v.detail).slice(0,4).join(' · ');setMessage(v.status==='ok'?'배치가 완료되었습니다. Overview·앱 상세를 새로고침하세요.':v.status==='partial'?`일부만 성공했습니다.${extra?` ${extra}`:' 아래 이력 상세를 확인하세요.'}`:(v.message||'배치가 실패했습니다.'));await refresh();}catch(e){setMessage(e instanceof Error?e.message:'배치 실행에 실패했습니다.');}finally{setBusy(false);}}
 return <section className="safenote ga4setup"><div className="sectiontitle"><h2>스토어 배치</h2><span className="status">필수 · Play GCS · ASC Sales</span></div>
 <p><strong>Play 설치 수가 Overview에 나오려면</strong> 위에서 GCS 버킷을 등록한 뒤 이 배치를 실행해야 합니다. (버킷만 있으면 조회 시 CSV를 실시간으로도 읽습니다.) 매일 자동(UTC 21:00 ≈ KST 06:00) 또는 수동 실행.</p>
 <div className="setupactions"><button className="setupbutton" type="button" disabled={busy} onClick={()=>void run()}>{busy?'실행 중…':'지금 배치 실행'}</button><button className="refresh" type="button" disabled={busy} onClick={()=>void refresh()}>이력 새로고침</button></div>
 {message&&<p role="status">{message}</p>}
 {!!runs.length&&<div className="tablewrap" style={{marginTop:16}}><table><thead><tr><th>시작</th><th>상태</th><th>상세</th><th>종료</th></tr></thead><tbody>{runs.map(r=>{const lines=detailLines(r.detail);return <tr key={r.id}><td>{new Date(r.startedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</td><td>{r.status}</td><td style={{whiteSpace:'normal',textAlign:'left',maxWidth:420,fontSize:12,color:'#666'}}>{lines.length?lines.join(' · '):'—'}</td><td>{r.finishedAt?new Date(r.finishedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—'}</td></tr>;})}</tbody></table></div>}
 {!runs.length&&<p className="note">아직 배치 이력이 없습니다. Play GCS 또는 ASC Vendor Number가 준비되면 「지금 배치 실행」을 누르세요.</p>}
 <p className="note">partial이어도 Play 설치는 됐을 수 있습니다. Overview를 새로고침해 확인하세요. ASC 미출시/미연결이면 ASC 오류만으로 partial이 자주 납니다.</p>
 </section>;
}
