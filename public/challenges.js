export const allDecades=Array.from({length:12},(_,i)=>1910+i*10);
export function challengeURL(base,start,end,decades){
 const url=new URL(base);url.search='';url.hash='';
 url.searchParams.set('start',start);url.searchParams.set('end',end);
 url.searchParams.set('decades',[...decades].sort((a,b)=>a-b).join(','));
 return url.href;
}
export function parseChallenge(url,data){
 const params=new URL(url).searchParams;
 if(!['start','end','decades'].some(k=>params.has(k)))return null;
 const a=params.get('start'),b=params.get('end'),raw=params.get('decades');
 if(!/^\d+$/.test(a||'')||!/^\d+$/.test(b||'')||!raw||!/^\d+(,\d+)*$/.test(raw))throw Error('This matchup link is incomplete or invalid. Choose a new matchup below.');
 const start=Number(a),end=Number(b),decades=[...new Set(raw.split(',').map(Number))];
 if(!data.players[start]||!data.players[end]||start===end||decades.some(d=>!allDecades.includes(d)))throw Error('This matchup link has invalid players or decades. Choose a new matchup below.');
 return {start,end,decades};
}
