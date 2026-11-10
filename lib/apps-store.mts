import {getDb} from '@/db';
import {apps} from '@/db/schema';
import {asc,eq} from 'drizzle-orm';
import type {AppInput,AppRecord,AppStatus} from './apps.ts';
import {seedApps} from './apps.ts';

function mapRow(row:{
 id:string;name:string;symbol:string;status:string;
 firebaseProjectId:string|null;ga4PropertyId:string|null;androidPkg:string|null;
 iosBundleId:string|null;appleAppId:string|null;admobAndroidAppId:string|null;
 admobIosAppId:string|null;afAndroidId:string|null;afIosId:string|null;
 checks:string|null;checkedAt:string|null;createdAt:string;updatedAt:string;
}):AppRecord{
 let checks:unknown=null;
 if(row.checks){try{checks=JSON.parse(row.checks);}catch{checks=null;}}
 return {
  id:row.id,name:row.name,symbol:row.symbol,status:row.status as AppStatus,
  firebaseProjectId:row.firebaseProjectId,ga4PropertyId:row.ga4PropertyId,androidPkg:row.androidPkg,
  iosBundleId:row.iosBundleId,appleAppId:row.appleAppId,admobAndroidAppId:row.admobAndroidAppId,
  admobIosAppId:row.admobIosAppId,afAndroidId:row.afAndroidId,afIosId:row.afIosId,
  checks,checkedAt:row.checkedAt,createdAt:row.createdAt,updatedAt:row.updatedAt,
 };
}

export async function listApps({includeArchived=false}:{includeArchived?:boolean}={}):Promise<AppRecord[]>{
 const rows=await getDb().select().from(apps).orderBy(asc(apps.createdAt),asc(apps.id)).all();
 const mapped=rows.map(mapRow);
 return includeArchived?mapped:mapped.filter(a=>a.status==='active');
}

export async function getApp(id:string):Promise<AppRecord|null>{
 const row=await getDb().select().from(apps).where(eq(apps.id,id)).get();
 return row?mapRow(row):null;
}

export async function createApp(input:AppInput):Promise<AppRecord>{
 const now=new Date().toISOString();
 await getDb().insert(apps).values({
  id:input.id,name:input.name,symbol:input.symbol||'',status:input.status||'active',
  firebaseProjectId:input.firebaseProjectId??null,ga4PropertyId:input.ga4PropertyId??null,
  androidPkg:input.androidPkg??null,iosBundleId:input.iosBundleId??null,appleAppId:input.appleAppId??null,
  admobAndroidAppId:input.admobAndroidAppId??null,admobIosAppId:input.admobIosAppId??null,
  afAndroidId:input.afAndroidId??null,afIosId:input.afIosId??null,
  createdAt:now,updatedAt:now,
 });
 const created=await getApp(input.id);
 if(!created)throw Error('create_failed');
 return created;
}

export async function updateApp(id:string,patch:Partial<AppInput>):Promise<AppRecord>{
 const current=await getApp(id);
 if(!current)throw Error('not_found');
 const now=new Date().toISOString();
 await getDb().update(apps).set({
  name:patch.name??current.name,
  symbol:patch.symbol??current.symbol,
  status:patch.status??current.status,
  firebaseProjectId:patch.firebaseProjectId===undefined?current.firebaseProjectId:patch.firebaseProjectId,
  ga4PropertyId:patch.ga4PropertyId===undefined?current.ga4PropertyId:patch.ga4PropertyId,
  androidPkg:patch.androidPkg===undefined?current.androidPkg:patch.androidPkg,
  iosBundleId:patch.iosBundleId===undefined?current.iosBundleId:patch.iosBundleId,
  appleAppId:patch.appleAppId===undefined?current.appleAppId:patch.appleAppId,
  admobAndroidAppId:patch.admobAndroidAppId===undefined?current.admobAndroidAppId:patch.admobAndroidAppId,
  admobIosAppId:patch.admobIosAppId===undefined?current.admobIosAppId:patch.admobIosAppId,
  afAndroidId:patch.afAndroidId===undefined?current.afAndroidId:patch.afAndroidId,
  afIosId:patch.afIosId===undefined?current.afIosId:patch.afIosId,
  updatedAt:now,
 }).where(eq(apps.id,id));
 const updated=await getApp(id);
 if(!updated)throw Error('not_found');
 return updated;
}

export async function setAppChecks(id:string,checks:unknown):Promise<void>{
 await getDb().update(apps).set({checks:JSON.stringify(checks),checkedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}).where(eq(apps.id,id));
}

export async function ensureSeedApps():Promise<void>{
 const existing=await getDb().select({id:apps.id}).from(apps).all();
 if(existing.length)return;
 for(const app of seedApps)await createApp(app);
}

export function admobInventoryFor(app:AppRecord,os:'all'|'android'|'ios'){
 const rows:{os:'android'|'ios';appId:string}[]=[];
 if((os==='all'||os==='android')&&app.admobAndroidAppId)rows.push({os:'android',appId:app.admobAndroidAppId});
 if((os==='all'||os==='ios')&&app.admobIosAppId)rows.push({os:'ios',appId:app.admobIosAppId});
 return rows;
}
