import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingVeil} from '../dist/loading-veil.js';

function fakeNode() {
  const classes = new Set(['loading-veil', 'is-visible']);
  return {
    hidden: false,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
    },
    setAttribute() {},
    removeAttribute() {},
    querySelector: () => ({textContent: ''}),
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('loading veil keeps the game frozen through its fade, then releases on the next frame', async () => {
  globalThis.document = {documentElement: {setAttribute() {}, removeAttribute() {}}};
  const node = fakeNode();
  const veil = createLoadingVeil(node, {minShow: 10, fade: 15});
  assert.equal(veil.isBlocking(), true);
  veil.hide('ready');
  await sleep(12);
  assert.equal(veil.isBlocking(), true, 'opacity fade still blocks input');
  await sleep(30);
  assert.equal(veil.isBlocking(), false);
  assert.equal(node.hidden, true);

  veil.show('resume');
  assert.equal(veil.isBlocking(), true);
  assert.equal(node.hidden, false);
  veil.hide();
  await sleep(45);
  assert.equal(veil.isBlocking(), false);
});

test('a missing veil node never freezes the frame loop',()=>{
 const veil=createLoadingVeil(null);
 assert.equal(veil.isBlocking(),false);
 veil.show();assert.equal(veil.isBlocking(),false);
});

test('static cover and decoded rooms skip the overlay, while a cold room waits for its images',async()=>{
 globalThis.document={documentElement:{setAttribute(){},removeAttribute(){}}};
 const node=fakeNode();node.hidden=true;
 const veil=createLoadingVeil(node,{minShow:60000,fade:1});
 veil.bootDone();
 assert.equal(veil.isBlocking(),false);
 veil.show('cached');veil.hide('ready',Promise.resolve(),{immediate:true});
 assert.equal(node.hidden,true);
 assert.equal(veil.isBlocking(),false);
 let resolveImage;veil.show('cold',{min:0});
 veil.hide('ready',new Promise(resolve=>{resolveImage=resolve}));
 assert.equal(veil.isBlocking(),true);
 resolveImage();await sleep(30);
 assert.equal(veil.isBlocking(),false);
});

test('a stale atlas cannot uncover another chapter, and a stalled request has a deadline',async()=>{
 globalThis.document={documentElement:{setAttribute(){},removeAttribute(){}}};
 const veil=createLoadingVeil(fakeNode(),{minShow:1,fade:1,maxWait:90});
 let firstReady,nextReady;
 veil.hide('first',new Promise(resolve=>{firstReady=resolve}));
 veil.show('next');
 veil.hide('next ready',new Promise(resolve=>{nextReady=resolve}));
 firstReady();
 await sleep(15);
 assert.equal(veil.isBlocking(),true);
 nextReady();
 await sleep(20);
 assert.equal(veil.isBlocking(),false);
 veil.show('slow');
 veil.hide('slow ready',new Promise(()=>{}));
 await sleep(130);
 assert.equal(veil.isBlocking(),false);
});
