import {useState} from 'react';
type Point={date:string;value:number};
type ChartType='line'|'column';
export default function TrendChart({series,height=180,defaultType='line'}:{series:{name:string;color:string;dashed?:boolean;points:Point[]}[];height?:number;defaultType?:ChartType}){
 const [type,setType]=useState<ChartType>(defaultType);
 const all=series.flatMap(s=>s.points.map(p=>p.value));
 const max=Math.max(1,...all);
 const width=700;
 const pad=8;
 const dates=[...new Set(series.flatMap(s=>s.points.map(p=>p.date)))].sort();
 const x=(i:number)=>dates.length<=1?width/2:(i/(dates.length-1))*(width-pad*2)+pad;
 const y=(v:number)=>height-pad-(v/max)*(height-pad*2);
 const path=(points:Point[])=>{
  const map=new Map(points.map(p=>[p.date,p.value]));
  return dates.map((d,i)=>{const v=map.get(d);if(v===undefined)return null;return `${i&&map.has(dates[i-1])?'L':'M'}${x(i)},${y(v)}`;}).filter(Boolean).join(' ');
 };
 const top=max>=1000?`${(max/1000).toFixed(1)}k`:String(Math.round(max));
 const barW=Math.max(2,Math.min(18,(width-pad*2)/Math.max(dates.length,1)*0.55/Math.max(series.length,1)));
 return <div className="trendchart">
  <div className="trendchart-toolbar">
   <div className="legend">{series.map(s=><span key={s.name}><i style={{background:s.color,borderBottom:s.dashed?`2px dashed ${s.color}`:undefined,height:s.dashed?0:2}}/>{s.name}</span>)}</div>
   <div className="charttype" role="group" aria-label="차트 형식">
    <button type="button" className={type==='line'?'selected':''} aria-pressed={type==='line'} onClick={()=>setType('line')}>선</button>
    <button type="button" className={type==='column'?'selected':''} aria-pressed={type==='column'} onClick={()=>setType('column')}>막대</button>
   </div>
  </div>
  <div className="chart">
   <div className="yaxis"><span>{top}</span><span>{Math.round(max/2)>=1000?`${(max/2000).toFixed(1)}k`:String(Math.round(max/2))}</span><span>0</span></div>
   <div className="plot">
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="추세 차트">
     {type==='line'&&series.map(s=><path key={s.name} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed?'5 4':undefined}/>)}
     {type==='column'&&series.map((s,si)=>{
      const map=new Map(s.points.map(p=>[p.date,p.value]));
      const offset=(si-(series.length-1)/2)*barW;
      return dates.map((d,i)=>{const v=map.get(d);if(v===undefined)return null;const bh=Math.max(0,(v/max)*(height-pad*2));const cx=x(i)+offset;return <rect key={s.name+d} x={cx-barW/2} y={y(v)} width={barW} height={bh} fill={s.color} opacity={s.dashed?0.55:0.85}/>;});
     })}
    </svg>
    <div className="xaxis">{dates.map(d=><span key={d}>{d.slice(4,6)}/{d.slice(6)}</span>)}</div>
   </div>
  </div>
 </div>;
}
