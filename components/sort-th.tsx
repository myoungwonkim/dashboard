import {ChevronDown,ChevronUp} from 'lucide-react';
import type {SortDir,SortState} from '@/lib/table-sort.mts';

export default function SortTh({
 label,sortKey,sort,onSort,className,title,
}:{
 label:string;
 sortKey:string;
 sort:SortState|null;
 onSort:(key:string,dir:SortDir)=>void;
 className?:string;
 title?:string;
}){
 const active=sort?.key===sortKey?sort.dir:null;
 return <th className={className} title={title}>
  <span className="sortth">
   <span className="sortth-label">{label}</span>
   <span className="sortth-btns" role="group" aria-label={`${label} 정렬`}>
    <button type="button" className={'sortth-btn'+(active==='asc'?' on':'')} aria-label={`${label} 오름차순`} aria-pressed={active==='asc'} onMouseDown={e=>e.preventDefault()} onClick={e=>{e.stopPropagation();onSort(sortKey,'asc');}}>
     <ChevronUp size={11} strokeWidth={2.5}/>
    </button>
    <button type="button" className={'sortth-btn'+(active==='desc'?' on':'')} aria-label={`${label} 내림차순`} aria-pressed={active==='desc'} onMouseDown={e=>e.preventDefault()} onClick={e=>{e.stopPropagation();onSort(sortKey,'desc');}}>
     <ChevronDown size={11} strokeWidth={2.5}/>
    </button>
   </span>
  </span>
 </th>;
}
