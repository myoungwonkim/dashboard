import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAscAccount,parseAscUnitsReport,parseAscApp,parseAscQuery,parseAscReviews} from '../lib/asc-core.mts';

test('ASC account requires issuer, key id and p8',()=>{
 assert.throws(()=>validateAscAccount({issuerId:'bad',keyId:'ABCDEFGHIJ',privateKey:'-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----'}));
 const ok=validateAscAccount({issuerId:'12345678-1234-1234-1234-1234567890ab',keyId:'ABCDEFGHIJ',privateKey:'-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----',vendorNumber:'12345678'});
 assert.equal(ok.keyId,'ABCDEFGHIJ');
 assert.equal(ok.vendorNumber,'12345678');
 assert.throws(()=>validateAscAccount({issuerId:'12345678-1234-1234-1234-1234567890ab',keyId:'ABCDEFGHIJ',privateKey:'-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----',vendorNumber:'abc'}));
});

test('ASC units report aggregates by day and filters product type',()=>{
 const text=`Begin Date\tUnits\tApple Identifier\tProduct Type Identifier
2026-11-01\t3\t123\t1
2026-11-01\t2\t123\t1F
2026-11-01\t9\t123\t7
2026-11-02\t4\t123\t1`;
 const data=parseAscUnitsReport(text,'123');
 assert.equal(data.downloads,9);
 assert.equal(data.daily[0].downloads,5);
});

test('ASC app payload, reviews and query validation',()=>{
 assert.throws(()=>parseAscApp({}));
 assert.equal(parseAscApp({data:{id:'1234567890',attributes:{name:'App',bundleId:'com.a.b'}}}).bundleId,'com.a.b');
 assert.throws(()=>parseAscQuery({app:'__proto__',days:7}));
 assert.equal(parseAscQuery({app:'sudoku',days:14}).days,14);
 const reviews=parseAscReviews({data:[{id:'r1',attributes:{rating:5,title:'Good',body:'ok',reviewerNickname:'A',createdDate:'2026-11-01'}}]});
 assert.equal(reviews[0].rating,5);
});
