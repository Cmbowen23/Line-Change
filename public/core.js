export const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'');
export function createEngine(data){
 const memberships=new Map();
 data.groups.forEach((g,i)=>g[2].forEach(p=>{if(!memberships.has(p))memberships.set(p,[]);memberships.get(p).push(i)}));
 const evidence=(a,b)=>{const other=new Set(memberships.get(b)||[]);return (memberships.get(a)||[]).filter(i=>other.has(i)).map(i=>data.groups[i])};
 function shortest(a,b){
  const parents=new Map([[a,null]]),seen=new Set(),q=[a];
  for(let i=0;i<q.length;i++){
   const p=q[i];if(p===b){const out=[];for(let n=b;n!==null;n=parents.get(n))out.push(n);return out.reverse()}
   for(const gi of memberships.get(p)||[]){if(seen.has(gi))continue;seen.add(gi);for(const n of data.groups[gi][2])if(!parents.has(n)){parents.set(n,p);q.push(n)}}
  }return null;
 }
 const search=q=>{const needle=normalize(q).trim();if(!needle)return [];return Object.entries(data.players).filter(([id,p])=>normalize(p[0]).includes(needle)).sort((a,b)=>Number(normalize(b[1][0]).startsWith(needle))-Number(normalize(a[1][0]).startsWith(needle))||a[1][0].localeCompare(b[1][0])).slice(0,12).map(([id,p])=>({id:Number(id),name:p[0],position:p[1],first:p[2],last:p[3]}))};
 return {evidence,shortest,search};
}
export function easternDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function puzzleFor(data,date){const day=Math.floor(Date.parse(date+'T00:00:00Z')/86400000);return data.puzzles[((day%data.puzzles.length)+data.puzzles.length)%data.puzzles.length]}
export function streakFor(wins,date){let day=Date.parse(date+'T00:00:00Z'),n=0;if(!wins[date])day-=86400000;while(wins[new Date(day).toISOString().slice(0,10)]){n++;day-=86400000}return n}
