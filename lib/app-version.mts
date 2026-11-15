/** Compare app version strings (semver-ish). Newer / higher first when used with sort(b,a). */
export function compareAppVersions(a:string,b:string){
 const pa=parts(a),pb=parts(b);
 const n=Math.max(pa.length,pb.length);
 for(let i=0;i<n;i++){
  const x=pa[i]??0,y=pb[i]??0;
  if(x!==y)return x-y;
 }
 return a.localeCompare(b);
}

function parts(v:string){
 return String(v).replace(/^[^\d]*/,'').split(/[^\d]+/).filter(Boolean).map(n=>Number(n)||0);
}

/** Newest-first; drops empty labels. Pass limit to cap how many rows are kept. */
export function recentAppVersions<T>(rows:T[],key:(row:T)=>string,limit?:number):T[]{
 const sorted=[...rows]
  .filter(r=>key(r).trim())
  .sort((a,b)=>compareAppVersions(key(b),key(a)));
 return limit!=null?sorted.slice(0,limit):sorted;
}
