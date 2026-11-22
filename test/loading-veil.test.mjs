import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingVeil} from '../dist/loading-veil.js';

function fakeNode() {
  const classes = new Set(['loading-veil', 'is-visible']);
  const children = new Map();
  return {
    hidden: false,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
    },
    setAttribute() {},
    removeAttribute() {},
    querySelector(name) {
      if (!children.has(name)) children.set(name, {textContent: '', hidden: true});
      return children.get(name);
    },
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

test('a slow room stays covered and an earlier room cannot draw over it',async t=>{
 globalThis.document={documentElement:{setAttribute(){},removeAttribute(){}}};
 t.mock.timers.enable({apis:['setTimeout']});
 const node=fakeNode(),veil=createLoadingVeil(node,{minShow:0,fade:20,maxWait:90});
 const controls=node.querySelector('[data-loading-recovery]');
 let firstReady,nextReady,paints=0;
 veil.hide('first',new Promise(resolve=>{firstReady=resolve}),{beforeReveal:()=>assert.fail('stale paint')});
 veil.show('next');
 veil.hide('next ready',new Promise(resolve=>{nextReady=resolve}),{
  retry(){},beforeReveal(){
   assert.equal(node.hidden,false);
   assert.ok(!node.classList.contains('is-hiding'),'first complete frame precedes the fade');
   paints++;
  }
 });
 firstReady();
 await Promise.resolve();t.mock.timers.tick(100);
 assert.equal(veil.isBlocking(),true);
 assert.equal(controls.hidden,false);
 assert.equal(paints,0);
 nextReady(true);await Promise.resolve();
 assert.equal(paints,1);
 assert.equal(controls.hidden,true);
 assert.ok(node.classList.contains('is-hiding'));
 assert.equal(veil.isBlocking(),true);
 t.mock.timers.tick(20);
 assert.equal(veil.isBlocking(),false);
});

test('failure offers retry without uncovering the room, and back cancels a pending retry',async t=>{
 globalThis.document={documentElement:{setAttribute(){},removeAttribute(){}}};
 t.mock.timers.enable({apis:['setTimeout']});
 const node=fakeNode(),veil=createLoadingVeil(node,{minShow:0,maxWait:50});
 const controls=node.querySelector('[data-loading-recovery]');
 let finishRetry;
 const retry=()=>{veil.show('retry');veil.hide('ready',new Promise(resolve=>{finishRetry=resolve}),{back,beforeReveal:()=>assert.fail('abandoned room painted')})};
 const back=()=>veil.hide('title',null,{immediate:true});
 veil.hide('room',Promise.resolve(false),{retry,back});
 await Promise.resolve();
 assert.equal(controls.hidden,false);
 assert.equal(node.classList.contains('is-hiding'),false);
 node.querySelector('[data-loading-retry]').onclick();
 assert.equal(controls.hidden,true);
 t.mock.timers.tick(50);
 node.querySelector('[data-loading-back]').onclick();
 finishRetry(true);await Promise.resolve();t.mock.timers.tick(1000);
 assert.equal(node.hidden,true);
 assert.equal(veil.isBlocking(),false);
});
