export function encounterCount(room,floor){
 const roll=Math.floor((room.seed||0)/3)%3;
 if(room.type==='vault')return 4+roll;
 if(room.type==='cache')return 3+roll;
 if(floor===1&&room.type==='fight'){
  const count=roll===0?4:5;
  return Math.max(4,count-(room.crowdingPenalty||0));
 }
 return Math.max(4,5+floor+roll+(room.type==='challenge'?1:0)-(room.crowdingPenalty||0));
}
