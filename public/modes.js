export const snakeStyles=['open','career','road'];
export const positions=['any','defense','goalie','forward'];
export const styleNames={open:'Snake: Open Ice',career:'Snake: Career Run',road:'Snake: Road Trip'};
export const positionNames={any:'Open Roster',defense:'Blue Line — defensemen',goalie:'Between the Pipes — goalies',forward:'Forward Lines — forwards'};
export const snakeRules={
 open:'Build the longest chain across any years. Change teams every shot. Each team can be used twice total, in different seasons; each season three times total. No repeated players or team-seasons. A dead end ends the round; restart to try again.',
 career:'Start in the first player’s rookie season. Move to a later season with every shot and finish in the destination’s last recorded season. Skip years if needed. A dead end ends your run; restart to try again.',
 road:'Visit as many teams as possible. Years can move in either direction. Use each player once and each team once, even in different seasons.'
};
export function matchesPosition(player,position='any'){
 if(position==='any')return true;
 const p=String(player?.[1]||'').toUpperCase().split(/[\s,\/|-]+/);
 if(position==='defense')return p.includes('D');
 if(position==='goalie')return p.includes('G');
 return position==='forward'&&p.some(x=>['F','C','L','R','LW','RW','W'].includes(x));
}
export function careerBounds(data,start,end){
 const first=data.groups.filter(g=>g[2].includes(start)).map(g=>g[1]);
 const last=data.groups.filter(g=>g[2].includes(end)).map(g=>g[1]);
 return {first:first.length?Math.min(...first):null,last:last.length?Math.max(...last):null};
}
export function snakeScore(style,links){
 if(style==='career')return {value:new Set(links.map(g=>g[1])).size,unit:'seasons',span:links.length?Number(String(links.at(-1)[1]).slice(0,4))-Number(String(links[0][1]).slice(0,4))+1:0};
 if(style==='road')return {value:new Set(links.map(g=>g[0])).size,unit:'teams'};
 return {value:links.length,unit:'shots'};
}

// Era selection chooses endpoints; Shortest Chain connections use all seasons.
export function playersFromEras(data,decades,pool=null){
 const allowed=new Set(decades),ids=new Set();
 for(const group of data.groups)if(allowed.has(Math.floor(Number(String(group[1]).slice(0,4))/10)*10))for(const id of group[2])ids.add(id);
 return pool===null?[...ids]:pool.filter(id=>ids.has(id));
}

// The destination is supplied by the game; an automatic finish is not another shot.
export function minimumShots(connections){return Math.max(1,connections-1)}
export function shortestShots(route,end){return route.at(-1)===end?minimumShots(route.length-1):Math.max(0,route.length-1)}
export function shotLabel(shots){return `${shots} ${shots===1?'shot':'shots'}`}

export function dailyStars(shots,shortest,revealed=false){return revealed?0:Math.max(1,3-Math.max(0,shots-shortest))}
