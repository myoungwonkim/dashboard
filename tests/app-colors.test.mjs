import test from 'node:test';
import assert from 'node:assert/strict';
import {appColor} from '../lib/app-colors.ts';

test('known apps keep fixed distinct colors',()=>{
 assert.equal(appColor('bazi'),'#2F6B4F');
 assert.equal(appColor('sudoku'),'#3B5BDB');
 assert.notEqual(appColor('bazi'),appColor('sudoku'));
});

test('unknown apps get stable fallback colors',()=>{
 assert.equal(appColor('new-game'),appColor('new-game'));
 assert.match(appColor('new-game'),/^#[0-9A-Fa-f]{6}$/);
});
