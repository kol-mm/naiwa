import test from 'node:test';
import assert from 'node:assert/strict';
import {bindStickControl,bindAttackStick} from '../dist/mobile-ui.js';
import {applyRotation} from '../dist/rotate-view.js';

test('a press uses the fixed ring centre and releasing or cancelling recentres the knob',()=>{
 const props={},view=new EventTarget(),doc=new EventTarget();doc.defaultView=view;
 const ring={getBoundingClientRect:()=>({left:14,top:270,width:100,height:100})};
 const el=new EventTarget();Object.assign(el,{ownerDocument:doc,isConnected:true,querySelector:s=>s==='em'?ring:null,style:{setProperty:(k,v)=>props[k]=v,removeProperty:k=>delete props[k]},getBoundingClientRect:()=>({left:0,top:100,width:300,height:290}),setPointerCapture(){},hasPointerCapture:()=>false,releasePointerCapture(){},classList:{add(){},remove(){}}});
 const moves=[];bindStickControl(el,(v,held)=>moves.push({...v,held}));
 const ev=(type,x,y)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:3,button:0,pointerType:'touch',clientX:x,clientY:y});el.dispatchEvent(e)};
 ev('pointerdown',99,320);
 assert.ok(moves.at(-1).x>.95);assert.equal(moves.at(-1).y,0);
 ev('pointermove',64,320);
 assert.deepEqual(moves.at(-1),{x:0,y:0,held:true});
 ev('pointermove',64,220);
 assert.deepEqual(moves.at(-1),{x:0,y:-1,held:true});
 assert.deepEqual(props,{});
 ev('pointercancel',64,220);
 assert.deepEqual(moves.at(-1),{x:0,y:0,held:false});
 ev('pointerdown',64,320);ev('pointerup',64,320);
 assert.deepEqual(moves.at(-1),{x:0,y:0,held:false});
});

test('changing the height of a sideways browser keeps both physical fingers neutral or on their chosen arm',()=>{
 const view=new EventTarget(),doc=new EventTarget();
 doc.defaultView=view;doc.documentElement={dataset:{}};doc.styleSheets=[];
 const rotate=(dir,height)=>applyRotation({doc,view,dir,width:390,height});
 const button=(left,top)=>{const el=new EventTarget();el.ownerDocument=doc;
  el.getBoundingClientRect=()=>({left,top,width:100,height:100});return el};
 const move=button(170,550),fire=button(160,60),moves=[],shots=[];
 const send=(el,type,x,y,id)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerType:'touch',pointerId:id,button:0});el.dispatchEvent(e)};
 try{
  rotate('ccw',844);
  bindStickControl(move,v=>moves.push(v));bindAttackStick(fire,v=>shots.push(v));
  send(move,'pointerdown',220,600,1);send(fire,'pointerdown',185,110,2);
  assert.equal(shots.at(-1).y,-1);
  rotate('ccw',780);
  send(move,'pointermove',221,601,1);send(fire,'pointermove',186,111,2);
  assert.deepEqual(moves.at(-1),{x:0,y:0});assert.equal(shots.at(-1).x,0);assert.equal(shots.at(-1).y,-1);
  send(move,'pointerup',221,601,1);send(fire,'pointerup',186,111,2);
 }finally{rotate(null,844)}
});
