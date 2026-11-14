import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregatePoints,bucketKey,formatBucketLabel,normalizeChartDate} from '../lib/chart-aggregate.mts';

test('normalize accepts YYYYMMDD and ISO dates',()=>{
 assert.equal(normalizeChartDate('20261101'),'2026-11-01');
 assert.equal(normalizeChartDate('2026-11-01'),'2026-11-01');
});

test('week buckets start on Monday UTC',()=>{
 // 2026-11-04 is Wednesday → week starts 2026-11-02
 assert.equal(bucketKey('20261104','week'),'20261102');
 assert.equal(bucketKey('2026-11-02','week'),'20261102');
 assert.equal(bucketKey('20261115','month'),'202611');
});

test('aggregate sums daily into weeks and months',()=>{
 const points=[
  {date:'20261102',value:2},
  {date:'20261103',value:3},
  {date:'20261109',value:5},
  {date:'20261201',value:10},
 ];
 assert.deepEqual(aggregatePoints(points,'week'),[
  {date:'20261102',value:5},
  {date:'20261109',value:5},
  {date:'20261130',value:10},
 ]);
 assert.deepEqual(aggregatePoints(points,'month'),[
  {date:'202611',value:10},
  {date:'202612',value:10},
 ]);
 assert.deepEqual(aggregatePoints(points,'day', 'avg').map(p=>p.value),[2,3,5,10]);
});

test('bucket labels stay short for axes',()=>{
 assert.equal(formatBucketLabel('20261102'),'11/02');
 assert.equal(formatBucketLabel('202611'),'2026.11');
});
