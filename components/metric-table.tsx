import {useMemo,useState,type ReactNode} from 'react';
import {sortBy,type SortDir,type SortState} from '@/lib/table-sort.mts';
import SortTh from './sort-th';

export type MetricCol<T>={
 key:string;
 label:string;
 get:(row:T)=>string|number|null|undefined;
 render:(row:T)=>ReactNode;
 className?:string;
 title?:string;
 sortable?:boolean;
};

export default function MetricTable<T>({
 rows,columns,rowKey,defaultSort,tableClassName,wrapClassName,onRowClick,rowTitle,rowClassName,
}:{
 rows:T[];
 columns:MetricCol<T>[];
 rowKey:(row:T)=>string;
 defaultSort?:SortState|null;
 tableClassName?:string;
 wrapClassName?:string;
 onRowClick?:(row:T)=>void;
 rowTitle?:(row:T)=>string|undefined;
 rowClassName?:(row:T)=>string|undefined;
}){
 const [sort,setSort]=useState<SortState|null>(defaultSort??null);
 const getters=useMemo(()=>{
  const g:Record<string,(row:T)=>string|number|null|undefined>={};
  for(const c of columns)g[c.key]=c.get;
  return g;
 },[columns]);
 const sorted=useMemo(()=>sortBy(rows,sort,getters),[rows,sort,getters]);
 function onSort(key:string,dir:SortDir){setSort(prev=>prev?.key===key&&prev.dir===dir?null:{key,dir});}
 return <div className={wrapClassName||'tablewrap'}>
  <table className={tableClassName||'dense'}>
   <thead><tr>{columns.map(c=>c.sortable===false
    ?<th key={c.key} className={c.className} title={c.title}>{c.label}</th>
    :<SortTh key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={onSort} className={c.className} title={c.title}/>
   )}</tr></thead>
   <tbody>{sorted.map(row=>{
    const key=rowKey(row);
    return <tr key={key} className={rowClassName?.(row)} style={onRowClick?{cursor:'pointer'}:undefined} onClick={onRowClick?()=>onRowClick(row):undefined} title={rowTitle?.(row)}>
     {columns.map(c=><td key={c.key} className={c.className}>{c.render(row)}</td>)}
    </tr>;
   })}</tbody>
  </table>
 </div>;
}
