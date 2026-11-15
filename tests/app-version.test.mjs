import test from 'node:test';
import assert from 'node:assert/strict';
import {compareAppVersions,recentAppVersions} from '../lib/app-version.mts';

test('compareAppVersions orders semver-ish strings',()=>{
 assert.ok(compareAppVersions('1.2.0','1.10.0')<0);
 assert.ok(compareAppVersions('2.0','1.9.9')>0);
 assert.equal(compareAppVersions('1.0.0','1.0.0'),0);
});

test('recentAppVersions returns newest five',()=>{
 const rows=[{v:'1.0.0'},{v:'1.2.0'},{v:'1.10.0'},{v:'2.0'},{v:'1.9'},{v:'0.9'}];
 assert.deepEqual(recentAppVersions(rows,r=>r.v,5).map(r=>r.v),['2.0','1.10.0','1.9','1.2.0','1.0.0']);
});
