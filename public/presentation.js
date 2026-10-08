export function connectionSentence({fromName,toName,index,lastIndex,teamName,season}){
 const ordinal=n=>`${n}${n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;
 const role=n=>n===0?'Starting player':n===lastIndex?'destination player':`${ordinal(n)}-degree player`;
 return `${role(index)} ${fromName} played with ${role(index+1)} ${toName} on the ${teamName} during the ${season} season.`;
}
export function portrait(id,name){
 const span=document.createElement('span');span.className='portrait';span.setAttribute('aria-hidden','true');span.textContent=name.split(' ').map(s=>s[0]).slice(0,2).join('');
 const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=`https://assets.nhle.com/mugs/nhl/latest/${id}.png`;img.onerror=()=>img.remove();span.append(img);return span;
}
export function teamLogo(code,name){
 const span=document.createElement('span');span.className='team-logo';span.setAttribute('aria-hidden','true');span.textContent=code;
 const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=`https://assets.nhle.com/logos/nhl/svg/${code}_light.svg`;img.onerror=()=>img.remove();img.onload=()=>{span.replaceChildren(img)};span.append(img);return span;
}
