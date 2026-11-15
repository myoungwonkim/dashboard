import {useEffect,useMemo,useState} from 'react';
import countries,{VIEW_BOX} from 'world-map-country-shapes';
import MetricTable from './metric-table';

export type CountryUsers={countryId:string;country:string;activeUsers:number;newUsers:number};
export type CountryAppSource={id:string;name:string;countries:CountryUsers[]};
type Metric='active'|'new';

function shade(t:number){
 const x=Math.max(0,Math.min(1,t));
 const l=Math.round(92-x*62);
 return `hsl(40 6% ${l}%)`;
}

function aggregateCountries(sources:CountryAppSource[],selected:Set<string>):CountryUsers[]{
 const allOn=!selected.size||selected.size===sources.length;
 const map=new Map<string,CountryUsers>();
 for(const s of sources){
  if(!allOn&&!selected.has(s.id))continue;
  for(const c of s.countries||[]){
   const id=(c.countryId||'').toUpperCase();
   if(!/^[A-Z]{2}$/.test(id))continue;
   const prev=map.get(id);
   if(!prev)map.set(id,{countryId:id,country:c.country,activeUsers:c.activeUsers,newUsers:c.newUsers});
   else map.set(id,{countryId:id,country:prev.country||c.country,activeUsers:prev.activeUsers+c.activeUsers,newUsers:prev.newUsers+c.newUsers});
  }
 }
 return [...map.values()].sort((a,b)=>b.activeUsers-a.activeUsers);
}

export default function UsersMap({sources,title='국가별 사용자'}:{sources:CountryAppSource[];title?:string}){
 const appIds=useMemo(()=>sources.map(s=>s.id),[sources]);
 const [selected,setSelected]=useState<Set<string>>(()=>new Set(appIds));
 const [metric,setMetric]=useState<Metric>('active');
 const [hover,setHover]=useState<{id:string;x:number;y:number}|null>(null);

 useEffect(()=>{setSelected(new Set(appIds));},[appIds.join(',')]);

 const allOn=!selected.size||selected.size===appIds.length;
 const rows=useMemo(()=>aggregateCountries(sources,selected),[sources,selected]);
 const byId=useMemo(()=>{
  const map=new Map<string,CountryUsers>();
  for(const r of rows)map.set(r.countryId,r);
  return map;
 },[rows]);
 const max=useMemo(()=>{
  let m=0;
  for(const r of rows)m=Math.max(m,metric==='active'?r.activeUsers:r.newUsers);
  return m;
 },[rows,metric]);
 const tip=hover?byId.get(hover.id):undefined;
 const scopeLabel=allOn?(sources.length>1?'앱 합산':'이 앱'):sources.filter(s=>selected.has(s.id)).map(s=>s.name).join(' · ');

 function selectAll(){setSelected(new Set(appIds));}
 function toggleApp(id:string){
  setSelected(prev=>{
   const next=new Set(prev);
   if(next.has(id))next.delete(id);else next.add(id);
   if(!next.size)return new Set(appIds);
   return next;
  });
 }

 if(!sources.some(s=>s.countries?.length))return null;

 return <div className="panel users-map">
  <div className="sectiontitle marketing-title">
   <div className="marketing-title-row">
    <h2>{title}</h2>
    {sources.length>1&&<div className="channel-window" role="group" aria-label="지도 앱(복수 선택)">
     <button type="button" className={'channel-seg'+(allOn?' on':'')} aria-pressed={allOn} onClick={selectAll}>전체</button>
     {sources.map(s=>{
      const on=selected.has(s.id);
      return <button type="button" key={s.id} className={'channel-seg'+(on?' on':'')} aria-pressed={on} onClick={()=>toggleApp(s.id)} title={s.name}>{s.name}</button>;
     })}
    </div>}
   </div>
   <div className="charttype" role="group" aria-label="지도 지표">
    <button type="button" className={metric==='active'?'selected':''} aria-pressed={metric==='active'} onClick={()=>setMetric('active')}>활성</button>
    <button type="button" className={metric==='new'?'selected':''} aria-pressed={metric==='new'} onClick={()=>setMetric('new')}>신규</button>
   </div>
  </div>
  <p className="note">진할수록 {metric==='active'?'활성':'신규'} 사용자가 많습니다 · {scopeLabel} · 오른쪽 표는 같은 데이터입니다.</p>
  {!rows.length?<p className="note">선택한 앱의 국가 데이터가 없습니다.</p>:
  <div className="users-map-split">
   <div className="users-map-col">
    <div className="users-map-frame"
     onMouseLeave={()=>setHover(null)}
     onMouseMove={e=>{
      if(!hover)return;
      const rect=(e.currentTarget as HTMLDivElement).getBoundingClientRect();
      setHover(h=>h?{...h,x:e.clientX-rect.left,y:e.clientY-rect.top}:h);
     }}>
     <svg viewBox={VIEW_BOX} className="users-map-svg" role="img" aria-label="국가별 사용자 지도">
      {countries.map(({id,shape})=>{
       const row=byId.get(id);
       const value=row?(metric==='active'?row.activeUsers:row.newUsers):0;
       const t=max>0&&value>0?Math.pow(value/max,0.55):0;
       return <path
        key={id}
        d={shape}
        className={'users-map-country'+(row?' has':'')}
        fill={row?shade(t):'#f0f0ed'}
        stroke="#fff"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        onMouseEnter={e=>{
         const rect=(e.currentTarget.ownerSVGElement?.parentElement as HTMLElement).getBoundingClientRect();
         setHover({id,x:e.clientX-rect.left,y:e.clientY-rect.top});
        }}
       />;
      })}
     </svg>
     {hover&&tip&&<div className="users-map-tip" style={{left:hover.x,top:hover.y}} role="status">
      <strong>{tip.country||hover.id}</strong>
      <div><span>활성</span><b>{tip.activeUsers.toLocaleString()}</b></div>
      <div><span>신규</span><b>{tip.newUsers.toLocaleString()}</b></div>
     </div>}
    </div>
    <div className="users-map-legend" aria-hidden>
     <span>적음</span>
     <span className="users-map-scale"/>
     <span>많음</span>
    </div>
   </div>
   <div className="users-map-col users-map-table">
    <MetricTable
     key={metric}
     rows={rows}
     rowKey={r=>r.countryId}
     wrapClassName="tablewrap users-map-tablewrap"
     defaultSort={{key:metric==='active'?'activeUsers':'newUsers',dir:'desc'}}
     columns={[
      {key:'country',label:'국가',className:'cell-text',get:r=>r.country||r.countryId,render:r=>r.country||r.countryId},
      {key:'activeUsers',label:'활성',get:r=>r.activeUsers,render:r=>r.activeUsers.toLocaleString()},
      {key:'newUsers',label:'신규',get:r=>r.newUsers,render:r=>r.newUsers.toLocaleString()},
     ]}
    />
   </div>
  </div>}
 </div>;
}
