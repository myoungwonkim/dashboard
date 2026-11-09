import {getDb} from '@/db';
import {admobOAuthState} from '@/db/schema';
import {lt} from 'drizzle-orm';
import {admobOwner,admobJson,sameOrigin,storedClient,errorText} from '@/lib/admob-server';
import {randomValue,hash,authorizationUrl} from '@/lib/admob-crypto.mjs';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const user=await admobOwner();if(!user||!sameOrigin(req))return admobJson({message:'접근할 수 없습니다.'},403);
 try{const {client}=await storedClient();const state=randomValue(),cookie=randomValue(),verifier=randomValue();const db=getDb();await db.delete(admobOAuthState).where(lt(admobOAuthState.expiresAt,new Date().toISOString()));
 await db.insert(admobOAuthState).values({id:await hash(state),ownerId:user.userId,cookieHash:await hash(cookie),verifier,expiresAt:new Date(Date.now()+600000).toISOString()});
 const response=new Response(null,{status:303,headers:{Location:authorizationUrl(client.client_id,state,await hash(verifier)),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});response.headers.set('Set-Cookie',`__Host-admob-state=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);return response;
 }catch(e){return admobJson({message:errorText(e)},503);}
}
