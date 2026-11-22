import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WEBP} from '../dist/asset-webp.js';

const dist=new URL('../dist/',import.meta.url);
const read=f=>fs.readFileSync(new URL(f,dist),'utf8');

function pngSize(buf){assert.equal(buf.toString('latin1',12,16),'IHDR');return [buf.readUInt32BE(16),buf.readUInt32BE(20)]}
function webpSize(buf){
 assert.equal(buf.toString('latin1',0,4),'RIFF');assert.equal(buf.toString('latin1',8,12),'WEBP');
 const kind=buf.toString('latin1',12,16);
 if(kind==='VP8X')return [1+buf.readUIntLE(24,3),1+buf.readUIntLE(27,3)];
 if(kind==='VP8 ')return [buf.readUInt16LE(26)&0x3fff,buf.readUInt16LE(28)&0x3fff];
 if(kind==='VP8L'){const b=buf.readUInt32LE(21);return [(b&0x3fff)+1,((b>>14)&0x3fff)+1]}
 throw Error('unknown WebP chunk '+kind);
}
test('every listed PNG has a WebP twin of the same size, and every twin is listed',()=>{
 for(const name of WEBP){
  const png=fs.readFileSync(new URL('assets/'+name,dist)),webp=fs.readFileSync(new URL('assets/'+name.replace(/\.png$/,'.webp'),dist));
  assert.deepEqual(webpSize(webp),pngSize(png),name);
  assert.ok(webp.length<png.length,name+' twin is smaller');
 }
 const twins=fs.readdirSync(new URL('assets/',dist)).filter(f=>f.endsWith('.webp'));
 assert.deepEqual(twins.map(f=>f.replace(/\.webp$/,'.png')).sort(),[...WEBP].sort());
});
test('runtime code never builds an asset URL around the helper',()=>{
 const runtime=fs.readdirSync(dist).filter(f=>/\.(js|css|html)$/.test(f)&&!/^(asset-url|asset-webp|soundcheck|phoebe-demo)\./.test(f));
 for(const f of runtime){
  const s=read(f);
  for(const m of s.matchAll(/assets\/([a-z0-9-]+)\.png/g))assert.ok(m[1].startsWith('icon-'),`${f} names assets/${m[1]}.png directly`);
  assert.ok(!/\.src\s*=\s*new URL\(['"]\.\/assets\//.test(s),f+' sets an image src without loadArt');
  assert.ok(!/assets\/\$\{/.test(s),f+' interpolates an asset path without assetPath');
 }
});
test('art waits while the title holds it, then loads in request order; other pages load at once',async()=>{
 const attrs=new Set(['data-art-hold']);
 globalThis.document={documentElement:{hasAttribute:a=>attrs.has(a),removeAttribute:a=>attrs.delete(a)}};
 try{
  const m=await import('../dist/asset-url.js?held');
  const a={},b={};m.loadArt(a,'mobs-milk-v1.png');m.loadArt(b,'icon-192.png');
  assert.equal(a.src,undefined);assert.equal(a.assetName,'mobs-milk-v1.png');assert.equal(m.artHeld(),true);
  let ready=false;m.artReady().then(()=>ready=true);await Promise.resolve();assert.equal(ready,false);
  m.releaseArt();await Promise.resolve();
  assert.match(a.src,/assets\/mobs-milk-v1\.webp$/);assert.match(b.src,/assets\/icon-192\.png$/);
  assert.equal(ready,true);assert.equal(attrs.has('data-art-hold'),false);
  const c={};m.loadArt(c,'rooms-bright-v1.png');assert.match(c.src,/rooms-bright-v1\.webp$/,'after release, loads immediately');
  assert.equal(m.assetPath('cover-rescue-v2.png'),'assets/cover-rescue-v2.webp');assert.equal(m.assetPath('creator-douyin.jpg'),'assets/creator-douyin.jpg');
 }finally{delete globalThis.document}
 const open=await import('../dist/asset-url.js?open'),d={};open.loadArt(d,'mobs-milk-v1.png');
 assert.match(d.src,/mobs-milk-v1\.webp$/,'no document hold: immediate');
});

test('a failed WebP keeps the same atlas and waits for its PNG before declaring failure',async()=>{
 const {loadArt,artLoaded}=await import('../dist/asset-url.js');
 const image=loadArt({},'mobs-milk-v1.png');
 const result=artLoaded(image);
 assert.match(image.src,/mobs-milk-v1\.webp$/);
 image.onerror();
 assert.match(image.src,/mobs-milk-v1\.png$/);
 assert.equal(image.assetName,'mobs-milk-v1.png');
 image.onload();
 assert.equal(await result,true);
 const broken=loadArt({},'rooms-bright-v1.png');
 broken.onerror();broken.onerror();
 assert.equal(await artLoaded(broken),false);
 assert.equal(broken.onerror,null,'both formats exhausted without a request loop');
 const nativePng=loadArt({},'icon-192.png');
 nativePng.onerror();
 assert.equal(await artLoaded(nativePng),false);
});

test('first-room hints and runtime requests have identical URLs under a deployment prefix',async()=>{
 const {assetPath}=await import('../dist/asset-url.js');
 const html=read('index.html');
 const hints=[...html.matchAll(/<link rel="preload" as="image" href="([^"]+)"/g)].map(match=>match[1]);
 const names=['cover-rescue-v2.png','rooms-bright-v1.png','naiwa-pixel-v2.png'];
 assert.deepEqual(hints.sort(),names.map(assetPath).sort());
 const entry=html.match(/<script type="module" src="([^"]+)"/)[1];
 assert.ok(html.includes('<link rel="modulepreload" href="'+entry+'"'));
});

test('promoting an atlas shares its pending request and decode across title, renderer and PNG fallback',async()=>{
 globalThis.document={documentElement:{hasAttribute:()=>true,removeAttribute(){}}};
 try{
  const {loadArt,artDecoded,preloadArt,releaseArt}=await import('../dist/asset-url.js?promote');
  let finishDecode,decodes=0;const requests=[];
  const room=loadArt({set src(url){requests.push(url)},decode(){decodes++;return new Promise(resolve=>{finishDecode=resolve})}},'rooms-bright-v1.png');
  const optional=loadArt({},'mobs-milk-v1.png');
  const result=preloadArt(room);
  assert.equal(preloadArt(room),result);
  assert.equal(requests.length,1);
  assert.equal(optional.src,undefined);
  room.onerror();
  assert.match(requests[1],/rooms-bright-v1\.png$/);
  releaseArt();
  assert.equal(requests.length,2,'releasing the title must not restart the promoted request');
  assert.match(optional.src,/mobs-milk-v1\.webp$/);
  room.onload();await Promise.resolve();
  assert.equal(decodes,1);assert.equal(artDecoded(room),false);
  finishDecode();assert.equal(await result,true);assert.equal(artDecoded(room),true);
  assert.equal(preloadArt(room),result);
 }finally{delete globalThis.document}
});

test('old WebViews and already drawable images can proceed if explicit decoding is unavailable',async()=>{
 const {loadArt,artDecoded,preloadArt}=await import('../dist/asset-url.js?old-webview');
 for(const surface of [{},{naturalWidth:64,decode:async()=>{throw Error('decoder released')}}]){
  const im=loadArt(surface,'icon-192.png'),result=preloadArt(im);
  im.onload();assert.equal(await result,true);assert.ok(artDecoded(im));
 }
 const broken=loadArt({},'rooms-bright-v1.png'),failed=preloadArt(broken);
 broken.onerror();broken.onerror();assert.equal(await failed,false);assert.equal(artDecoded(broken),false);
});

test('retry keeps the same atlas, disregards a superseded decode and bypasses a cached failure',async()=>{
 const {loadArt,artDecoded,preloadArt,retryArt}=await import('../dist/asset-url.js?retry');
 let decoded;
 const image=loadArt({decode:()=>new Promise(resolve=>{decoded=resolve})},'rooms-bright-v1.png');
 const first=preloadArt(image);
 image.onload();await Promise.resolve();
 const second=retryArt(image);
 decoded();assert.equal(await first,false);assert.equal(artDecoded(image),false);
 assert.match(image.src,/\.webp\?retry=1$/);
 image.onerror();assert.match(image.src,/\.png\?retry=1$/);
 image.onerror();assert.equal(await second,false);
 const third=retryArt(image);
 assert.match(image.src,/\.webp\?retry=2$/);
 image.onload();await Promise.resolve();decoded();
 assert.equal(await third,true);assert.equal(artDecoded(image),true);
 assert.equal(retryArt(image),third,'ready sheets are not restarted');
});

test('the first frame collects cached costume and sprite requests even if their drawing takes a fallback path',async()=>{
 globalThis.Image=class {};
 try{
  const {collectFrameArt}=await import('../dist/asset-url.js');
  const {spriteImage,drawSprite}=await import('../dist/sprite-art.js');
  const {costumeImage}=await import('../dist/costumes.js');
  const companion=spriteImage('followers-family-v2.png'),hero=costumeImage('original');
  const used=collectFrameArt(()=>{
   costumeImage('original');
   assert.equal(drawSprite({},'followers-family-v2.png',0,0,4,5,0,0,48),false);
  });
  assert.deepEqual([...used],[hero,companion]);
  assert.deepEqual([...collectFrameArt(()=>{})],[]);
 }finally{delete globalThis.Image}
});
