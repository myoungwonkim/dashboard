import {sqliteTable,text,integer,real,primaryKey} from 'drizzle-orm/sqlite-core';
// The service-account private key is encrypted. The wrapping key is a Sites secret.
export const ga4Connection=sqliteTable('ga4_connection',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),
 envelope:text('envelope').notNull(),createdAt:text('created_at').notNull(),checks:text('checks'),checkedAt:text('checked_at'),
});
// Credentials and refresh tokens are encrypted; the key lives in native runtime secrets.
export const admobConnection=sqliteTable('admob_connection',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),clientEnvelope:text('client_envelope').notNull(),tokenEnvelope:text('token_envelope'),createdAt:text('created_at').notNull(),verifiedAt:text('verified_at'),
});
export const admobOAuthState=sqliteTable('admob_oauth_state',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),cookieHash:text('cookie_hash').notNull(),verifier:text('verifier').notNull(),expiresAt:text('expires_at').notNull(),
});
export const playConnection=sqliteTable('play_connection',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),
 envelope:text('envelope').notNull(),gcsBucket:text('gcs_bucket'),createdAt:text('created_at').notNull(),verifiedAt:text('verified_at'),checks:text('checks'),
});
export const ascConnection=sqliteTable('asc_connection',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),
 envelope:text('envelope').notNull(),createdAt:text('created_at').notNull(),verifiedAt:text('verified_at'),checks:text('checks'),
});
export const storeDaily=sqliteTable('store_daily',{
 appId:text('app_id').notNull(),
 source:text('source').notNull(),
 date:text('date').notNull(),
 installs:integer('installs'),
 uninstalls:integer('uninstalls'),
 upgrades:integer('upgrades'),
 ratingAvg:real('rating_avg'),
 ratingCount:integer('rating_count'),
 updatedAt:text('updated_at').notNull(),
},(t)=>({pk:primaryKey({columns:[t.appId,t.source,t.date]})}));
export const storeBatchRuns=sqliteTable('store_batch_runs',{
 id:text('id').primaryKey(),
 startedAt:text('started_at').notNull(),
 finishedAt:text('finished_at'),
 status:text('status').notNull(),
 detail:text('detail'),
});
export const storeDim=sqliteTable('store_dim',{
 appId:text('app_id').notNull(),
 source:text('source').notNull(),
 dim:text('dim').notNull(),
 key:text('key').notNull(),
 date:text('date').notNull(),
 installs:integer('installs'),
 ratingAvg:real('rating_avg'),
 visitors:integer('visitors'),
 pageViews:integer('page_views'),
 conversions:integer('conversions'),
 updatedAt:text('updated_at').notNull(),
},(t)=>({pk:primaryKey({columns:[t.appId,t.source,t.dim,t.key,t.date]})}));
export const storePerfDaily=sqliteTable('store_perf_daily',{
 appId:text('app_id').notNull(),
 source:text('source').notNull(),
 date:text('date').notNull(),
 storeListingVisitors:integer('store_listing_visitors'),
 storeListingAcquisitions:integer('store_listing_acquisitions'),
 conversionRate:real('conversion_rate'),
 updatedAt:text('updated_at').notNull(),
},(t)=>({pk:primaryKey({columns:[t.appId,t.source,t.date]})}));
export const ascReportRequests=sqliteTable('asc_report_requests',{
 id:text('id').primaryKey(),
 appleAppId:text('apple_app_id').notNull(),
 requestId:text('request_id').notNull(),
 accessType:text('access_type').notNull(),
 createdAt:text('created_at').notNull(),
 lastCheckedAt:text('last_checked_at'),
 status:text('status'),
});
export const apps=sqliteTable('apps',{
 id:text('id').primaryKey(),
 name:text('name').notNull(),
 symbol:text('symbol').notNull().default(''),
 status:text('status').notNull().default('active'),
 firebaseProjectId:text('firebase_project_id'),
 ga4PropertyId:text('ga4_property_id'),
 androidPkg:text('android_pkg'),
 iosBundleId:text('ios_bundle_id'),
 appleAppId:text('apple_app_id'),
 admobAndroidAppId:text('admob_android_app_id'),
 admobIosAppId:text('admob_ios_app_id'),
 afAndroidId:text('af_android_id'),
 afIosId:text('af_ios_id'),
 iconUrl:text('icon_url'),
 iconSource:text('icon_source'),
 iconFetchedAt:text('icon_fetched_at'),
 checks:text('checks'),
 checkedAt:text('checked_at'),
 createdAt:text('created_at').notNull(),
 updatedAt:text('updated_at').notNull(),
});
