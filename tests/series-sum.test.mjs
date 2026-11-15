import test from 'node:test';
import assert from 'node:assert/strict';
import {sumPointsByDate,dailyEcpi} from '../lib/series-sum.mts';

test('sumPointsByDate merges YYYYMMDD and ISO dates',()=>{
 const out=sumPointsByDate([
  [{date:'20240101',value:10},{date:'20240102',value:3}],
  [{date:'2024-01-01',value:5},{date:'2024-01-03',value:2}],
 ]);
 assert.deepEqual(out,[
  {date:'2024-01-01',value:15},
  {date:'2024-01-02',value:3},
  {date:'2024-01-03',value:2},
 ]);
});

test('dailyEcpi is spend over new users per day',()=>{
 const out=dailyEcpi(
  [{date:'2024-01-01',value:20},{date:'2024-01-02',value:10}],
  [{date:'20240101',value:10},{date:'2024-01-02',value:0}],
 );
 assert.equal(out.length,1);
 assert.equal(out[0].date,'2024-01-01');
 assert.equal(out[0].value,2);
});
