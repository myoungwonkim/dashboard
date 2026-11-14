import {getCurrentUser} from '@/worker/identity';
import {parseMarketingCsv,upsertMarketingDays,isMarketingSource,type MarketingDay} from '@/lib/marketing-core.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});

export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return json({message:'로그인이 필요합니다.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({message:'잘못된 요청입니다.'},403);
 try{
  const body=await req.json() as {csv?:string;rows?:MarketingDay[];row?:Partial<MarketingDay>};
  let rows:MarketingDay[]=[];
  const errors:string[]=[];
  if(typeof body.csv==='string'){
   const parsed=parseMarketingCsv(body.csv);
   rows=parsed.rows;errors.push(...parsed.errors);
  }else if(Array.isArray(body.rows)){
   for(const [i,r] of body.rows.entries()){
    if(!r?.date||!r.appId||!isMarketingSource(String(r.source))||!(Number(r.spend)>=0)){
     errors.push(`${i+1}번째 행이 올바르지 않습니다.`);continue;
    }
    rows.push({date:r.date,appId:r.appId,source:r.source,spend:Number(r.spend),currency:(r.currency||'USD').toUpperCase(),note:r.note||null});
   }
  }else if(body.row){
   const r=body.row;
   if(!r.date||!r.appId||!isMarketingSource(String(r.source||'manual'))||!(Number(r.spend)>=0)){
    return json({message:'date·app_id·source·spend를 확인해 주세요.'},400);
   }
   rows=[{date:r.date,appId:r.appId,source:(r.source||'manual') as MarketingDay['source'],spend:Number(r.spend),currency:(r.currency||'USD').toUpperCase(),note:r.note||null}];
  }else return json({message:'csv 또는 rows가 필요합니다.'},400);

  if(!rows.length)return json({message:errors[0]||'저장할 행이 없습니다.',errors},400);
  const n=await upsertMarketingDays(rows);
  return json({ok:true,saved:n,skipped:errors.length,errors:errors.slice(0,20),message:`${n}건 저장${errors.length?` · ${errors.length}건 건너뜀`:''}`});
 }catch{return json({message:'업로드에 실패했습니다.'},502);}
}
