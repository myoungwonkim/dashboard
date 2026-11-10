import {getCurrentUser} from '@/worker/identity';
import {getDb} from '@/db';
import {storeBatchRuns} from '@/db/schema';
import {desc} from 'drizzle-orm';
import {runStoreBatch} from '@/lib/store-batch.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export async function GET(){
 if(!await getCurrentUser())return json({message:'로그인이 필요합니다.'},403);
 const rows=await getDb().select().from(storeBatchRuns).orderBy(desc(storeBatchRuns.startedAt)).limit(5).all();
 return json({runs:rows.map(r=>({id:r.id,startedAt:r.startedAt,finishedAt:r.finishedAt,status:r.status,detail:r.detail?JSON.parse(r.detail):null}))});
}
export async function POST(req:Request){
 if(!await getCurrentUser())return json({message:'로그인이 필요합니다.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({message:'잘못된 요청입니다.'},403);
 const result=await runStoreBatch();
 return json(result,result.status==='error'?502:200);
}
