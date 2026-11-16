import test from 'node:test';
import assert from 'node:assert/strict';
import {extractOgImage,fetchItunesIconUrl,fetchPlayStoreIconUrl,normalizeStoreIconUrl} from '../lib/store-icons.mts';

test('extractOgImage reads Play listing markup',()=>{
 const html='<html><meta property="og:image" content="https://play-lh.googleusercontent.com/icon.png"><title>App</title></html>';
 assert.equal(extractOgImage(html),'https://play-lh.googleusercontent.com/icon.png');
});

test('normalizeStoreIconUrl picks square Play CDN size',()=>{
 assert.equal(
  normalizeStoreIconUrl('https://play-lh.googleusercontent.com/abc=s0-br30'),
  'https://play-lh.googleusercontent.com/abc=s128',
 );
});

test('Play icon fetch uses og:image from listing HTML',async()=>{
 const fetcher=async()=>new Response('<meta property="og:image" content="https://play-lh.googleusercontent.com/a.png">',{status:200});
 assert.equal(await fetchPlayStoreIconUrl('com.nolsoopgames.bazi',fetcher),'https://play-lh.googleusercontent.com/a.png');
 assert.equal(await fetchPlayStoreIconUrl('bad',fetcher),null);
});

test('iTunes icon fetch reads artworkUrl512',async()=>{
 const fetcher=async()=>new Response(JSON.stringify({results:[{artworkUrl512:'https://is1-ssl.mzstatic.com/a.jpg'}]}),{status:200});
 assert.equal(await fetchItunesIconUrl('1234567890',fetcher),'https://is1-ssl.mzstatic.com/a.jpg');
});
