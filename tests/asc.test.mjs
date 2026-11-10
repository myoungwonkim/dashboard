import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAscAccount,parseAscUnitsReport,parseAscApp,parseAscQuery} from '../lib/asc-core.mts';

test('ASC account requires issuer, key id and p8',()=>{
 assert.throws(()=>validateAscAccount({issuerId:'bad',keyId:'ABCDEFGHIJ',privateKey:'-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----'}));
 const ok=validateAscAccount({issuerId:'12345678-1234-1234-1234-1234567890ab',keyId:'ABCDEFGHIJ',privateKey:'-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----'});
 assert.equal(ok.keyId,'ABCDEFGHIJ');
});

test('ASC units report aggregates by day',()=>{
 const text=`Begin Date\tUnits
2026-11-01\t3
2026-11-01\t2
2026-11-02\t4`;
 const data=parseAscUnitsReport(text);
 assert.equal(data.downloads,9);
 assert.equal(data.daily[0].downloads,5);
});

test('ASC app payload and query validation',()=>{
 assert.throws(()=>parseAscApp({}));
 assert.equal(parseAscApp({data:{id:'1234567890',attributes:{name:'App',bundleId:'com.a.b'}}}).bundleId,'com.a.b');
 assert.throws(()=>parseAscQuery({app:'__proto__',days:7}));
 assert.equal(parseAscQuery({app:'sudoku',days:14}).days,14);
});
