import test from 'node:test';
import assert from 'node:assert/strict';
import {sumNums,meanNums,weightedMean} from '../lib/metric-rollups.mts';

test('sum and mean ignore nulls',()=>{
 assert.equal(sumNums([1,null,2]),3);
 assert.equal(meanNums([1,null,3]),2);
 assert.equal(sumNums([null]),null);
});

test('weighted mean skips bad weights',()=>{
 assert.equal(weightedMean([{value:0.4,weight:100},{value:0.2,weight:100}]),0.3);
 assert.equal(weightedMean([{value:0.5,weight:0},{value:null,weight:10}]),null);
});
