import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneTransition} from '../dist/loading-veil.js';

function fixture() {
  const controls = new Map();
  const notice = {hidden:true, querySelector(key) {
    if (!controls.has(key)) controls.set(key, {});
    return controls.get(key);
  }};
  const hold = {hidden:true, append(node){this.firstChild=node},replaceChildren(){this.firstChild=null}};
  const overlay = {querySelector(){return 'original cover'}};
  const attributes = new Map();
  const canvas = {setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
  const transition = createSceneTransition({notice,hold,overlay,canvas,slowAfter:100});
  return {transition,notice,hold,attributes,button:name=>notice.querySelector('[data-loading-'+name+']')};
}

test('a ready room is painted before the actual cover is removed and accepts input immediately', () => {
  const {transition,notice,hold,attributes}=fixture();
  transition.begin();
  let painted=false;
  transition.present(null,{paint(){
    assert.equal(hold.firstChild,'original cover');
    assert.equal(attributes.get('aria-busy'),'true');
    painted=true;
  }});
  assert.ok(painted);
  assert.equal(hold.hidden,true);
  assert.equal(notice.hidden,true);
  assert.equal(attributes.has('aria-busy'),false);
  assert.equal(transition.isBlocking(),false);
});

test('ordinary waits keep the cover, and only an unusually long wait offers recovery', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const {transition,notice,hold}=fixture();
  let finish,painted=0;
  transition.begin();
  transition.present(new Promise(resolve=>{finish=resolve}),{paint(){painted++}});
  t.mock.timers.tick(99);
  assert.ok(notice.hidden);
  assert.equal(hold.firstChild,'original cover');
  t.mock.timers.tick(1);
  assert.equal(notice.hidden,false);
  assert.equal(painted,0);
  finish(true);await Promise.resolve();
  assert.equal(painted,1);
  assert.ok(notice.hidden && hold.hidden);
});

test('retry paints the original room once, while cancelled or superseded requests cannot take over', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const {transition,notice,button}=fixture();
  let finish,painted=0;
  const retry=()=>{transition.begin();transition.present(new Promise(resolve=>{finish=resolve}),{paint(){painted++}})};
  transition.begin();
  transition.present(Promise.resolve(false),{retry,back:transition.cancel,paint(){assert.fail('failed room')}});
  await Promise.resolve();
  assert.equal(notice.hidden,false);
  button('retry').onclick();
  assert.equal(notice.hidden,true);
  const superseded=finish;
  retry();superseded(true);await Promise.resolve();
  assert.equal(transition.isBlocking(),true);
  finish(true);await Promise.resolve();
  assert.equal(painted,1);
  retry();transition.cancel();finish(true);await Promise.resolve();
  assert.equal(painted,1);
});
