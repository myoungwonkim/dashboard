import test from 'node:test';
import assert from 'node:assert/strict';
import {adArpu,adArpdau,fmtUsd} from '../lib/arpu.mts';

test('adArpu divides revenue by period active users',()=>{
 assert.equal(adArpu(10,100),0.1);
 assert.equal(adArpu(10,0),null);
 assert.equal(adArpu(null,10),null);
});

test('adArpdau uses average DAU times days',()=>{
 assert.equal(adArpdau(70,10,7),1);
 assert.equal(adArpdau(70,0,7),null);
});

test('fmtUsd formats or dashes',()=>{
 assert.equal(fmtUsd(0.1234),'$0.123');
 assert.equal(fmtUsd(null),'—');
});
