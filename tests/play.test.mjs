import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlayAccount,parseInstallCsv,parseReviews,parseVitals,parsePlayQuery,parseAcquisitionInstalls} from '../lib/play-core.mts';

test('Play account validation requires service account shape',()=>{
 assert.throws(()=>validatePlayAccount({type:'user'}));
 const ok=validatePlayAccount({type:'service_account',client_email:'reader@x.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'},'pubsite_prod_rev_123');
 assert.equal(ok.gcsBucket,'pubsite_prod_rev_123');
 assert.throws(()=>validatePlayAccount({type:'service_account',client_email:'reader@x.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'},'BAD BUCKET'));
});

test('install CSV sums only matching package rows',()=>{
 const csv=`Date,Package Name,Daily Device Installs
2026-11-01,com.nolsoopgames.bazi,10
2026-11-02,com.nolsoopgames.bazi,5
2026-11-02,com.other.app,99`;
 const data=parseInstallCsv(csv,'com.nolsoopgames.bazi');
 assert.equal(data.installs,15);
 assert.equal(data.daily.length,2);
 assert.equal(data.daily[0].date,'20261101');
});

test('reviews and vitals parsers reject malformed payloads',()=>{
 assert.throws(()=>parseReviews({}));
 const reviews=parseReviews({reviews:[{reviewId:'r1',authorName:'A',comments:[{userComment:{text:'nice',starRating:5,lastModified:{seconds:'1700000000'}}}]}]});
 assert.equal(reviews[0].rating,5);
 assert.throws(()=>parseVitals({}));
 assert.equal(parseVitals({rows:[{metrics:{crashRate:{decimalValue:'0.02'},anrRate:{decimalValue:'0.01'}}}]}).crashFreeRate,0.98);
});

test('play query accepts registry slugs only',()=>{
 assert.equal(parsePlayQuery({app:'bazi',days:7}).app,'bazi');
 assert.throws(()=>parsePlayQuery({app:'550050295',days:7}));
});

test('acquisition install parser sums daily metric rows',()=>{
 const parsed=parseAcquisitionInstalls({rows:[
  {startTime:{year:2026,month:11,day:1},metrics:[{metric:'newUsers',decimalValue:'4'}]},
  {startTime:{year:2026,month:11,day:2},metrics:[{metric:'newUsers',decimalValue:'6'}]},
 ]});
 assert.equal(parsed?.installs,10);
 assert.equal(parsed?.daily[0].date,'20261101');
 assert.equal(parseAcquisitionInstalls({rows:[]}),null);
});
