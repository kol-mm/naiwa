import {atlasRegion} from './atlas-regions.js';
import {frameArt,loadArt} from './asset-url.js';
import {drawableArt} from './scene-art.js';
export const MOB_SHEETS=[
 ['mobs-milk-v1.png',['brute','hopper','shooter','runner','milkleak','milkspitter','curdling','milkSkater']],
 ['mobs-stage-v1.png',['soundTurret','beatling','echoBell','conductor','loader','parcelThrower','forklift','turret']],
 ['mobs-factory-v1.png',['dollTurret','stitchling','tiny','stitchMedic','scrapMine','warden','jailer','lockSentry','prismEye']]
];
const images=new Map();
export const cachedSpriteImage=file=>images.get(file);
const bounds=new Map();
export function spriteRegion(image,cols,rows,row,col){
 const width=image.atlasWidth??image.naturalWidth,height=image.atlasHeight??image.naturalHeight;
 const rect=atlasRegion(image.assetName||image.src.split('/').at(-1),cols,rows,row,col,width,height);
 if(!image.atlasWidth)return rect;
 const sx=image.naturalWidth/width,sy=image.naturalHeight/height;
 const left=Math.round(rect.left*sx),top=Math.round(rect.top*sy);
 return {left,top,w:Math.round((rect.left+rect.w)*sx)-left,h:Math.round((rect.top+rect.h)*sy)-top};
}
// Crop transparent gutters without stretching, with one stable scale for the animation row.
function rowBounds(image,cols,rows,row){
 const key=image.src+':'+cols+':'+rows+':'+row;if(bounds.has(key))return bounds.get(key);
 const canvas=document.createElement('canvas'),c=canvas.getContext('2d',{willReadFrequently:true}),frames=[];
 for(let col=0;col<cols;col++){
  const region=spriteRegion(image,cols,rows,row,col),w=Math.floor(region.w),h=Math.floor(region.h);canvas.width=w;canvas.height=h;c.drawImage(image,region.left,region.top,w,h,0,0,w,h);
  const data=c.getImageData(0,0,w,h).data;let left=w,top=h,right=0,bottom=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>96){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  frames.push(right>=left?{x:left,y:top,w:right-left+1,h:bottom-top+1}:{x:0,y:0,w,h});
 }
 const result={frames,extent:Math.max(...frames.flatMap(b=>[b.w,b.h]))};bounds.set(key,result);return result;
}
export function spriteImage(file){
 if(typeof Image==='undefined')return null;
 if(!images.has(file))images.set(file,loadArt(new Image(),file));
 return frameArt(images.get(file));
}
export function drawSprite(c,file,col,row,cols,rows,x,y,size,{flip=false,alpha=1,angle=0,squash=1}={}){
 const image=drawableArt(spriteImage(file));if(!image)return false;
 const region=spriteRegion(image,cols,rows,row,col),set=rowBounds(image,cols,rows,row),b=set.frames[col],scale=size/set.extent,dw=b.w*scale,dh=b.h*scale;
 c.save();c.imageSmoothingEnabled=false;c.translate(Math.round(x),Math.round(y));c.rotate(angle);c.scale(flip?-1:1,squash);c.globalAlpha*=alpha;
 c.drawImage(image,region.left+b.x,region.top+b.y,b.w,b.h,-dw/2,size*.23-dh,dw,dh);c.restore();return true;
}
export function actorPose(e,t){
 if(e.dead)return 'dead';if(e.hit>0)return 'hurt';
 const skill=e.finalSkill||e.sound||e.hands||e.puppetSkill||e.gunCast||e.mobCast||e.beat||e.screech;
 if(skill){const age=skill.age??skill.t??0,wind=skill.wind??(skill.mode==='charge'?(skill.combo?1.05:.8):skill.mode==='stitch'?.95:.7);return age<wind?'windup':'attack'}
 if(e.longCharge)return 'attack';if(e.wind>0)return 'windup';
 if((e.artAttackUntil||0)>t)return 'attack';
 return e.artMoving?'walk':'idle';
}
export function actorFrame(e,t){
 const pose=actorPose(e,t),final=e.kind==='bull'||e.kind==='meishu';
 if(final)return pose==='dead'?7:pose==='hurt'?6:pose==='windup'?3:pose==='attack'?(e.finalSkill?.mode==='stomp'||e.finalSkill?.mode==='cross'?5:4):pose==='walk'?1+Math.floor(t*9)%2:0;
 return pose==='dead'||pose==='hurt'?3:pose==='attack'?2:(e.type==='boss'||e.gunCast)&&pose==='windup'?1:pose==='walk'?Math.floor(t*9)%2:0;
}
export function enemyArtSize(e){return e.type==='boss'?156:e.type==='tiny'?42:e.type==='forklift'?78:68}
export function enemyIndicatorY(e){return Math.round(e.y-enemyArtSize(e)*.77-11)}
const gunners=['gunners-actions-v1.png',['loader','shooter']];
const chapterBosses=['chapter-bosses-v1.png',['collector','speaker','catcher','puppet']];
const bull=['bull-actions-v2.png',[]],meishu=['meishu-actions-v1.png',[]];
function enemySheet(e){
 if(e.type==='boss')return e.kind==='bull'?bull:e.kind==='meishu'?meishu:chapterBosses;
 if(e.type==='loader'||e.type==='shooter'&&e.artChapter===4)return gunners;
 return MOB_SHEETS.find(([,ids])=>ids.includes(e.type));
}
export function drawAnimatedEnemy(c,e,t){
 const boss=e.type==='boss',final=e.kind==='bull'||e.kind==='meishu';
 const sheet=enemySheet(e),gunner=sheet===gunners,row=sheet?.[1].indexOf(boss?e.kind:e.type);
 if(!sheet||!final&&row<0)return false;
 const frame=actorFrame(e,t),pose=actorPose(e,t),deadAge=t-(e.deadAt??t);
 if(e.dead&&!final&&deadAge>.65)return true;
 const size=enemyArtSize(e);
 c.save();c.fillStyle='#3a32452a';c.fillRect(Math.round(e.x-size*.28),Math.round(e.y+size*.16),Math.round(size*.56),boss?10:5);c.restore();
 const lift=e.airborne?Math.sin(Math.min(1,(e.sound?.t||0)/.8)*Math.PI)*130:pose==='walk'?Math.round(Math.sin(t*16))*2:0;
 return drawSprite(c,sheet[0],frame%4,final?Math.floor(frame/4):row,4,final?2:sheet[1].length,e.x,e.y-lift,size,{flip:gunner?(e.gunCast||(e.artAttackUntil||0)>t?e.gunFacing:e.artFacing)===-1:e.artFacing===1,alpha:e.dead?(final?.6:Math.max(0,1-deadAge/.65)):1,angle:e.dead&&!final?deadAge*1.6:0,squash:pose==='windup'?.94:1});
}
export function drawFamily(c,who,frame,x,y,size){return drawSprite(c,'family-rescue-v2.png',frame,who==='child'?0:1,4,2,x,y,size)}
export function drawBrightRoom(c,room,floor){
 const image=drawableArt(spriteImage('rooms-bright-v1.png'));if(!image)return false;
 const cell=room.type==='start'?5:floor-1,w=image.naturalWidth/3,h=image.naturalHeight/2,ox=cell%3*w,oy=Math.floor(cell/3)*h;
 // Nine-slice keeps decoration on the outer walls instead of covering navigable ground.
 const sx=[0,w*.085,w*.915,w],sy=[0,h*.25,h*.94,h],dx=[0,47,913,960],dy=[0,47,553,600];
 c.save();c.imageSmoothingEnabled=false;
 for(let x=0;x<3;x++)for(let y=0;y<3;y++)c.drawImage(image,ox+sx[x],oy+sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);
 c.restore();return true;
}
// Use the same atlas selection as the renderer for the room about to be shown.
export function prepareRoomArt(room,mode){
 const names=new Set(['rooms-bright-v1.png']);
 for(const enemy of room?.enemies??[]){
  const sheet=enemySheet(enemy);
  if(sheet&&!enemy.dead)names.add(sheet[0]);
 }
 if(mode==='rescue')names.add('family-rescue-v2.png');
 return Array.from(names,spriteImage);
}
// The rest of the chapter can download while the player explores.
export function prepareChapterArt(floor){
 const names=['rooms-bright-v1.png','mobs-milk-v1.png'];
 if(floor===3||floor===4)names.push('gunners-actions-v1.png');
 if(floor===2||floor===3)names.push('mobs-stage-v1.png');
 if(floor>=4)names.push('mobs-factory-v1.png');
 if(floor===5)names.push('family-rescue-v2.png');
 return names.map(spriteImage);
}
// Boss sheets are the heaviest single files, so they wait until the boss room is close.
// Floors 1-4 share one four-row sheet; the final floor uses the two-family sheets.
export function prepareBossArt(floor){
 const names=floor<=4?['chapter-bosses-v1.png']:['bull-actions-v2.png','meishu-actions-v1.png'];
 return names.map(spriteImage);
}
// Two rooms of walking plus the door transition is enough headroom for the sheet on a slow phone.
export function bossArtDue(rooms,roomId,roomType){
 const boss=rooms?.find?.(r=>r.exists&&r.type==='boss');if(!boss)return false;
 if(roomType==='boss')return true;
 const rows=Math.abs(Math.floor(boss.id/5)-Math.floor(roomId/5)),cols=Math.abs(boss.id%5-roomId%5);
 return rows+cols<=2;
}
