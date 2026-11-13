import {getCurrentUser} from '@/worker/identity';
import {validateAppInput} from '@/lib/apps.ts';
import {createApp,ensureSeedApps,getApp,listApps,updateApp} from '@/lib/apps-store.mts';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
const messages:Record<string,string>={
 invalid_app_id:'앱 ID는 소문자·숫자·하이픈만 사용하고 예약어는 피할 수 없습니다.',
 invalid_app_name:'앱 이름을 1~80자로 입력해 주세요.',
 invalid_status:'앱 상태가 올바르지 않습니다.',
 invalid_ga4_property:'GA4 속성 ID 형식을 확인해 주세요.',
 invalid_android_pkg:'Android 패키지명 형식을 확인해 주세요.',
 invalid_ios_bundle:'iOS 번들 ID 형식을 확인해 주세요.',
 invalid_apple_app_id:'App Store Apple ID는 숫자만 입력해 주세요.',
 invalid_admob_id:'AdMob 앱 ID 형식을 확인해 주세요.',
 not_found:'앱을 찾을 수 없습니다.',
 conflict:'이미 같은 ID의 앱이 있습니다.',
};
async function owner(){return getCurrentUser();}

export async function GET(req:Request){
 if(!await owner())return json({message:'로그인이 필요합니다.'},401);
 try{
  await ensureSeedApps();
  const url=new URL(req.url);
  const includeArchived=url.searchParams.get('all')==='1';
  const id=url.searchParams.get('id');
  if(id){
   const app=await getApp(id);
   if(!app||(app.status==='archived'&&!includeArchived))return json({message:messages.not_found},404);
   return json({status:'success',app});
  }
  return json({status:'success',apps:await listApps({includeArchived})});
 }catch{return json({message:'앱 목록을 불러오지 못했습니다.'},502);}
}

export async function POST(req:Request){
 const user=await owner();if(!user)return json({message:'로그인이 필요합니다.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({message:'잘못된 요청입니다.'},403);
 try{
  await ensureSeedApps();
  const raw=await req.text();if(raw.length>8000)return json({message:'요청이 너무 큽니다.'},413);
  let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return json({message:'잘못된 요청입니다.'},400);}
  if(body?.action==='update'){
   const id=String(body.id||'');
   const patch=validateAppInput(body,{partial:true});
   const app=await updateApp(id,{...patch,id});
   return json({status:'success',app});
  }
  const input=validateAppInput(body);
  if(await getApp(input.id))return json({message:messages.conflict},409);
  const app=await createApp(input);
  return json({status:'success',app},201);
 }catch(error){
  const code=error instanceof Error?error.message:'error';
  return json({message:messages[code]||'앱을 저장하지 못했습니다.'},code==='not_found'?404:400);
 }
}
