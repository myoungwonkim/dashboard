export const siteOrigin='https://dashboard.nolsoopgames.com';
export const admobRedirect=siteOrigin+'/api/admob/oauth/return';
export const reportScope='https://www.googleapis.com/auth/admob.report';
export type OAuthClient={client_id:string;client_secret:string};
export type SecretEnvelope={version:1;kid:string;iv:string;wrappedKey:string;ciphertext:string};
const b64=(b:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(b)));
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export function validateOAuthClient(input:unknown):OAuthClient{
 const v=(input as {web?:Record<string,unknown>})?.web;
 if(!v||v.project_id!=='sudoku-master-8998c'||typeof v.client_id!=='string'||!/^[-\w]+\.apps\.googleusercontent\.com$/.test(v.client_id)||typeof v.client_secret!=='string'||v.client_secret.length<10||v.client_secret.length>512||!Array.isArray(v.redirect_uris)||!v.redirect_uris.includes(admobRedirect))throw Error('invalid_oauth_client');
 return {client_id:v.client_id,client_secret:v.client_secret};
}
export async function seal(value:unknown,publicJwk:JsonWebKey,kid:string,purpose:string):Promise<SecretEnvelope>{
 const rsa=await crypto.subtle.importKey('jwk',publicJwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
 const aes=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12)),additionalData=new TextEncoder().encode('kaffeine-admob-v1:'+purpose+':'+kid);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData},aes,new TextEncoder().encode(JSON.stringify(value)));
 return {version:1,kid,iv:b64(iv.buffer),wrappedKey:b64(await crypto.subtle.encrypt('RSA-OAEP',rsa,await crypto.subtle.exportKey('raw',aes))),ciphertext:b64(ciphertext)};
}
export async function unseal(value:unknown,privateJwk:JsonWebKey,kid:string,purpose:string):Promise<unknown>{
 try{const v=value as SecretEnvelope;if(!v||v.version!==1||v.kid!==kid||typeof v.ciphertext!=='string'||v.ciphertext.length>24000)throw 0;
 const iv=bytes(v.iv);if(iv.length!==12)throw 0;
 const rsa=await crypto.subtle.importKey('jwk',privateJwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
 const aes=await crypto.subtle.importKey('raw',await crypto.subtle.decrypt('RSA-OAEP',rsa,bytes(v.wrappedKey)),'AES-GCM',false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('kaffeine-admob-v1:'+purpose+':'+kid)},aes,bytes(v.ciphertext));return JSON.parse(new TextDecoder().decode(plain));
 }catch{throw Error('invalid_envelope');}
}
export const randomValue=()=>b64(crypto.getRandomValues(new Uint8Array(32)).buffer).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function hash(value:string){return b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function authorizationUrl(clientId:string,state:string,challenge:string){
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:clientId,redirect_uri:admobRedirect,response_type:'code',scope:reportScope,access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256',login_hint:'nolsoop.games@gmail.com'}).toString();return url.toString();
}
