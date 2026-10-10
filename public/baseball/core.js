import {careerStarts} from './career-starts.js';
import {matchesPosition} from './modes.js';
export const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'');
// Accent-insensitive search uses MLB's recorded full names.
const playerAliases={121597:['Nolan Ryan'],120891:['Tim Raines'],114989:['Goose Gossage','Rich Gossage']};
export function matchesPlayerName(id,name,query){
 const needle=normalize(query).trim();
 return [name,...(playerAliases[id]||[])].some(value=>normalize(value).includes(needle));
}
export function createEngine(data,decades=null,{position='any',start=null,end=null}={}){
 if(position!=='any')data={...data,groups:data.groups.map(g=>[g[0],g[1],g[2].filter(id=>id===start||id===end||matchesPosition(data.players[id],position))])};
 const memberships=new Map();
 const allowed=decades===null?null:new Set(decades);
 data.groups.forEach((g,i)=>{if(allowed&&!allowed.has(Math.floor(Number(String(g[1]).slice(0,4))/10)*10))return;g[2].forEach(p=>{if(!memberships.has(p))memberships.set(p,[]);memberships.get(p).push(i)})});
 const evidence=(a,b)=>{const other=new Set(memberships.get(b)||[]);return (memberships.get(a)||[]).filter(i=>other.has(i)).map(i=>data.groups[i])};
 function shortest(a,b,excluded=[]){
  const blocked=new Set(excluded);blocked.delete(a);
  const parents=new Map([[a,null]]),seen=new Set(),q=[a];
  for(let i=0;i<q.length;i++){
   const p=q[i];if(p===b){const out=[];for(let n=b;n!==null;n=parents.get(n))out.push(n);return out.reverse()}
   for(const gi of memberships.get(p)||[]){if(seen.has(gi))continue;seen.add(gi);for(const n of data.groups[gi][2])if(!blocked.has(n)&&!parents.has(n)){parents.set(n,p);q.push(n)}}
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
 function forward(a,b,{excluded=[],usedGroups=[],afterSeason=null,maxMoves=Infinity}={}){
  const blocked=new Set(excluded);blocked.delete(a);
  if(blocked.has(b))return null;
  const used=new Set(usedGroups.map(g=>`${g[0]}:${g[1]}`)),expanded=new Set();
  const states=[{id:a,year:afterSeason,parent:null,group:null,depth:0}],seen=new Set([`${a}:${afterSeason}`]);
  for(let i=0;i<states.length;i++){
   const state=states[i];
   if(state.id===b){const players=[],links=[];for(let n=i;n!==null;n=states[n].parent){players.push(states[n].id);if(states[n].group)links.push(states[n].group.slice(0,2))}return {players:players.reverse(),links:links.reverse()}}
   if(state.depth>=maxMoves)continue;
   for(const gi of [...(memberships.get(state.id)||[])].sort((x,y)=>data.groups[x][1]-data.groups[y][1])){
    const group=data.groups[gi],key=`${group[0]}:${group[1]}`;
    if(used.has(key)||expanded.has(key)||(state.year!==null&&group[1]<state.year))continue;
    expanded.add(key);
    for(const id of group[2]){const nextKey=`${id}:${group[1]}`;if(id===state.id||blocked.has(id)||seen.has(nextKey))continue;seen.add(nextKey);states.push({id,year:group[1],parent:i,group,depth:state.depth+1})}
   }
  }return null;
 }
 const connectionProfiles=new Map();
 function connectionProfile(id){
  if(connectionProfiles.has(id))return connectionProfiles.get(id);
  const groups=(memberships.get(id)||[]).map(i=>data.groups[i]),years=groups.map(g=>Number(String(g[1]).slice(0,4)));
  const connections=new Set(groups.flatMap(g=>g[2]));connections.delete(id);
  const profile={first:Math.min(...years),last:Math.max(...years),connections:connections.size,teams:new Set(groups.map(g=>g[0])).size};connectionProfiles.set(id,profile);return profile;
 }
 function randomLongestMatchup(random=Math.random,pool=null){
  const eligible=pool===null?null:new Set(pool),candidates=[...memberships.keys()].filter(p=>!eligible||eligible.has(p));
  const ranked=candidates.sort((a,b)=>{const x=connectionProfile(a),y=connectionProfile(b);return (y.connections+20*y.teams+10*(y.last-y.first))-(x.connections+20*x.teams+10*(x.last-x.first))});
  const broadPool=ranked.slice(0,Math.max(12,Math.ceil(ranked.length/2)));let best=null;
  function consider(a,b){
   if(a===b)return;
   const x=connectionProfile(a),y=connectionProfile(b);
   if(x.first>y.first)[a,b]=[b,a];
   let path=forward(a,b,{maxMoves:4});if(!path){[a,b]=[b,a];path=forward(a,b,{maxMoves:4})}if(!path||path.players.length<3)return;
   const startProfile=connectionProfile(a),endProfile=connectionProfile(b),span=endProfile.last-startProfile.first;
   const score=span*20+startProfile.connections+endProfile.connections+random()*150;
   if(!best||score>best.score)best={start:a,end:b,par:path.players.length-1,span,score};
  }
  // Sample verified 2–4 move pairs from players with many connections, then
  // favor a broad span between an earlier starter and a later destination.
  for(let i=0;i<12;i++){const pair=randomMatchup(random,broadPool,2,4);if(!pair)break;consider(pair.start,pair.end)}
  if(!best){const pair=randomMatchup(random,ranked,2,2);if(pair)consider(pair.start,pair.end)}
  if(!best)return null;
  const {score,...pair}=best;return pair;
 }
 const search=q=>{const needle=normalize(q).trim();if(!needle)return [];return Object.entries(data.players).filter(([id,p])=>memberships.has(Number(id))&&matchesPlayerName(id,p[0],needle)).sort((a,b)=>Number(normalize(b[1][0]).startsWith(needle))-Number(normalize(a[1][0]).startsWith(needle))||a[1][0].localeCompare(b[1][0])).slice(0,12).map(([id,p])=>({id:Number(id),name:p[0],position:p[1],first:p[2],last:p[3]}))};
 const hintTeams=(a,b)=>{const path=shortest(a,b);return path&&path.length>1?[...new Set(evidence(a,path[1]).map(g=>g[0]))]:[]};
 const randomAvailability=new Map();
 function randomMatchup(random=Math.random,pool=null,minMoves=2,maxMoves=4,restriction='any'){
  if(!Number.isInteger(minMoves)||!Number.isInteger(maxMoves)||minMoves<1||maxMoves<minMoves)return null;
  const eligible=pool===null?null:new Set(pool);
  const candidates=[...memberships.keys()].filter(p=>!eligible||eligible.has(p));
  const cacheKey=`${restriction}:${minMoves}:${maxMoves}:${candidates.join(',')}`;
  const lengths=randomAvailability.get(cacheKey)||Array.from({length:maxMoves-minMoves+1},(_,i)=>minMoves+i);
  if(!lengths.length)return null;
  // Choose the move count first so shorter routes do not dominate the mix.
  const target=lengths[Math.floor(random()*lengths.length)],alternatives=new Map();
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
  const visited=new Set();
  for(const a of candidates){
   if(visited.has(a))continue;
   const q=[a],distance=new Map([[a,0]]),groups=new Set();
   for(let i=0;i<q.length;i++){const p=q[i];visited.add(p);if(distance.get(p)>=maxMoves||(p!==a&&!matchesPosition(data.players[p],restriction)))continue;for(const gi of memberships.get(p)||[]){if(groups.has(gi))continue;groups.add(gi);for(const n of data.groups[gi][2])if(!distance.has(n)){distance.set(n,distance.get(p)+1);q.push(n)}}}
   const reachable=q.filter(p=>p!==a&&(!eligible||eligible.has(p)));
   if(reachable.length)for(const p of q)visited.delete(p);
   const byLength=new Map();for(const p of reachable){const moves=distance.get(p);if(moves<minMoves||moves>maxMoves)continue;if(!byLength.has(moves))byLength.set(moves,[]);byLength.get(moves).push(p)}
   for(const [moves,ends] of byLength)if(!alternatives.has(moves))alternatives.set(moves,{start:a,ends});
   if(byLength.has(target)){const ends=byLength.get(target);return {start:a,end:ends[Math.floor(random()*ends.length)],par:target}}
  }
  // Some era/difficulty combinations cannot produce every length. Remember
  // their available lengths and choose a valid game within the same range.
  const available=[...alternatives.keys()].sort((x,y)=>x-y);randomAvailability.set(cacheKey,available);
  if(!available.length)return null;
  const moves=available[Math.floor(random()*available.length)],{start,ends}=alternatives.get(moves);
  return {start,end:ends[Math.floor(random()*ends.length)],par:moves};
 }
 return {evidence,shortest,search,hintTeams,allShortest,randomMatchup,forward,randomLongestMatchup,connectionProfile};
}
// Keep ties in the supplied order; career starts come from full player records.
export function orderMatchup(data,start,end){return (careerStarts[start]??data.players[start]?.[2])>(careerStarts[end]??data.players[end]?.[2])?[end,start]:[start,end]}
export function easternDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function puzzleFor(data,date){if(data.dailySchedule?.overrides?.[date])return data.dailySchedule.overrides[date];const puzzles=data.dailySchedule?.puzzles||data.puzzles;const day=Math.floor(Date.parse(date+'T00:00:00Z')/86400000);return puzzles[((day%puzzles.length)+puzzles.length)%puzzles.length]}
export function streakFor(wins,date){let day=Date.parse(date+'T00:00:00Z'),n=0;if(!wins[date])day-=86400000;while(wins[new Date(day).toISOString().slice(0,10)]){n++;day-=86400000}return n}
