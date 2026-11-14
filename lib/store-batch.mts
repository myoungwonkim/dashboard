import {getDb} from '@/db';
import {playConnection,ascConnection,storeDaily,storeBatchRuns,storeDim,storePerfDaily,ascReportRequests} from '@/db/schema';
import {and,eq,gte,lte,desc} from 'drizzle-orm';
import {envelopeConfig} from './ga4-context';
import {unseal} from './admob-crypto.mjs';
import {validatePlayAccount,playAccessToken} from './play-core.mts';
import {fetchPlayCsvMetrics,type DimRow,type PerfDay} from './play-gcs.mts';
import {validateAscAccount,ascJwt,fetchAscSalesUnits,fetchAscApp} from './asc-core.mts';
import {fetchAnalyticsForApp} from './asc-analytics.mts';
import {ensureSeedApps,listApps,refreshAppIcons} from './apps-store.mts';
import {spikeFlag} from './spike.mts';

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

async function upsertDims(appId:string,source:string,dim:string,rows:DimRow[]){
 const db=getDb();const now=new Date().toISOString();let n=0;
 for(const r of rows){
  await db.insert(storeDim).values({
   appId,source,dim,key:r.key,date:r.date,
   installs:r.installs,ratingAvg:r.ratingAvg,visitors:r.visitors,pageViews:r.pageViews,conversions:r.conversions,updatedAt:now,
  }).onConflictDoUpdate({
   target:[storeDim.appId,storeDim.source,storeDim.dim,storeDim.key,storeDim.date],
   set:{installs:r.installs,ratingAvg:r.ratingAvg,visitors:r.visitors,pageViews:r.pageViews,conversions:r.conversions,updatedAt:now},
  });
  n++;
 }
 return n;
}

async function upsertPerf(appId:string,source:string,rows:PerfDay[]){
 const db=getDb();const now=new Date().toISOString();
 for(const r of rows){
  await db.insert(storePerfDaily).values({
   appId,source,date:r.date,
   storeListingVisitors:r.visitors,storeListingAcquisitions:r.acquisitions,conversionRate:r.conversionRate,updatedAt:now,
  }).onConflictDoUpdate({
   target:[storePerfDaily.appId,storePerfDaily.source,storePerfDaily.date],
   set:{storeListingVisitors:r.visitors,storeListingAcquisitions:r.acquisitions,conversionRate:r.conversionRate,updatedAt:now},
  });
 }
 return rows.length;
}

export async function loadStoreRange(appId:string,source:'play'|'asc',startYYYYMMDD:string,endYYYYMMDD:string){
 return getDb().select().from(storeDaily).where(and(eq(storeDaily.appId,appId),eq(storeDaily.source,source),gte(storeDaily.date,startYYYYMMDD),lte(storeDaily.date,endYYYYMMDD))).all();
}

export async function loadStoreDims(appId:string,source:'play'|'asc',dim:string,startYYYYMMDD:string,endYYYYMMDD:string){
 return getDb().select().from(storeDim).where(and(eq(storeDim.appId,appId),eq(storeDim.source,source),eq(storeDim.dim,dim),gte(storeDim.date,startYYYYMMDD),lte(storeDim.date,endYYYYMMDD))).all();
}

export async function loadStorePerf(appId:string,source:'play'|'asc',startYYYYMMDD:string,endYYYYMMDD:string){
 return getDb().select().from(storePerfDaily).where(and(eq(storePerfDaily.appId,appId),eq(storePerfDaily.source,source),gte(storePerfDaily.date,startYYYYMMDD),lte(storePerfDaily.date,endYYYYMMDD))).all();
}

export function summarizeStoreDays(rows:{date:string;installs:number|null;uninstalls:number|null;upgrades:number|null;ratingAvg:number|null;ratingCount:number|null}[]){
 const daily=rows.map(r=>({date:r.date,installs:r.installs||0,uninstalls:r.uninstalls||0,upgrades:r.upgrades||0,ratingAvg:r.ratingAvg,ratingCount:r.ratingCount})).sort((a,b)=>a.date.localeCompare(b.date));
 const installs=daily.reduce((s,r)=>s+r.installs,0);
 const uninstalls=daily.reduce((s,r)=>s+r.uninstalls,0);
 const rated=daily.filter(r=>r.ratingAvg!=null);
 const ratingAvg=rated.length?rated[rated.length-1].ratingAvg:null;
 const ratingCount=rated.length?rated[rated.length-1].ratingCount:null;
 const spike=spikeFlag(daily.map(d=>({date:d.date,value:d.installs})));
 return {installs,uninstalls,ratingAvg,ratingCount,daily,spike};
}

