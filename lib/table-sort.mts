export type SortDir='asc'|'desc';
export type SortState={key:string;dir:SortDir};

export function sortBy<T>(rows:T[],sort:SortState|null|undefined,getters:Record<string,(row:T)=>string|number|null|undefined>):T[]{
 if(!sort)return rows;
 const get=getters[sort.key];
 if(!get)return rows;
 const mul=sort.dir==='asc'?1:-1;
 return [...rows].sort((a,b)=>{
  const va=get(a),vb=get(b);
  const aMissing=va==null||va===''||(typeof va==='number'&&!Number.isFinite(va));
  const bMissing=vb==null||vb===''||(typeof vb==='number'&&!Number.isFinite(vb));
  if(aMissing&&bMissing)return 0;
  if(aMissing)return 1;
  if(bMissing)return -1;
  if(typeof va==='string'&&typeof vb==='string')return mul*va.localeCompare(vb,'ko');
  return mul*(Number(va)-Number(vb));
 });
}
