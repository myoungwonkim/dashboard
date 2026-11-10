import {withGA4} from '../lib/ga4-context';
import {withUser} from './identity';
import {account,session,login,loginPage,cookie,digest,setCookie} from './auth.mts';
import * as ga4 from '../app/api/ga4/route';
import * as ga4Setup from '../app/api/ga4/setup/route';
import * as admob from '../app/api/admob/route';
import * as admobSetup from '../app/api/admob/setup/route';
import * as start from '../app/api/admob/oauth/start/route';
import * as callback from '../app/api/admob/oauth/return/route';
import * as appsApi from '../app/api/apps/route';
import * as playApi from '../app/api/play/route';
import * as playSetup from '../app/api/play/setup/route';
import * as ascApi from '../app/api/asc/route';
import * as ascSetup from '../app/api/asc/setup/route';
const routes:Record<string,Record<string,unknown>>={'/api/ga4':ga4,'/api/ga4/setup':ga4Setup,'/api/admob':admob,'/api/admob/setup':admobSetup,'/api/admob/oauth/start':start,'/api/admob/oauth/return':callback,'/api/apps':appsApi,'/api/play':playApi,'/api/play/setup':playSetup,'/api/asc':ascApi,'/api/asc/setup':ascSetup};
export async function handle(req:Request,env:any):Promise<Response>{
 const url=new URL(req.url),path=url.pathname;
 if(url.hostname==='dashboard.nolsoopgames.com'&&url.protocol!=='https:'){url.protocol='https:';return Response.redirect(url.toString(),308);}
 account(env.DASHBOARD_ACCOUNT);
 if(path==='/login'&&req.method==='GET')return new Response(loginPage(url.searchParams.has('error')),{headers:{'Content-Type':'text/html;charset=utf-8'}});
 if(path==='/api/auth/login'&&req.method==='POST')return login(req,env);
 if(!await session(req,env))return path.startsWith('/api/')?Response.json({message:'로그인이 필요합니다.'},{status:401}):new Response(null,{status:303,headers:{Location:'/login'}});
 if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.get('origin')!==url.origin)return new Response('잘못된 요청입니다.',{status:403});
 if(path==='/api/auth/logout'&&req.method==='POST'){await env.DB.prepare('DELETE FROM dashboard_sessions WHERE id=?').bind(await digest(cookie(req))).run();return new Response(null,{status:303,headers:{Location:'/login','Set-Cookie':setCookie('',0)}});}
 if(path.startsWith('/api/')){const route=routes[path];if(!route)return new Response('Not found',{status:404});const fn=route[req.method];if(typeof fn!=='function')return new Response('Method not allowed',{status:405});return withUser(()=>withGA4(env,()=>fn(req)));}
 if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405});
 return env.ASSETS.fetch(req);
}
// Same-origin form POSTs must retain Origin for CSRF validation.
// no-referrer turns navigation POST Origin into null (Fetch standard).
export default {async fetch(req:Request,env:any){let response;try{response=await handle(req,env);}catch{response=new Response('서버 설정을 확인해 주세요.',{status:503});}const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Strict-Transport-Security','max-age=31536000');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://accounts.google.com");return new Response(response.body,{status:response.status,headers});}};
