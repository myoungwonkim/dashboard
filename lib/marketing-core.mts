import {getDb} from '@/db';
import {marketingDaily} from '@/db/schema';
import {and,eq,gte,lte} from 'drizzle-orm';
import {type MarketingDay,rollupMarketing} from './marketing-format.mts';
export * from './marketing-format.mts';

export async function upsertMarketingDays(rows:MarketingDay[]){
 if(!rows.length)return 0;
 const db=getDb();
 const now=new Date().toISOString();
 let n=0;
 for(const row of rows){
  await db.insert(marketingDaily).values({
   appId:row.appId,source:row.source,date:row.date,spend:row.spend,currency:row.currency,note:row.note??null,updatedAt:now,
  }).onConflictDoUpdate({
   target:[marketingDaily.appId,marketingDaily.source,marketingDaily.date],
   set:{spend:row.spend,currency:row.currency,note:row.note??null,updatedAt:now},
  });
  n++;
 }
 return n;
}

export type MarketingDayKey={appId:string;source:string;date:string};

export async function deleteMarketingDays(keys:MarketingDayKey[]){
 if(!keys.length)return 0;
 const db=getDb();
 let n=0;
 for(const key of keys){
  if(!key.appId||!key.source||!/^\d{4}-\d{2}-\d{2}$/.test(key.date))continue;
  const removed=await db.delete(marketingDaily).where(and(
   eq(marketingDaily.appId,key.appId),
   eq(marketingDaily.source,key.source),
   eq(marketingDaily.date,key.date),
  )).returning({appId:marketingDaily.appId});
  n+=removed.length;
 }
 return n;
}

export async function loadMarketingRange(opts:{appId?:string;startDate:string;endDate:string}){
 const db=getDb();
 const conds=[gte(marketingDaily.date,opts.startDate),lte(marketingDaily.date,opts.endDate)];
 if(opts.appId)conds.push(eq(marketingDaily.appId,opts.appId));
 const rows=await db.select().from(marketingDaily).where(and(...conds)).all();
 return rows.map(r=>({appId:r.appId,source:r.source as MarketingDay['source'],date:r.date,spend:r.spend,currency:r.currency,note:r.note}));
}

export {rollupMarketing};