export function aggregateDims(rows:{key:string;installs:number|null;visitors:number|null;pageViews:number|null;conversions:number|null;ratingAvg:number|null}[]){
 const map=new Map<string,{key:string;installs:number;visitors:number;pageViews:number;conversions:number;ratingSum:number;ratingN:number}>();
 for(const r of rows){
  const cur=map.get(r.key)||{key:r.key,installs:0,visitors:0,pageViews:0,conversions:0,ratingSum:0,ratingN:0};
  cur.installs+=r.installs||0;cur.visitors+=r.visitors||0;cur.pageViews+=r.pageViews||0;cur.conversions+=r.conversions||0;
  if(r.ratingAvg!=null){cur.ratingSum+=r.ratingAvg;cur.ratingN++;}
  map.set(r.key,cur);
 }
 return [...map.values()].map(r=>({key:r.key,installs:r.installs,visitors:r.visitors,pageViews:r.pageViews,conversions:r.conversions,ratingAvg:r.ratingN?r.ratingSum/r.ratingN:null})).sort((a,b)=>b.installs-a.installs||b.visitors-a.visitors).slice(0,15);
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
  try{
   const icons=await refreshAppIcons(apps,{force:false});
   detail.icons=icons.map(a=>({app:a.id,source:a.iconSource}));
  }catch(e){detail.iconsError=e instanceof Error?e.message:'icons_failed';}

  const playRow=await db.select().from(playConnection).get();
  if(playRow?.gcsBucket){
   try{
    const account=validatePlayAccount(await unseal(JSON.parse(playRow.envelope),JSON.parse(config.privateKey),config.kid,'play'),playRow.gcsBucket);
    const token=await playAccessToken(account.client_email,account.private_key);
    for(const app of apps.filter(a=>a.androidPkg)){
     try{
      const metrics=await fetchPlayCsvMetrics(playRow.gcsBucket!,app.androidPkg!,token);
      const n=await upsertPlayDays(app.id,metrics.installs,metrics.ratings);
      const c=await upsertDims(app.id,'play','country',metrics.countries);
      const v=await upsertDims(app.id,'play','app_version',metrics.versions);
      const t=await upsertDims(app.id,'play','traffic_source',metrics.traffic);
      const p=await upsertPerf(app.id,'play',metrics.perf);
      (detail.play as unknown[]).push({app:app.id,rows:n,countries:c,versions:v,traffic:t,perf:p,reviewsHistory:metrics.reviewHistory.length});
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
    const token=await ascJwt(account);
    for(const app of apps.filter(a=>a.appleAppId)){
     try{
      const meta=await fetchAscApp(app.appleAppId!,token);
      let salesRows=0,downloads=0;
      if(account.vendorNumber){
       const sales=await fetchAscSalesUnits(account.vendorNumber,token,30,meta.appleAppId);
       salesRows=await upsertAscDays(app.id,sales.daily);
       downloads=sales.downloads;
      }
      const existing=await db.select().from(ascReportRequests).where(eq(ascReportRequests.appleAppId,app.appleAppId!)).orderBy(desc(ascReportRequests.createdAt)).get();
      const analytics=await fetchAnalyticsForApp(app.appleAppId!,token,existing?.requestId||null);
      if(existing){
       await db.update(ascReportRequests).set({requestId:analytics.requestId,lastCheckedAt:new Date().toISOString(),status:analytics.segmentsRead?'ready':'pending'}).where(eq(ascReportRequests.id,existing.id));
      }else{
       await db.insert(ascReportRequests).values({
        id:crypto.randomUUID(),appleAppId:app.appleAppId!,requestId:analytics.requestId,accessType:'ONGOING',
        createdAt:new Date().toISOString(),lastCheckedAt:new Date().toISOString(),status:analytics.segmentsRead?'ready':'pending',
       });
      }
      if(analytics.daily.length){
       const asDownloads=analytics.daily.map(d=>({date:d.date,downloads:d.downloads??d.firstTimeDownloads??d.installations??0}));
       if(!account.vendorNumber)salesRows=await upsertAscDays(app.id,asDownloads);
       const perf=analytics.daily.filter(d=>d.impressions!=null||d.pageViews!=null).map(d=>({
        date:d.date,visitors:d.impressions||0,acquisitions:d.downloads||d.installations||0,
        conversionRate:(d.impressions&&(d.downloads||d.installations))?(d.downloads||d.installations||0)/(d.impressions||1):null,
       }));
       await upsertPerf(app.id,'asc',perf);
      }
      (detail.asc as unknown[]).push({app:app.id,salesRows,downloads,analyticsSegments:analytics.segmentsRead,analyticsDays:analytics.daily.length,requestId:analytics.requestId});
     }catch(e){
      status='partial';
      (detail.asc as unknown[]).push({app:app.id,error:e instanceof Error?e.message:'asc_failed'});
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
