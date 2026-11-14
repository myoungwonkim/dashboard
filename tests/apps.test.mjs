import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAppInput,appBadges,SLUG_RE} from '../lib/apps.ts';

test('slug and field validation for app registry',()=>{
 assert.equal(SLUG_RE.test('bazi'),true);
 assert.throws(()=>validateAppInput({id:'Overview',name:'X'}));
 assert.throws(()=>validateAppInput({id:'login',name:'X'}));
 assert.throws(()=>validateAppInput({id:'ok',name:''}));
 assert.throws(()=>validateAppInput({id:'ok',name:'App',ga4PropertyId:'abc'}));
 assert.throws(()=>validateAppInput({id:'ok',name:'App',admobAndroidAppId:'bad'}));
 assert.throws(()=>validateAppInput({id:'ok',name:'App',appleAppId:'id123'}));
 assert.throws(()=>validateAppInput({id:'ok',name:'App',iosBundleId:'bad'}));
 const ok=validateAppInput({id:'new-game',name:'새 게임',ga4PropertyId:'123456789',androidPkg:'com.nolsoopgames.newgame',iosBundleId:'com.nolsoopgames.newgame',appleAppId:'1234567890',admobAndroidAppId:'ca-app-pub-4999376453226791~5692726639'});
 assert.equal(ok.id,'new-game');
 assert.equal(ok.ga4PropertyId,'123456789');
 assert.equal(ok.appleAppId,'1234567890');
 assert.equal(ok.iosBundleId,'com.nolsoopgames.newgame');
});

test('connection badges reflect partial links',()=>{
 const badges=appBadges({ga4PropertyId:'1',admobAndroidAppId:null,admobIosAppId:null,androidPkg:'com.a.b',appleAppId:null,afAndroidId:null,afIosId:null});
 assert.deepEqual(badges,{ga4:true,admob:false,play:true,asc:false,appsflyer:false});
});
