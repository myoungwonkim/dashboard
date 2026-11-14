import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlayAccount,parseInstallCsv,parseReviews,parseVitals,parsePlayQuery,parseAcquisitionInstalls,fetchPlayReport} from '../lib/play-core.mts';

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

test('play query keeps optional startDate and endDate',()=>{
 const q=parsePlayQuery({app:'bazi',days:14,startDate:'2026-11-01',endDate:'2026-11-14'});
 assert.equal(q.startDate,'2026-11-01');
 assert.equal(q.endDate,'2026-11-14');
 assert.equal(parsePlayQuery({app:'sudoku',days:7}).startDate,undefined);
});

test('fetchPlayReport soft-fails reviews 403 so installs path can continue',async()=>{
 const fetcher=async(url)=>{
  if(String(url).includes('/reviews'))return new Response('forbidden',{status:403});
  if(String(url).includes('crashRateMetricSet'))return new Response('{}',{status:404});
  return new Response('no',{status:500});
 };
 const report=await fetchPlayReport('com.nolsoopgames.bazi','token',fetcher);
 assert.equal(report.reviews.length,0);
 assert.match(report.note,/리뷰 API 권한/);
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
