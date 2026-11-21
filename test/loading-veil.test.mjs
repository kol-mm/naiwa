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
