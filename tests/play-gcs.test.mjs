import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInstallOverviewCsv,parseRatingsOverviewCsv,playStatsObjectName,yearMonthsAround} from '../lib/play-gcs.mts';

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

test('object names and month windows are stable',()=>{
 assert.equal(playStatsObjectName('installs','com.a.b','202611'),'stats/installs/installs_com.a.b_202611_overview.csv');
 const months=yearMonthsAround(new Date(Date.UTC(2026,10,15)),3);
 assert.deepEqual(months,['202611','202610','202609']);
});
