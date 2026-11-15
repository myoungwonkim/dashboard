import {useMemo,useRef,useState} from 'react';
import {aggregatePoints,formatBucketLabel,type Granularity,type Point} from '@/lib/chart-aggregate.mts';
type ChartType='line'|'column';
type Series={name:string;color:string;dashed?:boolean;points:Point[];aggregate?:'sum'|'avg'};

function fmtValue(v:number){
 if(!Number.isFinite(v))return '—';
 const a=Math.abs(v);
 if(a>=1000)return Math.round(v).toLocaleString();
 if(a>=10)return (Math.round(v*10)/10).toLocaleString();
 return (Math.round(v*100)/100).toLocaleString();
}

export default function TrendChart({series,height=180,defaultType='line',defaultGranularity='day',showGranularity=true}:{series:Series[];height?:number;defaultType?:ChartType;defaultGranularity?:Granularity;showGranularity?:boolean}){
 const [type,setType]=useState<ChartType>(defaultType);
 const [granularity,setGranularity]=useState<Granularity>(defaultGranularity);
 const [hover,setHover]=useState<number|null>(null);
 const plotRef=useRef<HTMLDivElement>(null);
 const rolled=useMemo(()=>series.map(s=>({
  ...s,
  points:aggregatePoints(s.points,granularity,s.aggregate||'sum'),
 })),[series,granularity]);
 const all=rolled.flatMap(s=>s.points.map(p=>p.value));
 const max=Math.max(1,...all);
 const width=700;
 const pad=8;
 const dates=[...new Set(rolled.flatMap(s=>s.points.map(p=>p.date)))].sort();
 const x=(i:number)=>dates.length<=1?width/2:(i/(dates.length-1))*(width-pad*2)+pad;
 const y=(v:number)=>height-pad-(v/max)*(height-pad*2);
 const path=(points:Point[])=>{
  const map=new Map(points.map(p=>[p.date,p.value]));
  return dates.map((d,i)=>{const v=map.get(d);if(v===undefined)return null;return `${i&&map.has(dates[i-1])?'L':'M'}${x(i)},${y(v)}`;}).filter(Boolean).join(' ');
 };
 const top=max>=1000?`${(max/1000).toFixed(1)}k`:String(Math.round(max*100)/100);
 const mid=max/2;
 const midLabel=mid>=1000?`${(mid/1000).toFixed(1)}k`:String(Math.round(mid*100)/100);
 const barW=Math.max(2,Math.min(18,(width-pad*2)/Math.max(dates.length,1)*0.55/Math.max(rolled.length,1)));

 function indexFromEvent(e:React.MouseEvent|React.PointerEvent){
  const el=plotRef.current;if(!el||!dates.length)return null;
  const rect=el.getBoundingClientRect();
  if(rect.width<=0)return null;
  const rel=Math.min(1,Math.max(0,(e.clientX-rect.left)/rect.width));
  if(dates.length<=1)return 0;
  return Math.round(rel*(dates.length-1));
 }

 const hoverDate=hover!=null?dates[hover]:null;
 const tipRows=hoverDate?rolled.map(s=>{
  const pt=s.points.find(p=>p.date===hoverDate);
  return {name:s.name,color:s.color,value:pt?.value};
 }).filter(r=>r.value!==undefined) as {name:string;color:string;value:number}[]:[];
 const tipLeft=hover!=null&&dates.length?`${(x(hover)/width)*100}%`:'50%';

 return <div className="trendchart">
  <div className="trendchart-toolbar">
   <div className="legend">{rolled.map(s=><span key={s.name}><i style={{background:s.dashed?'transparent':s.color,borderBottom:s.dashed?`2px dashed ${s.color}`:undefined,height:s.dashed?0:2}}/>{s.name}</span>)}</div>
   <div className="chartcontrols">
    {showGranularity&&<div className="charttype" role="group" aria-label="집계 단위">
     {([['day','일'],['week','주'],['month','월']] as const).map(([id,label])=>
      <button type="button" key={id} className={granularity===id?'selected':''} aria-pressed={granularity===id} onClick={()=>setGranularity(id)}>{label}</button>
     )}
    </div>}
    <div className="charttype" role="group" aria-label="차트 형식">
     <button type="button" className={type==='line'?'selected':''} aria-pressed={type==='line'} onClick={()=>setType('line')}>선</button>
     <button type="button" className={type==='column'?'selected':''} aria-pressed={type==='column'} onClick={()=>setType('column')}>막대</button>
    </div>
   </div>
  </div>
  <div className="chart">
   <div className="yaxis"><span>{top}</span><span>{midLabel}</span><span>0</span></div>
   <div className="plot" ref={plotRef}
    onPointerMove={e=>{const i=indexFromEvent(e);if(i!=null)setHover(i);}}
    onPointerLeave={()=>setHover(null)}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="추세 차트">
     {type==='line'&&rolled.map(s=><path key={s.name} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed?'5 4':undefined} vectorEffect="non-scaling-stroke"/>)}
     {type==='column'&&rolled.map((s,si)=>{
      const map=new Map(s.points.map(p=>[p.date,p.value]));
      const offset=(si-(rolled.length-1)/2)*barW;
      return dates.map((d,i)=>{const v=map.get(d);if(v===undefined)return null;const bh=Math.max(0,(v/max)*(height-pad*2));const cx=x(i)+offset;return <rect key={s.name+d} x={cx-barW/2} y={y(v)} width={barW} height={bh} fill={s.color} opacity={s.dashed?0.55:0.85}/>;});
     })}
     {hover!=null&&<>
      <line x1={x(hover)} x2={x(hover)} y1={pad} y2={height-pad} stroke="#bbb" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"/>
      {rolled.map(s=>{
       const v=s.points.find(p=>p.date===hoverDate)?.value;
       if(v===undefined)return null;
       return <circle key={s.name+'-h'} cx={x(hover)} cy={y(v)} r="4" fill={s.color} stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>;
      })}
     </>}
    </svg>
    {hoverDate&&!!tipRows.length&&<div className="chart-tip" style={{left:tipLeft}} role="status">
     <strong>{formatBucketLabel(hoverDate)}</strong>
     {tipRows.map(r=><div key={r.name}><i style={{background:r.color}}/><span>{r.name}</span><b>{fmtValue(r.value)}</b></div>)}
    </div>}
    <div className="xaxis">{dates.map(d=><span key={d}>{formatBucketLabel(d)}</span>)}</div>
   </div>
  </div>
 </div>;
}
