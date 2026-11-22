import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadArt} from '../dist/asset-url.js';
import {drawableArt,preloadSceneArt,retrySceneArt,sceneArtReady} from '../dist/scene-art.js';
import {previewSizes} from '../dist/preview-sizes.js';
import {heroDrawRect} from '../dist/hero-art.js';

function images(t) {
  const compact=[];
  const previous=Object.getOwnPropertyDescriptor(globalThis,'Image');
  globalThis.Image=class {constructor(){compact.push(this)}};
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'Image',previous);else delete globalThis.Image});
  const full=loadArt({},'naiwa-pixel-v2.png');
  return {full,compact};
}

test('a compact atlas unlocks play while the full atlas is still pending, then upgrades in place', async t=>{
  const {full,compact}=images(t);
  const ready=preloadSceneArt(full);
  assert.equal(preloadSceneArt(full),ready);
  assert.equal(compact.length,1);
  assert.equal(drawableArt(full),null);
  await compact[0].onload();
  assert.equal(await ready,true);
  assert.equal(drawableArt(full),compact[0]);
  full.onload();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(drawableArt(full),full);
  assert.equal(sceneArtReady(full),true);
});

test('one failing quality never hides the other, and a failed pair can retry the same atlas', async t=>{
  const {full,compact}=images(t);
  const failed=preloadSceneArt(full);
  full.onerror();full.onerror();compact[0].onerror();
  assert.equal(await failed,false);
  const retried=retrySceneArt(full);
  assert.match(full.src,/retry=1/);
  assert.match(compact[1].src,/retry=1/);
  compact[1].onerror();full.onload();
  assert.equal(await retried,true);
  assert.equal(drawableArt(full),full);
  const other=loadArt({},'rooms-bright-v1.png');
  const ready=preloadSceneArt(other);
  other.onerror();other.onerror();
  await compact[2].onload();
  assert.equal(await ready,true);
  assert.equal(drawableArt(other),compact[2]);
});

test('all compact files exist, come from the matching original dimensions, and hero anchors agree',()=>{
  const dist=new URL('../dist/',import.meta.url);
  const dimensions=buffer=>[buffer.readUInt32BE(16),buffer.readUInt32BE(20)];
  assert.deepEqual(fs.readdirSync(new URL('preview/',dist)).sort(), Object.keys(previewSizes).sort());
  for(const [file,[width,height]] of Object.entries(previewSizes)){
    const original=fs.readFileSync(new URL('assets/'+file,dist));
    const preview=fs.readFileSync(new URL('preview/'+file,dist));
    assert.deepEqual(dimensions(original),[width,height],file);
    const [w,h]=dimensions(preview);
    assert.ok(w>0 && w<width && h>0 && h<height,file);
    if(!file.startsWith('costume-') && file!=='naiwa-pixel-v2.png')continue;
    for(let frame=0; frame<16; frame++){
      const a=heroDrawRect({naturalWidth:width,naturalHeight:height},frame,file);
      const b=heroDrawRect({naturalWidth:w,naturalHeight:h,atlasWidth:width,atlasHeight:height},frame,file);
      for(const key of ['dx','dy','dw','dh'])assert.equal(a[key],b[key],file);
      for(const key of ['left','w'])assert.ok(Math.abs(a[key]*w/width-b[key])<1e-7,file);
      for(const key of ['top','h'])assert.ok(Math.abs(a[key]*h/height-b[key])<1e-7,file);
    }
  }
});
