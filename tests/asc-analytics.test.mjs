import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAnalyticsSegment} from '../lib/asc-analytics.mts';

test('ASC analytics TSV aggregates downloads and crashes by date',()=>{
 const text=`Date\tTotal Downloads\tFirst-Time Downloads\tCrashes\tImpressions\tProduct Page Views
2026-11-01\t10\t7\t1\t100\t40
2026-11-01\t5\t3\t0\t50\t20
2026-11-02\t4\t4\t2\t80\t30`;
 const rows=parseAnalyticsSegment(text);
 assert.equal(rows[0].date,'20261101');
 assert.equal(rows[0].downloads,15);
 assert.equal(rows[0].crashes,1);
 assert.equal(rows[1].impressions,80);
});
