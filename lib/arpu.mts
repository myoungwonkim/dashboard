/** Period ad revenue per active user (AdMob ÷ GA4 period activeUsers). */
export function adArpu(revenue:number|null|undefined,activeUsers:number|null|undefined):number|null{
 if(revenue==null||activeUsers==null||!Number.isFinite(revenue)||!Number.isFinite(activeUsers)||activeUsers<=0)return null;
 return revenue/activeUsers;
}
/** Average revenue per daily active user over the period: revenue / Σ DAU ≈ revenue / (avgDau * days). */
export function adArpdau(revenue:number|null|undefined,averageDau:number|null|undefined,days:number):number|null{
 if(revenue==null||averageDau==null||!Number.isFinite(revenue)||!Number.isFinite(averageDau)||averageDau<=0||days<=0)return null;
 return revenue/(averageDau*days);
}
export function fmtUsd(v:number|null,digits=3){
 if(v==null||!Number.isFinite(v))return '—';
 return '$'+v.toFixed(digits);
}
