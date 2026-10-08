export function seasonAllowed(season,decades){return decades.includes(Math.floor(Number(String(season).slice(0,4))/10)*10)}
export function rosterFor(data,team,season,decades){
 if(!seasonAllowed(season,decades))return [];
 const ids=new Set(data.groups.filter(g=>g[0]===team&&Number(g[1])===Number(season)).flatMap(g=>g[2]));
 return [...ids].sort((a,b)=>data.players[a][0].localeCompare(data.players[b][0])||a-b);
}
export function canAddPlayer(engine,route,end,id,{finished=false,longest=false}={}){
 if(finished)return {allowed:false,reason:'Game complete'};
 if(route.includes(id))return {allowed:false,reason:'Already used'};
 if(!engine.evidence(route.at(-1),id).length)return {allowed:false,reason:'No connection to your current player'};
 if(longest&&id!==end&&!engine.shortest(id,end,route))return {allowed:false,reason:'No unused-player route to the destination'};
 return {allowed:true,reason:id===end?'Connect to destination':'Add to chain'};
}
