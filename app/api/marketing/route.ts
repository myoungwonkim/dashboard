import {getCurrentUser} from '@/worker/identity';
import {loadMarketingRange,rollupMarketing,roas,fmtSpend} from '@/lib/marketing-core.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});

export async function POST(req:Request){
 if(!await getCurrentUser())return json({status:'error',message:'로그인이 필요합니다.'},401);
 try{
  const body=await req.json() as {app?:string;startDate?:string;endDate?:string;days?:number;revenue?:number};
  const endDate=body.endDate||'';
  const startDate=body.startDate||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)){
   return json({status:'error',message:'기간이 올바르지 않습니다.'},400);
  }
  const rows=await loadMarketingRange({appId:body.app||undefined,startDate,endDate});
  const roll=rollupMarketing(rows);
  return json({
   status:'success',
   data:{
    spend:roll.spend,
    bySource:roll.bySource,
    daily:roll.daily,
    rows,
    roas:roas(body.revenue,roll.spend),
    fmt:fmtSpend(roll.spend),
    fetchedAt:new Date().toISOString(),
   },
  });
 }catch{return json({status:'error',message:'마케팅 비용을 불러오지 못했습니다.'},502);}
}
