export function seasonAllowed(season,decades){return decades.includes(Math.floor(Number(String(season).slice(0,4))/10)*10)}
export function appendConnection(engine,route,id,end,longest=false){
 const next=[...route,id];
 if(!longest&&id!==end&&engine.evidence(id,end).length)next.push(end);
 return next;
}
export function rosterFor(data,team,season,decades){
 if(!seasonAllowed(season,decades))return [];
 const ids=new Set(data.groups.filter(g=>g[0]===team&&Number(g[1])===Number(season)).flatMap(g=>g[2]));
 return [...ids].sort((a,b)=>data.players[a][0].localeCompare(data.players[b][0])||a-b);
}
export function canAddPlayer(engine,route,end,id,{finished=false,longest=false,links=[],connection=null}={}){
 if(finished)return {allowed:false,reason:'Game complete'};
 if(route.includes(id))return {allowed:false,reason:'Already used'};
 let evidence=engine.evidence(route.at(-1),id);
 if(connection)evidence=evidence.filter(g=>g[0]===connection[0]&&g[1]===connection[1]);
 if(!evidence.length)return {allowed:false,reason:'No connection to your current player'};
 if(!longest)return {allowed:true,reason:id===end?'Connect to destination':'Add to chain',evidence:evidence[0]};
 const used=new Set(links.map(g=>`${g[0]}:${g[1]}`)),lastYear=links.at(-1)?.[1];
 const outfieldEvidence=evidence.filter(g=>(lastYear===undefined||g[1]>=lastYear)&&!used.has(`${g[0]}:${g[1]}`)).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0]));
 if(!outfieldEvidence.length)return {allowed:false,reason:'Use a new team-season without going backward in time'};
 for(const group of outfieldEvidence){
  if(id===end||engine.forward(id,end,{excluded:route,usedGroups:[...links,group],afterSeason:group[1]}))return {allowed:true,reason:id===end?'Connect to destination':'Add to chain',evidence:group};
 }
 return {allowed:false,reason:'No forward route remains to the destination'};
}
