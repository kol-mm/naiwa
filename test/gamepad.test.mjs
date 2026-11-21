import test from 'node:test';
import assert from 'node:assert/strict';
import {PAD_DEADZONE,pickGamepad,readGamepad,readConnectedGamepad,gamepadPauseAction} from '../dist/gamepad.js';

const pad=(axes,down=[])=>({
 connected:true,
 axes,
 buttons:Array.from({length:16},(_,i)=>({pressed:down.includes(i)}))
});

test('left and right sticks move and aim once they pass the deadzone',()=>{
 const idle=readGamepad(pad([0,0,0,0]));
 assert.deepEqual(idle,{mx:0,my:0,ax:0,ay:0,fire:false,dash:false,bomb:false,use:false,active:false,pause:false});
 const move=readGamepad(pad([1,0,0,0]));
 assert.equal(move.mx,1);assert.equal(move.my,0);assert.equal(move.fire,false,'move stick never fires');
 const aim=readGamepad(pad([0,0,0,-1]));
 assert.equal(aim.ay,-1);assert.equal(aim.ax,0);assert.equal(aim.fire,true);
 assert.equal(readGamepad(pad([PAD_DEADZONE-.01,0,0,0])).mx,0,'inside the deadzone is a rest');
});

test('face buttons mirror the keyboard actions and the D-pad overrides a drifting stick',()=>{
 const all=readGamepad(pad([0,0,0,0],[0,1,2,3,9]));
 assert.deepEqual([all.dash,all.bomb,all.use,all.active,all.pause],[true,true,true,true,true]);
 const dpad=readGamepad(pad([0,0,.6,.6],[13]));
 assert.deepEqual([dpad.ax,dpad.ay,dpad.fire],[0,1,true],'D-pad down beats the right stick');
 assert.deepEqual([readGamepad(pad([0,0,0,0],[12])).ay,readGamepad(pad([0,0,0,0],[15])).ax],[-1,1],'12 is up and 15 is right');
 assert.equal(readGamepad({connected:false,axes:[]}),null);
 assert.equal(pickGamepad([{connected:false},{connected:true,axes:[]}]).connected,true);
 assert.equal(pickGamepad([]),null);
 assert.equal(pickGamepad(undefined),null);
});


test('restricted Gamepad API and Start toggling degrade without stopping the frame loop',()=>{
 const denied={getGamepads(){throw new Error('SecurityError')}};
 assert.equal(readConnectedGamepad(denied),null);
 assert.equal(readConnectedGamepad({}),null);
 const fake=readConnectedGamepad({getGamepads:()=>[pad([0,0,0,0],[9])]});
 assert.equal(fake.pause,true,'the permission wrapper still returns parsed input, not the raw Gamepad');
 // A latched press only toggles once; releasing resets the latch.
 assert.equal(gamepadPauseAction(true,false,'play'),'pause');
 assert.equal(gamepadPauseAction(true,true,'paused'),null);
 assert.equal(gamepadPauseAction(true,false,'paused'),'resume');
 assert.equal(gamepadPauseAction(true,false,'title'),null);
});
