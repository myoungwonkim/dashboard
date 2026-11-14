import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInstallOverviewCsv,parseRatingsOverviewCsv,parseDimCsv,parseStorePerfOverviewCsv,playStatsObjectName,playPerfObjectName,yearMonthsAround,yearMonthsForRange,decodeMaybeUtf16,decodePlayCsvBytes,parseReviewsHistoryCsv} from '../lib/play-gcs.mts';

test('install overview csv captures uninstalls and upgrades',()=>{
 const csv=`Date,Package Name,Daily Device Installs,Daily Device Uninstalls,Daily Device Upgrades
2026-11-01,com.nolsoopgames.bazi,10,2,1
2026-11-02,com.nolsoopgames.bazi,5,1,0
2026-11-02,com.other.app,99,0,0`;
 const rows=parseInstallOverviewCsv(csv,'com.nolsoopgames.bazi');
 assert.equal(rows.length,2);
 assert.equal(rows[0].installs,10);
 assert.equal(rows[0].uninstalls,2);
 assert.equal(rows[1].upgrades,0);
});

test('ratings overview csv parses daily average',()=>{
 const csv=`Date,Package Name,Daily Average Rating,Total Average Rating
2026-11-01,com.nolsoopgames.bazi,4.5,4.4
2026-11-02,com.nolsoopgames.bazi,4.6,4.45`;
 const rows=parseRatingsOverviewCsv(csv,'com.nolsoopgames.bazi');
 assert.equal(rows[1].ratingAvg,4.6);
});

test('country dim and store performance parsers',()=>{
 const dim=`Date,Package Name,Country,Daily Device Installs
2026-11-01,com.nolsoopgames.bazi,KR,8
2026-11-01,com.nolsoopgames.bazi,US,2`;
 assert.equal(parseDimCsv(dim,'com.nolsoopgames.bazi',/country/i)[0].key,'KR');
 const perf=`Date,Package Name,Store Listing Visitors,Store Listing Acquisitions,Store Listing Conversion Rate
2026-11-01,com.nolsoopgames.bazi,100,10,10`;
 const p=parseStorePerfOverviewCsv(perf,'com.nolsoopgames.bazi');
 assert.equal(p[0].visitors,100);
 assert.equal(p[0].conversionRate,0.1);
});

test('object names and month windows are stable',()=>{
 assert.equal(playStatsObjectName('installs','com.a.b','202611'),'stats/installs/installs_com.a.b_202611_overview.csv');
 assert.equal(playStatsObjectName('installs','com.a.b','202611','country'),'stats/installs/installs_com.a.b_202611_country.csv');
 assert.equal(playPerfObjectName('com.a.b','202611'),'stats/store_performance/store_performance_com.a.b_202611_overview.csv');
 const months=yearMonthsAround(new Date(Date.UTC(2026,10,15)),3);
 assert.deepEqual(months,['202611','202610','202609']);
});

test('utf-16 reviews history decode and parse',()=>{
 const csv='Package Name,Review Submit Date and Time,Star Rating,Review Title,Review Text,Reviewer Language\ncom.nolsoopgames.bazi,2026-11-01T00:00:00Z,5,Nice,Great app,en\n';
 const encoded=new TextEncoder().encode('\uFEFF'+csv); // utf-8 bom path
 assert.ok(decodeMaybeUtf16(encoded.buffer).includes('Nice'));
 const rows=parseReviewsHistoryCsv(csv,'com.nolsoopgames.bazi');
 assert.equal(rows[0].rating,5);
});

test('Play install CSV survives UTF-16LE decode (Console export format)',async()=>{
 const csv=`Date,Package Name,Daily Device Installs\n2026-11-01,com.nolsoopgames.bazi,10\n`;
 const utf16=new Uint8Array(2+csv.length*2);
 utf16[0]=0xFF;utf16[1]=0xFE;
 for(let i=0;i<csv.length;i++){utf16[2+i*2]=csv.charCodeAt(i);utf16[3+i*2]=0;}
 const text=await decodePlayCsvBytes(utf16.buffer);
 const rows=parseInstallOverviewCsv(text,'com.nolsoopgames.bazi');
 assert.equal(rows[0].installs,10);
});

test('yearMonthsForRange covers window plus prior month',()=>{
 assert.deepEqual(yearMonthsForRange('20261101','20261114'),['202611','202610']);
 assert.deepEqual(yearMonthsForRange('20261015','20261202'),['202612','202611','202610','202609']);
});
