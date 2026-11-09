// Web Crypto envelope: only ciphertext crosses the setup request or enters D1.
export const expectedEmail='dashboard-reader@sudoku-master-8998c.iam.gserviceaccount.com';
export const expectedProject='sudoku-master-8998c';
export type Envelope={version:1;kid:string;iv:string;wrappedKey:string;ciphertext:string};
const encode=(v:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(v)));
const decode=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
const aad=(kid:string)=>new TextEncoder().encode('kaffeine-ga4-v1:'+kid);
export function validateAccount(input:unknown){
 const v=input as Record<string,unknown>;
 if(!v||v.type!=='service_account'||v.client_email!==expectedEmail||v.project_id!==expectedProject||typeof v.private_key!=='string'||!v.private_key.startsWith('-----BEGIN PRIVATE KEY-----')||v.private_key.length>12000)throw new Error('invalid_account');
 return {type:'service_account',client_email:expectedEmail,project_id:expectedProject,private_key:v.private_key};
}
export async function encryptAccount(input:unknown,publicJwk:JsonWebKey,kid:string):Promise<Envelope>{
 const account=validateAccount(input);
 const rsa=await crypto.subtle.importKey('jwk',publicJwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
 const aes=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(kid)},aes,new TextEncoder().encode(JSON.stringify(account)));
 const wrapped=await crypto.subtle.encrypt('RSA-OAEP',rsa,await crypto.subtle.exportKey('raw',aes));
 return {version:1,kid,iv:encode(iv.buffer),wrappedKey:encode(wrapped),ciphertext:encode(ciphertext)};
}
export async function decryptAccount(input:unknown,privateJwk:JsonWebKey,kid:string){
 try{
 const v=input as Envelope;
 if(!v||v.version!==1||v.kid!==kid||typeof v.iv!=='string'||typeof v.wrappedKey!=='string'||typeof v.ciphertext!=='string'||v.ciphertext.length>20000)throw 0;
 const iv=decode(v.iv);if(iv.length!==12)throw 0;
 const rsa=await crypto.subtle.importKey('jwk',privateJwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
 const raw=await crypto.subtle.decrypt('RSA-OAEP',rsa,decode(v.wrappedKey));
 const aes=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(kid)},aes,decode(v.ciphertext));
 return validateAccount(JSON.parse(new TextDecoder().decode(plain)));
 }catch{throw new Error('invalid_envelope');}
}
