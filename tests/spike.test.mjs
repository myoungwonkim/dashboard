import test from 'node:test';
import assert from 'node:assert/strict';
import {spikeFlag} from '../lib/spike.mts';

test('spike detects sudden rise against baseline',()=>{
 const daily=Array.from({length:7},(_,i)=>({date:`2026110${i+1}`,value:10}));
 daily.push({date:'20261108',value:40});
 const spike=spikeFlag(daily,{minAbs:10,ratio:2});
 assert.equal(spike?.direction,'up');
 assert.ok((spike?.ratio||0)>=2);
});

test('spike returns null for flat series',()=>{
 const daily=Array.from({length:8},(_,i)=>({date:`2026110${i+1}`,value:12}));
 assert.equal(spikeFlag(daily),null);
});
