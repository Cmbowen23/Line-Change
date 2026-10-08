export function connectionSentence({fromName,toName,teamName,season}){
 return `${fromName} played with ${toName} on the ${teamName} during ${season}.`;
}
export function portrait(id,name){
 const span=document.createElement('span');span.className='portrait';span.setAttribute('aria-hidden','true');
 const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=`https://assets.nhle.com/mugs/nhl/latest/${id}.png`;img.onerror=()=>img.remove();span.append(img);return span;
}
export function teamLogo(code,name){
 const span=document.createElement('span');span.className='team-logo';span.setAttribute('aria-hidden','true');span.textContent=code;
 const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=`https://assets.nhle.com/logos/nhl/svg/${code}_light.svg`;img.onerror=()=>img.remove();img.onload=()=>{span.replaceChildren(img)};span.append(img);return span;
}

export function playerHistory(data,id,decades){
 const teams=new Map();
 for(const [team,season,players] of data.groups){if(!players.includes(id))continue;if(!teams.has(team))teams.set(team,new Set());teams.get(team).add(season)}
 return [...teams].map(([team,seasons])=>({team,seasons:[...seasons].sort((a,b)=>a-b),allowed:[...seasons].filter(s=>decades.includes(Math.floor(Number(String(s).slice(0,4))/10)*10)).sort((a,b)=>a-b)})).sort((a,b)=>a.seasons[0]-b.seasons[0]);
}
export function seasonRanges(seasons){
 const years=[...new Set(seasons.map(s=>Number(String(s).slice(0,4))))].sort((a,b)=>a-b),ranges=[];
 const label=(a,b)=>a===b?`${a}–${String(a+1).slice(-2)}`:`${a}–${String(a+1).slice(-2)} to ${b}–${String(b+1).slice(-2)}`;
 for(let i=0;i<years.length;i++){const first=years[i];while(i+1<years.length&&years[i+1]===years[i]+1)i++;ranges.push(label(first,years[i]))}return ranges.join(', ');
}
export function difficultyPool(data,level){
 if(level==='easy')return data.dailySchedule.notablePlayerIds;
 if(level==='medium')return Object.entries(data.playerDepth.regularSeasonGames).filter(([,games])=>games>=300).map(([id])=>Number(id));
 return null;
}
