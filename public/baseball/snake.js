import {orderMatchup} from './core.js';

// Every search result carries the team-season for each link. Career searches
// are chronological; Open Field tracks full history; Road Trip tracks used teams.
export function createSnake(data,decades,style='open'){
 const allowed=new Set(decades),groups=data.groups.filter(g=>allowed.has(Math.floor(Number(String(g[1]).slice(0,4))/10)*10));
 const memberships=new Map();groups.forEach((g,i)=>g[2].forEach(p=>{if(!memberships.has(p))memberships.set(p,[]);memberships.get(p).push(i)}));
 const careers=new Map();for(const g of data.groups)for(const id of g[2]){const old=careers.get(id);careers.set(id,old?{first:Math.min(old.first,g[1]),last:Math.max(old.last,g[1])}:{first:g[1],last:g[1]})}
 const key=g=>style==='road'?g[0]:`${g[0]}:${g[1]}`;
 const evidence=(a,b)=>(memberships.get(a)||[]).map(i=>groups[i]).filter(g=>g[2].includes(b));
 function context(start,end,route=[start],links=[]){return {start,end,route,links,bounds:{first:careers.get(start)?.first??null,last:careers.get(end)?.last??null}}}
 function groupAllowed(g,c,ignorePrevious=false){
  if(c.links.some(x=>key(x)===key(g)))return false;
  if(style==='open')return (ignorePrevious||c.links.at(-1)?.[0]!==g[0])&&c.links.filter(x=>x[0]===g[0]).length<2&&c.links.filter(x=>x[1]===g[1]).length<3;
  if(style!=='career')return true;
  if(!c.links.length)return g[1]===c.bounds.first;
  return g[1]>c.links.at(-1)[1]&&g[1]<=c.bounds.last;
 }
 function localConnections(c,id){
  if(c.route.includes(id))return [];
  return evidence(c.route.at(-1),id).filter(g=>groupAllowed(g,c)&&(style!=='career'||id!==c.end||g[1]===c.bounds.last)).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0]));
 }
 function reconstruct(states,index){
  const players=[],links=[];for(let n=index;n!==null;n=states[n].parent){players.push(states[n].id);if(states[n].group)links.push(states[n].group.slice(0,2))}
  players.reverse();links.reverse();
  // A repeated interim player in a BFS witness can be shortcut safely: removing
  // its loop releases teams and preserves increasing Career Run seasons.
  for(let i=0;i<players.length;i++){const j=players.lastIndexOf(players[i]);if(j>i){players.splice(i+1,j-i);links.splice(i,j-i);i--}}
  return {players,links};
 }
 // Exact Open Field search retains every used player, team-season and usage count.
 // Relaxed reachability safely prunes disconnected branches; it ignores only
 // future consecutive-team restrictions, never declares a bounded search dead.
 function openFinish(c,maxStates){
  const root=c.route.at(-1),players=[root],links=[];let nodes=0;
  const state=()=>({...c,route:[...c.route.slice(0,-1),...players],links:[...c.links,...links]});
  function choices(){
   const current=state(),blocked=new Set(current.route),distance=new Map([[c.end,0]]),queue=[c.end],expanded=new Set();
   blocked.delete(root);blocked.delete(players.at(-1));
   for(let i=0;i<queue.length;i++)for(const gi of memberships.get(queue[i])||[]){
    if(expanded.has(gi))continue;expanded.add(gi);const g=groups[gi];if(!groupAllowed(g,current,true))continue;
    for(const id of g[2])if(!blocked.has(id)&&!distance.has(id)){distance.set(id,distance.get(queue[i])+1);queue.push(id)}
   }
   if(!distance.has(players.at(-1)))return [];
   const out=[];for(const gi of memberships.get(players.at(-1))||[]){const g=groups[gi];if(!groupAllowed(g,current))continue;for(const id of g[2])if(!current.route.includes(id)&&distance.has(id))out.push({id,g})}
   return out.sort((a,b)=>distance.get(a.id)-distance.get(b.id)||a.id-b.id);
  }
  if(root===c.end)return {path:{players:[root],links:[]},exhausted:true};
  const stack=[{options:choices(),index:0}];
  while(stack.length){
   const frame=stack.at(-1);
   if(frame.index>=frame.options.length){stack.pop();if(links.length){players.pop();links.pop()}continue}
   if(nodes++>=maxStates)return {path:null,exhausted:false};
   const {id,g}=frame.options[frame.index++];players.push(id);links.push(g.slice(0,2));
   if(id===c.end)return {path:{players:[...players],links:[...links]},exhausted:true};
   stack.push({options:choices(),index:0});
  }
  return {path:null,exhausted:true};
 }
 function finish(c,{maxStates=50000}={}){
  if(style==='open')return openFinish(c,maxStates);
  const stateLimit=style==='career'?Infinity:maxStates;
  const root=c.route.at(-1);if(root===c.end)return {path:{players:[root],links:[]},exhausted:true};
  if(style==='career'&&(c.bounds.first===null||c.bounds.last===null||c.bounds.first>c.bounds.last))return {path:null,exhausted:true};
  const blocked=new Set(c.route),used=new Set(c.links.map(key)),expanded=new Set();
  const states=[{id:root,year:c.links.at(-1)?.[1]??null,parent:null,group:null,teams:new Set(used)}],seen=new Set();
  for(let i=0;i<states.length;i++){
   if(i>=stateLimit)return {path:null,exhausted:false};
   const state=states[i];
   for(const gi of memberships.get(state.id)||[]){
    const g=groups[gi],k=key(g);
    if(style==='road'?state.teams.has(k):used.has(k))continue;
    if(style==='career'){
     if(state.year===null?g[1]!==c.bounds.first:g[1]<=state.year)continue;
     if(g[1]>c.bounds.last)continue;
    }
    if(style!=='road'&&expanded.has(gi))continue;
    if(style!=='road')expanded.add(gi);
    const teams=style==='road'?new Set([...state.teams,k]):state.teams;
    for(const id of g[2]){
     if(id===state.id||blocked.has(id)||(style==='career'&&id===c.end&&g[1]!==c.bounds.last))continue;
     const stateKey=style==='road'?`${id}:${[...teams].sort().join(',')}`:style==='career'?`${id}:${g[1]}`:String(id);
     if(seen.has(stateKey))continue;seen.add(stateKey);
     const n=states.push({id,year:g[1],parent:i,group:g,teams})-1;
     if(id===c.end)return {path:reconstruct(states,n),exhausted:true};
     if(states.length>=stateLimit)return {path:null,exhausted:false};
    }
   }
  }
  return {path:null,exhausted:true};
 }
 function canAdd(c,id,connection=null){
  if(c.route.includes(id))return {allowed:false,reason:'Already used'};
  if(!evidence(c.route.at(-1),id).length)return {allowed:false,reason:'No connection to your current player'};
  let options=localConnections(c,id);if(connection)options=options.filter(g=>g[0]===connection[0]&&g[1]===connection[1]);
  if(!options.length)return {allowed:false,reason:style==='career'?(id===c.end?'Finish in the destination’s last recorded season':'Use the first recorded season first, then a later season'):style==='road'?'Use a new team':'Change teams each move; max two uses per team and three per season; no repeated team-season'};
  for(const g of options){
   if(style==='career'||style==='open'||id===c.end)return {allowed:true,evidence:g};
   const remaining=finish({...c,route:[...c.route,id],links:[...c.links,g.slice(0,2)]});
   if(remaining.path||!remaining.exhausted)return {allowed:true,evidence:g};
  }
  return {allowed:false,reason:'No valid route remains to the destination'};
 }
 function validPath(c,path){
  if(!path||path.players[0]!==c.route.at(-1)||path.players.at(-1)!==c.end||path.links.length!==path.players.length-1)return false;
  let state={...c,route:[...c.route],links:[...c.links]};
  for(let i=0;i<path.links.length;i++){const id=path.players[i+1],g=path.links[i];if(!localConnections(state,id).some(x=>x[0]===g[0]&&x[1]===g[1]))return false;state.route.push(id);state.links.push(g)}return true;
 }
 function longest(c,{budgetMs=1800,maxNodes=40000,seedPath=null}={}){
  const first=finish(c,{maxStates:3000}),initial=seedPath&&validPath(c,seedPath)?seedPath:first.path;
  let best=initial,nodes=0,complete=true;const deadline=Date.now()+budgetMs;
  const used=new Set(c.links.map(key)),players=[c.route.at(-1)],links=[],blocked=new Set(c.route);
  const upper=style==='career'?new Set(groups.filter(g=>g[1]<=(c.bounds.last??0)&&g[1]>=(c.bounds.first??Infinity)).map(g=>g[1])).size-c.links.length:Math.min(memberships.size-c.route.length,new Set(groups.map(key)).size-used.size);
  const openUpper=style==='open'?Math.min(upper,[...new Set(groups.map(g=>g[0]))].reduce((n,t)=>n+Math.max(0,2-c.links.filter(g=>g[0]===t).length),0),[...new Set(groups.map(g=>g[1]))].reduce((n,y)=>n+Math.max(0,3-c.links.filter(g=>g[1]===y).length),0)):style==='road'?Math.min(upper,new Set(groups.map(g=>g[0])).size-new Set(c.links.map(g=>g[0])).size):upper;
  function options(id){
   const state={...c,route:[...c.route.slice(0,-1),...players],links:[...c.links,...links]},out=[];
   for(const gi of memberships.get(id)||[]){const g=groups[gi];if(used.has(key(g))||!groupAllowed(g,state))continue;for(const next of g[2])if(!blocked.has(next)&&(style!=='career'||next!==c.end||g[1]===c.bounds.last))out.push({next,g})}
   return out.sort((a,b)=>Number(a.next===c.end)-Number(b.next===c.end)||(style==='career'?a.g[1]-b.g[1]:(memberships.get(b.next)?.length||0)-(memberships.get(a.next)?.length||0))||a.next-b.next);
  }
  // Iterative DFS avoids call-stack limits on long runs. A bounded search never
  // claims a proven maximum unless it exhausts every branch or reaches an upper bound.
  function frameFor(id){
   const state={...c,route:[...c.route.slice(0,-1),...players],links:[...c.links,...links]},closure=finish(state,{maxStates:3000});
   if(closure.path){const candidate={players:[...players.slice(0,-1),...closure.path.players],links:[...links,...closure.path.links]};if(!best||candidate.links.length>best.links.length)best=candidate}
   if(!closure.path&&closure.exhausted)return {options:[],index:0};
   return {options:options(id),index:0};
  }
  const stack=[frameFor(players[0])];let reachedBound=false;

  while(stack.length){
   if(Date.now()>=deadline||nodes>=maxNodes){complete=false;break}
   const frame=stack.at(-1);
   if(frame.index>=frame.options.length){stack.pop();if(links.length){used.delete(key(links.pop()));blocked.delete(players.pop())}continue}
   const {next,g}=frame.options[frame.index++];nodes++;
   if(next===c.end){if(!best||players.length>best.links.length)best={players:[...players,next],links:[...links,g.slice(0,2)]};if(best.links.length>=openUpper){reachedBound=true;break}continue}
   players.push(next);links.push(g.slice(0,2));blocked.add(next);used.add(key(g));stack.push(frameFor(next));if(best&&best.links.length>=openUpper){reachedBound=true;break}
  }
  return {path:best,proven:reachedBound||(complete&&first.exhausted),nodes};
 }
 return {context,evidence,localConnections,canAdd,finish,longest,validPath,groups,memberships};
}

