export const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'');
export function createEngine(data,decades=null){
 const memberships=new Map();
 const allowed=decades===null?null:new Set(decades);
 data.groups.forEach((g,i)=>{if(allowed&&!allowed.has(Math.floor(Number(String(g[1]).slice(0,4))/10)*10))return;g[2].forEach(p=>{if(!memberships.has(p))memberships.set(p,[]);memberships.get(p).push(i)})});
 const evidence=(a,b)=>{const other=new Set(memberships.get(b)||[]);return (memberships.get(a)||[]).filter(i=>other.has(i)).map(i=>data.groups[i])};
 function shortest(a,b){
  const parents=new Map([[a,null]]),seen=new Set(),q=[a];
  for(let i=0;i<q.length;i++){
   const p=q[i];if(p===b){const out=[];for(let n=b;n!==null;n=parents.get(n))out.push(n);return out.reverse()}
   for(const gi of memberships.get(p)||[]){if(seen.has(gi))continue;seen.add(gi);for(const n of data.groups[gi][2])if(!parents.has(n)){parents.set(n,p);q.push(n)}}
  }return null;
 }
 function allShortest(a,b){
  function distances(root){
   const ds=new Map([[root,0]]),seen=new Set(),q=[root];
   for(let i=0;i<q.length;i++){const p=q[i];for(const gi of memberships.get(p)||[]){if(seen.has(gi))continue;seen.add(gi);for(const n of data.groups[gi][2])if(!ds.has(n)){ds.set(n,ds.get(p)+1);q.push(n)}}}
   return ds;
  }
  const from=distances(a),distance=from.get(b);
  if(distance===undefined)return {distance:null,count:0n,routes:function*(){}};
  const to=distances(b),next=new Map();
  for(const [p,depth] of from){
   if(depth>=distance||depth+to.get(p)!==distance)continue;
   const children=new Set();
   for(const gi of memberships.get(p)||[])for(const n of data.groups[gi][2])if(from.get(n)===depth+1&&to.get(n)===distance-depth-1)children.add(n);
   next.set(p,[...children].sort((x,y)=>data.players[x][0].localeCompare(data.players[y][0])||x-y));
  }
  const counts=new Map([[b,1n]]);
  for(let depth=distance-1;depth>=0;depth--)for(const [p,children] of next)if(from.get(p)===depth)counts.set(p,children.reduce((sum,n)=>sum+(counts.get(n)||0n),0n));
  // Lazy enumeration: every answer stays accessible without rendering them all at once.
  function* routes(){
   const path=[a],stack=[{node:a,index:0}];
   while(stack.length){const frame=stack.at(-1);if(frame.node===b){yield [...path];stack.pop();path.pop();continue}const children=next.get(frame.node)||[];if(frame.index>=children.length){stack.pop();path.pop();continue}const n=children[frame.index++];path.push(n);stack.push({node:n,index:0})}
  }
  return {distance,count:counts.get(a)||0n,routes};
 }
 const search=q=>{const needle=normalize(q).trim();if(!needle)return [];return Object.entries(data.players).filter(([id,p])=>memberships.has(Number(id))&&normalize(p[0]).includes(needle)).sort((a,b)=>Number(normalize(b[1][0]).startsWith(needle))-Number(normalize(a[1][0]).startsWith(needle))||a[1][0].localeCompare(b[1][0])).slice(0,12).map(([id,p])=>({id:Number(id),name:p[0],position:p[1],first:p[2],last:p[3]}))};
 const hintTeams=(a,b)=>{const path=shortest(a,b);return path&&path.length>1?[...new Set(evidence(a,path[1]).map(g=>g[0]))]:[]};
 return {evidence,shortest,search,hintTeams,allShortest};
}
export function easternDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function puzzleFor(data,date){if(data.dailySchedule?.overrides?.[date])return data.dailySchedule.overrides[date];const puzzles=data.dailySchedule?.puzzles||data.puzzles;const day=Math.floor(Date.parse(date+'T00:00:00Z')/86400000);return puzzles[((day%puzzles.length)+puzzles.length)%puzzles.length]}
export function streakFor(wins,date){let day=Date.parse(date+'T00:00:00Z'),n=0;if(!wins[date])day-=86400000;while(wins[new Date(day).toISOString().slice(0,10)]){n++;day-=86400000}return n}
