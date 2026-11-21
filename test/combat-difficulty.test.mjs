import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/campaign.js';
import {spawnEncounter,LAYOUTS,blocked} from '../dist/terrain.js';
import {CHAPTER_LAYOUTS} from '../dist/chapter-content.js';
function room(floor,type){const g=new Game();g.start();g.floor=floor;g.generate();const r=g.rooms.find(r=>r.exists&&r.type===type);r.locked=false;r.bombLocked=false;g.enter(r.id,'top');return g}
test('first-floor fights have four to five enemies and later floors and challenge rooms keep their budgets',()=>{
 for(let f=1;f<=5;f++)for(const type of ['fight','challenge']){
  const g=room(f,type),counts=new Set();
  g.room.crowdingPenalty=0;
  for(let seed=0;seed<9;seed++){
   g.room.seed=seed;g.room.encounterProfile=seed%8;
   const mobs=spawnEncounter(g,g.room);counts.add(mobs.length);
   const expected=f===1&&type==='fight'?(seed<3?4:5):5+f+Math.floor(seed/3)+(type==='challenge'?1:0);
   assert.equal(mobs.length,expected);
   for(const t of ['runner','stitchMedic','conductor'])assert.ok(mobs.filter(e=>e.type===t).length<=1);
  }
  assert.equal(counts.size,f===1&&type==='fight'?2:3);
 }
 for(const type of ['vault','cache']){const g=room(1,type),min=type==='vault'?4:3;assert.ok(g.room.enemies.length>=min&&g.room.enemies.length<=min+2)}
});
test('frontline health improves while runners and support units keep their old health',()=>{
 const g=room(3,'fight');for(const [type,extra] of Object.entries({brute:2,forklift:3,stitchling:2,warden:2,loader:1,runner:0,conductor:0,stitchMedic:0})){const e=g.spawn(type,200,200),base=(type==='brute'?4:type==='runner'?2:3)+3;assert.equal(e.hp,base+extra);assert.equal(e.hp,e.maxHp)}
});
test('non-boss fights move faster and shoot sooner without shortening visible wind-ups',()=>{
 for(const type of ['fight','challenge','vault','cache']){const g=room(2,type),e=g.spawn('echoBell',200,200);g.enemyAttack(e);assert.equal(e.cd,2.8*.85);assert.equal(e.mobCast.wind,.65);assert.equal(g.moveScale(e),1.1)}
 const g=room(2,'boss'),e=g.spawn('echoBell',200,200);g.enemyAttack(e);assert.equal(e.cd,2.8);assert.equal(g.moveScale(e),1);
});
test('even thirteen-monster groups fit every layout with safe entry space',()=>{
 const g=new Game();g.start();g.floor=5;
 for(const layout of [...LAYOUTS,...CHAPTER_LAYOUTS.flat()])for(const [x,y] of [[95,300],[865,300],[480,90],[480,510]]){
  g.p.x=x;g.p.y=y;const r={layoutId:layout.id,obstacles:layout.build(),hazards:[],type:'challenge',seed:8};const mobs=spawnEncounter(g,r);assert.equal(mobs.length,13);
  for(let i=0;i<mobs.length;i++){const e=mobs[i];assert.ok(!blocked(r,e.x,e.y,e.r));assert.ok(Math.hypot(e.x-x,e.y-y)>=150);for(const other of mobs.slice(0,i))assert.ok(Math.hypot(e.x-other.x,e.y-other.y)>=60)}
 }
});
test('resource guards also leave room to move at every entrance',()=>{
 for(const type of ['vault','cache'])for(const side of ['left','right','top','bottom']){const g=new Game();g.start();const r=g.rooms.find(r=>r.exists&&r.type===type);r.seed=8;r.locked=false;r.bombLocked=false;g.enter(r.id,side);assert.equal(r.enemies.length,type==='vault'?6:5);assert.ok(r.enemies.every(e=>Math.hypot(e.x-g.p.x,e.y-g.p.y)>=160))}
});

test('getting hit pushes the frog out of the enemy body instead of parking it there',()=>{
 const g=new Game();g.start();g.room.type='fight';g.room.clear=false;g.room.obstacles=[];g.room.hazards=[];g.p.x=300;g.p.y=350;g.p.inv=0;g.p.hp=g.p.maxHp;
 const e=g.spawn('brute',318,350);e.cd=999;e.hp=999;g.room.enemies=[e];
 g.hurt();
 assert.equal(g.p.hp,g.p.maxHp-1);
 assert.ok(Math.hypot(g.p.x-e.x,g.p.y-e.y)>20,'player should be pushed clear of the enemy');
 assert.ok(e.repelled>.2,'the threat should be staggered after landing a hit');
});
test('first floor fight rooms leave at least 240px between the door and every spawn',()=>{
 const g=room(1,'fight');const p={x:g.p.x,y:g.p.y};
 assert.ok(g.room.enemies.length>=4);
 for(const e of g.room.enemies)assert.ok(Math.hypot(e.x-p.x,e.y-p.y)>=240);
});

test('contact knockback never leaves the frog inside a crate or wall',()=>{
 const g=new Game();g.start();g.floor=1;g.generate();const r=g.rooms.find(x=>x.exists&&x.type==='fight');r.locked=false;r.bombLocked=false;g.enter(r.id,'top');
 g.p.x=300;g.p.y=300;g.p.inv=0;g.p.hp=g.p.maxHp;r.obstacles=[{x:380,y:300,r:60,kind:'crate'}];
 const e=g.spawn('brute',270,300);e.cd=999;e.hp=999;r.enemies=[e];
 g.hurt();
 assert.ok(Math.hypot(g.p.x-e.x,g.p.y-e.y)>20,'the frog should still move off the enemy');
 assert.ok(!blocked(r,g.p.x,g.p.y,g.p.r),'the push must not tunnel into the crate');
});

test('an ordinary shot nudges a mobile enemy along its trajectory once per volley without stun',()=>{
 const g=room(1,'fight');g.room.obstacles=[];g.room.hazards=[];
 const e=g.spawn('brute',480,300);g.room.enemies=[e];
 g.p.x=420;g.p.y=306;g.p.inv=2;g.p.damage=1;g.enemySpeed=()=>0;
 g.shoot(1,0);g.shoot(1,0);
 const hp=e.hp;
 for(let i=0;i<6;i++)g.update(.02,{});
 assert.equal(e.hp,hp-2);assert.equal(e.x,484);assert.equal(e.y,300);
 assert.ok(!e.repelled);
});

test('normal recoil respects terrain, room edges, fixed targets and companion shots',()=>{
 const g=room(1,'fight');g.room.obstacles=[];
 const shot={vx:490,vy:0,hits:new Set()};
 const mob=g.spawn('brute',480,300);
 g.room.obstacles=[{kind:'pillar',x:480+mob.r+21,y:300,r:20}];
 g.onBulletHit(mob,shot);assert.equal(mob.x,480);
 g.room.obstacles=[];
 for(const type of ['boss','turret']){
  const fixed=g.spawn(type,480,300);g.onBulletHit(fixed,shot);assert.equal(fixed.x,480);
 }
 g.onBulletHit(mob,{...shot,pet:true});assert.equal(mob.x,480);
 mob.x=905-mob.r;g.onBulletHit(mob,shot);assert.equal(mob.x,905-mob.r);
});
