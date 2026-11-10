import {getDb} from '@/db';
import {playConnection,ascConnection,storeDaily,storeBatchRuns} from '@/db/schema';
import {and,eq,gte,lte} from 'drizzle-orm';
import {envelopeConfig} from './ga4-context';
import {unseal} from './admob-crypto.mjs';
import {validatePlayAccount,playAccessToken} from './play-core.mts';
import {fetchPlayCsvMetrics} from './play-gcs.mts';
import {validateAscAccount,ascJwt,fetchAscSalesUnits,fetchAscApp} from './asc-core.mts';
import {ensureSeedApps,listApps} from './apps-store.mts';

export type BatchResult={id:string;status:'ok'|'partial'|'error';detail:Record<string,unknown>;startedAt:string;finishedAt:string};

async function upsertPlayDays(appId:string,installs:{date:string;installs:number;uninstalls:number;upgrades:number}[],ratings:{date:string;ratingAvg:number;ratingCount:number|null}[]){
 const db=getDb();const now=new Date().toISOString();
 const byDate=new Map<string,{installs?:number;uninstalls?:number;upgrades?:number;ratingAvg?:number;ratingCount?:number|null}>();
 for(const r of installs)byDate.set(r.date,{...(byDate.get(r.date)||{}),installs:r.installs,uninstalls:r.uninstalls,upgrades:r.upgrades});
 for(const r of ratings)byDate.set(r.date,{...(byDate.get(r.date)||{}),ratingAvg:r.ratingAvg,ratingCount:r.ratingCount});
 for(const [date,v] of byDate){
  await db.insert(storeDaily).values({
   appId,source:'play',date,
   installs:v.installs??null,uninstalls:v.uninstalls??null,upgrades:v.upgrades??null,
   ratingAvg:v.ratingAvg??null,ratingCount:v.ratingCount??null,updatedAt:now,
  }).onConflictDoUpdate({
   target:[storeDaily.appId,storeDaily.source,storeDaily.date],
   set:{
    installs:v.installs??null,uninstalls:v.uninstalls??null,upgrades:v.upgrades??null,
    ratingAvg:v.ratingAvg??null,ratingCount:v.ratingCount??null,updatedAt:now,
   },
  });
 }
 return byDate.size;
}

async function upsertAscDays(appId:string,daily:{date:string;downloads:number}[]){
 const db=getDb();const now=new Date().toISOString();
 for(const row of daily){
  await db.insert(storeDaily).values({
   appId,source:'asc',date:row.date,installs:row.downloads,uninstalls:null,upgrades:null,ratingAvg:null,ratingCount:null,updatedAt:now,
  }).onConflictDoUpdate({
   target:[storeDaily.appId,storeDaily.source,storeDaily.date],
   set:{installs:row.downloads,updatedAt:now},
  });
 }
 return daily.length;
}

export async function loadStoreRange(appId:string,source:'play'|'asc',startYYYYMMDD:string,endYYYYMMDD:string){
 return getDb().select().from(storeDaily).where(and(eq(storeDaily.appId,appId),eq(storeDaily.source,source),gte(storeDaily.date,startYYYYMMDD),lte(storeDaily.date,endYYYYMMDD))).all();
}

export function summarizeStoreDays(rows:{date:string;installs:number|null;uninstalls:number|null;upgrades:number|null;ratingAvg:number|null;ratingCount:number|null}[]){
 const daily=rows.map(r=>({date:r.date,installs:r.installs||0,uninstalls:r.uninstalls||0,upgrades:r.upgrades||0,ratingAvg:r.ratingAvg,ratingCount:r.ratingCount})).sort((a,b)=>a.date.localeCompare(b.date));
 const installs=daily.reduce((s,r)=>s+r.installs,0);
 const uninstalls=daily.reduce((s,r)=>s+r.uninstalls,0);
 const rated=daily.filter(r=>r.ratingAvg!=null);
 const ratingAvg=rated.length?rated[rated.length-1].ratingAvg:null;
 const ratingCount=rated.length?rated[rated.length-1].ratingCount:null;
 return {installs,uninstalls,ratingAvg,ratingCount,daily};
}

export async function runStoreBatch():Promise<BatchResult>{
 const id=crypto.randomUUID();const startedAt=new Date().toISOString();
 const detail:Record<string,unknown>={play:[],asc:[]};
 let status:'ok'|'partial'|'error'='ok';
 const db=getDb();
 await db.insert(storeBatchRuns).values({id,startedAt,status:'running',detail:null});
 try{
  await ensureSeedApps();
  const apps=await listApps();
  const config=envelopeConfig();

  const playRow=await db.select().from(playConnection).get();
  if(playRow?.gcsBucket){
   try{
    const account=validatePlayAccount(await unseal(JSON.parse(playRow.envelope),JSON.parse(config.privateKey),config.kid,'play'),playRow.gcsBucket);
    const token=await playAccessToken(account.client_email,account.private_key);
    for(const app of apps.filter(a=>a.androidPkg)){
     try{
      const metrics=await fetchPlayCsvMetrics(playRow.gcsBucket!,app.androidPkg!,token);
      const n=await upsertPlayDays(app.id,metrics.installs,metrics.ratings);
      (detail.play as unknown[]).push({app:app.id,rows:n,installDays:metrics.installs.length,ratingDays:metrics.ratings.length});
     }catch(e){
      status='partial';
      (detail.play as unknown[]).push({app:app.id,error:e instanceof Error?e.message:'play_failed'});
     }
    }
   }catch(e){
    status='partial';
    detail.playError=e instanceof Error?e.message:'play_auth_failed';
   }
  }else{
   detail.playSkipped='no_bucket';
  }

  const ascRow=await db.select().from(ascConnection).get();
  if(ascRow){
   try{
    const account=validateAscAccount(await unseal(JSON.parse(ascRow.envelope),JSON.parse(config.privateKey),config.kid,'asc'));
    if(!account.vendorNumber){
     detail.ascSkipped='no_vendor_number';
    }else{
     const token=await ascJwt(account);
     for(const app of apps.filter(a=>a.appleAppId)){
      try{
       const meta=await fetchAscApp(app.appleAppId!,token);
       const sales=await fetchAscSalesUnits(account.vendorNumber,token,30,meta.appleAppId);
       const n=await upsertAscDays(app.id,sales.daily);
       (detail.asc as unknown[]).push({app:app.id,rows:n,downloads:sales.downloads});
      }catch(e){
       status='partial';
       (detail.asc as unknown[]).push({app:app.id,error:e instanceof Error?e.message:'asc_failed'});
      }
     }
    }
   }catch(e){
    status='partial';
    detail.ascError=e instanceof Error?e.message:'asc_auth_failed';
   }
  }else{
   detail.ascSkipped='not_configured';
  }

  if(!(detail.play as unknown[]).length&&!(detail.asc as unknown[]).length&&detail.playSkipped&&detail.ascSkipped)status='error';
  const finishedAt=new Date().toISOString();
  await db.update(storeBatchRuns).set({finishedAt,status,detail:JSON.stringify(detail)}).where(eq(storeBatchRuns.id,id));
  return {id,status,detail,startedAt,finishedAt};
 }catch(e){
  const finishedAt=new Date().toISOString();
  const message=e instanceof Error?e.message:'batch_failed';
  await db.update(storeBatchRuns).set({finishedAt,status:'error',detail:JSON.stringify({error:message})}).where(eq(storeBatchRuns.id,id));
  return {id,status:'error',detail:{error:message},startedAt,finishedAt};
 }
}
