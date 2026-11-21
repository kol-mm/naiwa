// Standard-mapping gamepads feed the same input shape the keyboard produces.
// Left stick moves, right stick aims and fires, face buttons match the keyboard
// actions in the in-game guide (A 蛙跳, B 炸弹, X 互动, Y 大爆笑, Start 暂停).
export const PAD_DEADZONE=.3;
const clampAxis=value=>Math.max(-1,Math.min(1,Number.isFinite(value)?value:0));
export function readGamepad(pad){
 if(!pad?.connected)return null;
 const axes=pad.axes||[],buttons=pad.buttons||[];
 const dead=value=>Math.abs(value)>=PAD_DEADZONE?value:0;
 const mx=dead(clampAxis(axes[0])),my=dead(clampAxis(axes[1]));
 let ax=dead(clampAxis(axes[2])),ay=dead(clampAxis(axes[3]));
 // D-pad wins over the right stick so a worn stick cannot smear the aim direction.
 for(const [index,x,y] of [[12,0,-1],[13,0,1],[14,-1,0],[15,1,0]])if(buttons[index]?.pressed){ax=x;ay=y}
 const pressed=index=>!!buttons[index]?.pressed;
 return {mx,my,ax,ay,fire:!!(ax||ay),dash:pressed(0)||pressed(5),bomb:pressed(1)||pressed(4),use:pressed(2),active:pressed(3),pause:pressed(9)};
}
export function pickGamepad(pads){
 if(!pads?.length)return null;
 for(const pad of pads)if(pad?.connected)return pad;
 return null;
}


// Permissions-Policy can leave navigator.getGamepads in place while making it throw.
// A restricted page must degrade to keyboard/touch, not stop the frame loop.
export function readConnectedGamepad(navigator){
 if(!navigator?.getGamepads)return null;
 try{return readGamepad(pickGamepad(navigator.getGamepads()))}catch{return null}
}

// Start toggles pause exactly once per press. The caller latches the previous state.
export function gamepadPauseAction(pressed,latched,mode){
 if(!pressed||latched)return null;
 if(mode==='play')return 'pause';
 if(mode==='paused')return 'resume';
 return null;
}
