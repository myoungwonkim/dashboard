/** Sum finite numbers; null if none. */
export function sumNums(values:(number|null|undefined)[]):number|null{
 const xs=values.filter((v):v is number=>v!=null&&Number.isFinite(v));
 if(!xs.length)return null;
 return xs.reduce((s,v)=>s+v,0);
}
/** Simple mean of finite numbers. */
export function meanNums(values:(number|null|undefined)[]):number|null{
 const xs=values.filter((v):v is number=>v!=null&&Number.isFinite(v));
 if(!xs.length)return null;
 return xs.reduce((s,v)=>s+v,0)/xs.length;
}
/** Weighted mean; skips non-finite values/weights. */
export function weightedMean(pairs:{value:number|null|undefined;weight:number|null|undefined}[]):number|null{
 let num=0,den=0;
 for(const p of pairs){
  if(p.value==null||p.weight==null||!Number.isFinite(p.value)||!Number.isFinite(p.weight)||p.weight<=0)continue;
  num+=p.value*p.weight;den+=p.weight;
 }
 return den>0?num/den:null;
}
