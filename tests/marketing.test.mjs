import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMarketingCsv,roas,cpi,isMarketingSource} from '../lib/marketing-format.mts';
import {normalizeCustomerId,validateGoogleAdsCreds} from '../lib/marketing-google.mts';
import {normalizeAdAccountId,validateMetaAdsCreds} from '../lib/marketing-meta.mts';

test('parseMarketingCsv reads headered rows',()=>{
 const {rows,errors}=parseMarketingCsv('date,app_id,source,spend,currency,note\n2024-01-01,bazi,manual,12.5,USD,test\n2024-01-02,sudoku,facebook,8,USD,');
 assert.equal(errors.length,0);
 assert.equal(rows.length,2);
 assert.equal(rows[0].spend,12.5);
 assert.equal(rows[1].source,'meta');
});

test('parseMarketingCsv maps google alias and rejects bad source',()=>{
 const {rows,errors}=parseMarketingCsv('2024-01-01,bazi,google,1\n2024-01-01,bazi,tiktok,1');
 assert.equal(rows.length,1);
 assert.equal(rows[0].source,'google_ads');
 assert.ok(errors.some(e=>e.includes('source')));
});

test('roas and source helpers',()=>{
 assert.equal(roas(100,25),4);
 assert.equal(roas(100,0),null);
 assert.equal(isMarketingSource('manual'),true);
 assert.equal(isMarketingSource('tiktok'),false);
});

test('cpi is spend divided by acquisitions',()=>{
 assert.equal(cpi(100,50),2);
 assert.equal(cpi(12.5,10),1.25);
 assert.equal(cpi(100,0),null);
 assert.equal(cpi(null,10),null);
});

test('CSV template header matches parser expectations',()=>{
 const sample='date,app_id,source,spend,currency,note\n2024-01-01,bazi,google_ads,12.50,USD,예시\n2024-01-02,bazi,meta,8,USD,';
 const {rows,errors}=parseMarketingCsv(sample);
 assert.equal(errors.length,0);
 assert.equal(rows.length,2);
 assert.equal(rows[0].currency,'USD');
 assert.equal(rows[0].note,'예시');
});

test('google ads credential validation',()=>{
 assert.equal(normalizeCustomerId('123-456-7890'),'1234567890');
 const c=validateGoogleAdsCreds({client_id:'a',client_secret:'b',refresh_token:'c',developer_token:'d',customer_id:'123-456-7890'});
 assert.equal(c.customer_id,'1234567890');
 assert.throws(()=>validateGoogleAdsCreds({client_id:'a'}));
});

test('meta credential validation',()=>{
 assert.equal(normalizeAdAccountId('12345'),'act_12345');
 assert.equal(normalizeAdAccountId('act_99'),'act_99');
 const c=validateMetaAdsCreds({access_token:'tok',ad_account_id:'act_1'});
 assert.equal(c.ad_account_id,'act_1');
 assert.throws(()=>validateMetaAdsCreds({access_token:''}));
});
