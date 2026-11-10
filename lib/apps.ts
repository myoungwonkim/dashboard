export type AppStatus='active'|'archived';
export type AppRecord={
 id:string;
 name:string;
 symbol:string;
 status:AppStatus;
 firebaseProjectId:string|null;
 ga4PropertyId:string|null;
 androidPkg:string|null;
 iosBundleId:string|null;
 appleAppId:string|null;
 admobAndroidAppId:string|null;
 admobIosAppId:string|null;
 afAndroidId:string|null;
 afIosId:string|null;
 checks:unknown;
 checkedAt:string|null;
 createdAt:string;
 updatedAt:string;
};
export type AppInput={
 id:string;
 name:string;
 symbol?:string;
 status?:AppStatus;
 firebaseProjectId?:string|null;
 ga4PropertyId?:string|null;
 androidPkg?:string|null;
 iosBundleId?:string|null;
 appleAppId?:string|null;
 admobAndroidAppId?:string|null;
 admobIosAppId?:string|null;
 afAndroidId?:string|null;
 afIosId?:string|null;
};
export const SLUG_RE=/^[a-z][a-z0-9-]{0,31}$/;
export const RESERVED_SLUGS=new Set(['overview','connections','progress','login','api','assets','apps','new']);
export const ADMOB_APP_ID_RE=/^ca-app-pub-\d{16}~\d{10}$/;
export const GA4_PROPERTY_RE=/^\d{6,12}$/;
export const PKG_RE=/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

/** Seed rows used by migrations and local fixtures. */
export const seedApps:AppInput[]=[
 {id:'bazi',name:'읽어주는 만세력',symbol:'命',firebaseProjectId:'bazi-ea78b',ga4PropertyId:'550050295',androidPkg:'com.nolsoopgames.bazi',admobAndroidAppId:'ca-app-pub-4999376453226791~5692726639',admobIosAppId:'ca-app-pub-4999376453226791~2304842432'},
 {id:'sudoku',name:'스도쿠 마스터',symbol:'9',firebaseProjectId:'sudoku-master-8998c',ga4PropertyId:'558243778',androidPkg:'com.nolsoopgames.sudoku',admobAndroidAppId:'ca-app-pub-4999376453226791~7315994561',admobIosAppId:'ca-app-pub-4999376453226791~2158003782'},
];

export function emptyToNull(value:unknown):string|null{
 if(value===undefined||value===null)return null;
 const text=String(value).trim();
 return text?text:null;
}

export function validateAppInput(input:Record<string,unknown>,{partial=false}:{partial?:boolean}={}):AppInput{
 const id=String(input.id||'').trim();
 if(!partial||input.id!==undefined){
  if(!SLUG_RE.test(id)||RESERVED_SLUGS.has(id))throw Error('invalid_app_id');
 }
 const name=input.name===undefined&&partial?undefined:String(input.name||'').trim();
 if(name!==undefined&&(name.length<1||name.length>80))throw Error('invalid_app_name');
 const symbol=input.symbol===undefined?undefined:String(input.symbol||'').slice(0,4);
 const status=input.status===undefined?undefined:String(input.status);
 if(status!==undefined&&status!=='active'&&status!=='archived')throw Error('invalid_status');
 const ga4PropertyId=input.ga4PropertyId===undefined?undefined:emptyToNull(input.ga4PropertyId);
 if(ga4PropertyId&&!GA4_PROPERTY_RE.test(ga4PropertyId))throw Error('invalid_ga4_property');
 const androidPkg=input.androidPkg===undefined?undefined:emptyToNull(input.androidPkg);
 if(androidPkg&&!PKG_RE.test(androidPkg))throw Error('invalid_android_pkg');
 const admobAndroidAppId=input.admobAndroidAppId===undefined?undefined:emptyToNull(input.admobAndroidAppId);
 const admobIosAppId=input.admobIosAppId===undefined?undefined:emptyToNull(input.admobIosAppId);
 if(admobAndroidAppId&&!ADMOB_APP_ID_RE.test(admobAndroidAppId))throw Error('invalid_admob_id');
 if(admobIosAppId&&!ADMOB_APP_ID_RE.test(admobIosAppId))throw Error('invalid_admob_id');
 return {
  id:partial&&input.id===undefined?'':id,
  name:name??'',
  symbol,
  status:status as AppStatus|undefined,
  firebaseProjectId:input.firebaseProjectId===undefined?undefined:emptyToNull(input.firebaseProjectId),
  ga4PropertyId,
  androidPkg,
  iosBundleId:input.iosBundleId===undefined?undefined:emptyToNull(input.iosBundleId),
  appleAppId:input.appleAppId===undefined?undefined:emptyToNull(input.appleAppId),
  admobAndroidAppId,
  admobIosAppId,
  afAndroidId:input.afAndroidId===undefined?undefined:emptyToNull(input.afAndroidId),
  afIosId:input.afIosId===undefined?undefined:emptyToNull(input.afIosId),
 };
}

export function appBadges(app:Pick<AppRecord,'ga4PropertyId'|'admobAndroidAppId'|'admobIosAppId'|'androidPkg'|'appleAppId'|'afAndroidId'|'afIosId'>){
 return {
  ga4:!!app.ga4PropertyId,
  admob:!!(app.admobAndroidAppId||app.admobIosAppId),
  play:!!app.androidPkg,
  asc:!!app.appleAppId,
  appsflyer:!!(app.afAndroidId||app.afIosId),
 };
}
