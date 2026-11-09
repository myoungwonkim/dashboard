import {AsyncLocalStorage} from 'node:async_hooks';
import {getDb} from '@/db';
import {ga4Connection} from '@/db/schema';
import {decryptAccount} from './ga4-envelope.mjs';
import {GAError} from './ga4-core.mjs';
const context=new AsyncLocalStorage<Record<string,unknown>>();
export function withGA4<T>(env:Record<string,unknown>,run:()=>T):T{return context.run(env,run);}
export function envelopeConfig(){
 const env=context.getStore()||{};
 const privateKey=String(env.GA4_ENVELOPE_PRIVATE_KEY||''),publicKey=String(env.GA4_ENVELOPE_PUBLIC_KEY||''),kid=String(env.GA4_ENVELOPE_KEY_ID||'');
 if(!privateKey||!publicKey||!kid)throw new GAError('not_configured',503);
 return {privateKey,publicKey,kid};
}
export async function ga4Credentials(){
 const env=context.getStore()||{};
 if(env.GA4_SERVICE_ACCOUNT_EMAIL&&env.GA4_PRIVATE_KEY)return {email:String(env.GA4_SERVICE_ACCOUNT_EMAIL),key:String(env.GA4_PRIVATE_KEY)};
 const row=await getDb().select().from(ga4Connection).get();
 if(!row)throw new GAError('not_configured',503);
 const config=envelopeConfig();
 try{const account=await decryptAccount(JSON.parse(row.envelope),JSON.parse(config.privateKey),config.kid);return {email:account.client_email,key:account.private_key};}
 catch{throw new GAError('invalid_credentials',503);}
}