export function randomSnake(data,decades,style,pool=null,random=Math.random){
 const game=createSnake(data,decades,style),eligible=pool?new Set(pool):null;
 const candidates=[...game.memberships.keys()].filter(id=>!eligible||eligible.has(id));
 if(candidates.length<2)return null;
 const stats=new Map(candidates.map(id=>{const gs=(game.memberships.get(id)||[]).map(i=>game.groups[i]);return [id,{first:Math.min(...gs.map(g=>g[1])),last:Math.max(...gs.map(g=>g[1])),count:gs.length}]}));
 const ranked=candidates.sort((a,b)=>stats.get(b).count-stats.get(a).count),broad=ranked.slice(0,Math.max(12,Math.ceil(ranked.length/2)));
 let best=null;
 for(let attempt=0;attempt<100;attempt++){
  let a=broad[Math.floor(random()*broad.length)],b=broad[Math.floor(random()*broad.length)];if(a===b)continue;
  [a,b]=orderMatchup(data,a,b);
  const c=game.context(a,b),answer=game.finish(c,{maxStates:12000}).path;
  if(!answer||answer.links.length<2)continue;
  const span=Number(String(c.bounds.last).slice(0,4))-Number(String(c.bounds.first).slice(0,4)),score=(style==='career'?span*20:0)+stats.get(a).count+stats.get(b).count;
  if(!best||score>best.score)best={start:a,end:b,par:answer.links.length,score};
  if(attempt>=20&&best)break;
 }
 if(!best)return null;const {score,...pair}=best;return pair;
}
