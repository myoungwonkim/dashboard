import test from 'node:test';
import assert from 'node:assert/strict';
import {sortBy} from '../lib/table-sort.mts';

test('sortBy orders numbers ascending and descending with nulls last',()=>{
 const rows=[{n:3},{n:null},{n:1},{n:2}];
 const getters={n:r=>r.n};
 assert.deepEqual(sortBy(rows,{key:'n',dir:'asc'},getters).map(r=>r.n),[1,2,3,null]);
 assert.deepEqual(sortBy(rows,{key:'n',dir:'desc'},getters).map(r=>r.n),[3,2,1,null]);
});

test('sortBy orders Korean strings and leaves unsorted when sort is null',()=>{
 const rows=[{s:'가나'},{s:'다라'},{s:'나다'}];
 const getters={s:r=>r.s};
 assert.deepEqual(sortBy(rows,{key:'s',dir:'asc'},getters).map(r=>r.s),['가나','나다','다라']);
 assert.equal(sortBy(rows,null,getters),rows);
});
