export const SESSION_COOKIE='__Host-dashboard';
const enc=new TextEncoder();
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
export async function passwordHash(password:string,salt:string){const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},k,256)),v=>v.toString(16).padStart(2,'0')).join('');}
export function equal(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export function account(raw:string){const v=JSON.parse(raw);if(typeof v.username!=='string'||!v.username||!/^\w{64}$/.test(v.salt)||!/^\w{64}$/.test(v.hash))throw Error('configuration');return v as {username:string;salt:string;hash:string};}
export const cookie=(req:Request)=>req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1)||'';
export const setCookie=(token:string,age=28800)=>`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function session(req:Request,env:any){const token=cookie(req);if(!/^[a-f0-9]{64}$/.test(token))return false;const row=await env.DB.prepare('SELECT id FROM dashboard_sessions WHERE id=? AND expires_at>? AND credential_version=?').bind(await digest(token),Date.now(),await digest(env.DASHBOARD_ACCOUNT)).first();return !!row;}
export async function login(req:Request,env:any){
 if(req.headers.get('origin')!==new URL(req.url).origin)return new Response('잘못된 요청입니다.',{status:403});
 if(Number(req.headers.get('content-length')||0)>2048)return new Response('요청이 너무 큽니다.',{status:413});
 const reader=req.body?.getReader();let size=0,body='';if(reader){const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return new Response('요청이 너무 큽니다.',{status:413});}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}
 const ip=req.headers.get('CF-Connecting-IP')||'local',now=Date.now(),bucket=Math.floor(now/900000),key=await digest(ip+':'+bucket);
 const limit=await env.DB.prepare('INSERT INTO dashboard_attempts (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+900000).first();
 await env.DB.batch([env.DB.prepare('DELETE FROM dashboard_attempts WHERE expires_at<?').bind(now),env.DB.prepare('DELETE FROM dashboard_sessions WHERE expires_at<?').bind(now)]);
 if(limit.count>5)return new Response('로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.',{status:429,headers:{'Retry-After':'900'}});
 const a=account(env.DASHBOARD_ACCOUNT),form=new URLSearchParams(body),hash=await passwordHash(form.get('password')||'',a.salt);
 if(!equal(hash,a.hash)||!equal(form.get('username')||'',a.username))return new Response(null,{status:303,headers:{Location:'/login?error=1'}});
 const token=randomToken();await env.DB.prepare('INSERT INTO dashboard_sessions (id,expires_at,credential_version) VALUES (?,?,?)').bind(await digest(token),now+28800000,await digest(env.DASHBOARD_ACCOUNT)).run();
 return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':setCookie(token)}});
}
export const loginPage=(error:boolean)=>`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>로그인 · 놀숲 대시보드</title><style>body{margin:0;background:#fafaf9;color:#252525;font:15px system-ui;min-height:100vh;display:grid;place-items:center}main{width:min(360px,calc(100% - 80px));padding:32px;background:white;border:1px solid #e5e5e5;border-radius:12px}small,p{color:#777}h1{font-size:25px;margin:12px 0 28px}label{display:block;margin:18px 0}input,button{box-sizing:border-box;width:100%;padding:12px;font:inherit;border:1px solid #ddd;border-radius:6px}input{margin-top:8px}button{background:#252525;color:white;cursor:pointer;margin-top:8px}a{color:inherit}p{line-height:1.6;font-size:13px}</style><main><small>NOLSOOP GAMES</small><h1>서비스 현황 대시보드</h1><form method="post" action="/api/auth/login"><label>아이디<input name="username" autocomplete="username" required maxlength="80"></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label>${error?'<p role="alert">아이디 또는 비밀번호를 확인해 주세요.</p>':''}<button>로그인</button></form><p>설정한 계정으로 로그인하면 앱의 지표를 확인할 수 있습니다.</p></main></html>`;
