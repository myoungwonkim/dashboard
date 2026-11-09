import {getDb} from '@/db';
import {admobConnection,admobOAuthState} from '@/db/schema';
import {and,eq,gt} from 'drizzle-orm';
import {admobOwner,storedClient,exchangeCode,encryptSecret} from '@/lib/admob-server';
import {hash,siteOrigin} from '@/lib/admob-crypto.mjs';
import {fetchAdmobAccount} from '@/lib/admob-core.mjs';
export const dynamic='force-dynamic';
function back(status:string){return new Response(null,{status:303,headers:{Location:siteOrigin+'/connections?admob='+status,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','Set-Cookie':'__Host-admob-state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}});}
export async function GET(req:Request){
 try{
 const user=await admobOwner();if(!user)return back('login_required');
 const q=new URL(req.url).searchParams,state=q.get('state')||'',code=q.get('code')||'';
 const cookie=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-admob-state='))?.slice('__Host-admob-state='.length)||'';
 if(!state||state.length>256||!cookie||cookie.length>256)return back('expired');
 const db=getDb();const consumed=await db.delete(admobOAuthState).where(and(eq(admobOAuthState.id,await hash(state)),eq(admobOAuthState.ownerId,user.userId),eq(admobOAuthState.cookieHash,await hash(cookie)),gt(admobOAuthState.expiresAt,new Date().toISOString()))).returning();
 if(consumed.length!==1)return back('expired');if(q.has('error'))return back('denied');if(!code||code.length>4096)return back('failed');
 const {client}=await storedClient();const token=await exchangeCode(code,consumed[0].verifier,client);
 if(!token.refresh_token)return back('missing_refresh_token');
 // Confirm that this Google account can access the user's fixed publisher before saving.
 await fetchAdmobAccount(token.access_token!);
 await db.update(admobConnection).set({tokenEnvelope:await encryptSecret({refresh_token:token.refresh_token},'token')}).where(and(eq(admobConnection.id,'primary'),eq(admobConnection.ownerId,user.userId)));
 return back('authorized');
 }catch(e){const code=e instanceof Error?e.message:'';return back(['api_disabled','permission_denied','scope_missing'].includes(code)?code:'failed');}
}
