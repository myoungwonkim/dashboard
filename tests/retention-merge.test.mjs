import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeRetentionRows} from '../lib/ga4-cohort.mts';

test('mergeRetentionRows sums users and weights rates by cohort size',()=>{
 const rows=mergeRetentionRows([
  [{cohort:'20260101',users:100,rates:{1:0.4,7:0.2}}],
  [{cohort:'20260101',users:50,rates:{1:0.2,7:0.1}}],
  [{cohort:'20260102',users:10,rates:{1:0.5}}],
 ]);
 assert.equal(rows.length,2);
 const first=rows.find(r=>r.cohort==='20260101');
 assert.ok(first);
 assert.equal(first.users,150);
 assert.ok(Math.abs(first.rates[1]-((0.4*100+0.2*50)/150))<1e-9);
 assert.ok(Math.abs(first.rates[7]-((0.2*100+0.1*50)/150))<1e-9);
});
