import {useMemo,useState} from 'react';
import countries,{VIEW_BOX} from 'world-map-country-shapes';

export type CountryUsers={countryId:string;country:string;activeUsers:number;newUsers:number};
type Metric='active'|'new';

function shade(t:number){
 // light gray → dark charcoal (higher = more users)
 const x=Math.max(0,Math.min(1,t));
 const l=Math.round(92-x*62);
 return `hsl(40 6% ${l}%)`;
}

export default function UsersMap({rows,title='국가별 사용자'}:{rows:CountryUsers[];title?:string}){
 const [metric,setMetric]=useState<Metric>('active');
 const [hover,setHover]=useState<{id:string;x:number;y:number}|null>(null);
 const byId=useMemo(()=>{
  const map=new Map<string,CountryUsers>();
  for(const r of rows){
   const id=(r.countryId||'').toUpperCase();
   if(!/^[A-Z]{2}$/.test(id))continue;
   const prev=map.get(id);
   if(!prev)map.set(id,{...r,countryId:id});
   else map.set(id,{countryId:id,country:prev.country||r.country,activeUsers:prev.activeUsers+r.activeUsers,newUsers:prev.newUsers+r.newUsers});
  }
  return map;
 },[rows]);
 const max=useMemo(()=>{
  let m=0;
  for(const r of byId.values())m=Math.max(m,metric==='active'?r.activeUsers:r.newUsers);
  return m;
 },[byId,metric]);
 const tip=hover?byId.get(hover.id):undefined;

 if(!byId.size)return null;

 return <div className="panel users-map">
  <div className="sectiontitle">
   <h2>{title}</h2>
   <div className="charttype" role="group" aria-label="지도 지표">
    <button type="button" className={metric==='active'?'selected':''} aria-pressed={metric==='active'} onClick={()=>setMetric('active')}>활성</button>
    <button type="button" className={metric==='new'?'selected':''} aria-pressed={metric==='new'} onClick={()=>setMetric('new')}>신규</button>
   </div>
  </div>
  <p className="note">진할수록 {metric==='active'?'활성':'신규'} 사용자가 많습니다. 국가에 마우스를 올리면 수치가 표시됩니다.</p>
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
 </div>;
}
