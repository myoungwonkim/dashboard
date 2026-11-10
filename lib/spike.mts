/** Detect sudden day-over-day change vs recent baseline. No fake fills — empty series yields null. */
export function spikeFlag(daily:{date:string;value:number}[],opts:{minDays?:number;ratio?:number;minAbs?:number}={}){
 const minDays=opts.minDays??5,ratio=opts.ratio??2.5,minAbs=opts.minAbs??20;
 if(daily.length<minDays)return null;
 const sorted=[...daily].sort((a,b)=>a.date.localeCompare(b.date));
 const last=sorted[sorted.length-1];
 const prior=sorted.slice(0,-1).slice(-7);
 const baseline=prior.reduce((s,r)=>s+r.value,0)/prior.length;
 if(baseline<=0&&last.value>=minAbs)return {date:last.date,value:last.value,baseline,direction:'up' as const,ratio:null};
 if(baseline<=0)return null;
 const change=last.value/baseline;
 if(Math.abs(last.value-baseline)<minAbs)return null;
 if(change>=ratio)return {date:last.date,value:last.value,baseline,direction:'up' as const,ratio:change};
 if(change<=1/ratio)return {date:last.date,value:last.value,baseline,direction:'down' as const,ratio:change};
 return null;
}
