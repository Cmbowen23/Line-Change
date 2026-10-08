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
