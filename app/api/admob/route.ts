import {admobOwner,admobJson,sameOrigin,admobAccessToken,errorText} from '@/lib/admob-server';
import {admobQuery,fetchAdmobReport} from '@/lib/admob-core.mjs';
import {getDb} from '@/db';
import {admobConnection} from '@/db/schema';
import {and,eq} from 'drizzle-orm';
import {admobInventoryFor,ensureSeedApps,getApp} from '@/lib/apps-store.mts';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const user=await admobOwner();if(!user||!sameOrigin(req))return admobJson({status:'error',message:'소유자로 로그인해 주세요.'},403);
 try{const raw=await req.text();if(raw.length>2048)throw Error('invalid_query');let input;try{input=JSON.parse(raw);}catch{throw Error('invalid_query');}if(!input||typeof input!=='object')throw Error('invalid_query');const q=admobQuery(input);await ensureSeedApps();const app=await getApp(q.app);if(!app||app.status!=='active')throw Error('invalid_query');const inventory=admobInventoryFor(app,q.os as 'all'|'android'|'ios');if(!inventory.length)throw Error('invalid_query');const data=await fetchAdmobReport(q,await admobAccessToken(),inventory);await getDb().update(admobConnection).set({verifiedAt:new Date().toISOString()}).where(and(eq(admobConnection.id,'primary'),eq(admobConnection.ownerId,user.userId)));return admobJson({status:'success',data});
 }catch(e){return admobJson({status:'error',message:errorText(e)},502);}
}
