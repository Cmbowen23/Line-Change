import {createEngine,easternDate,puzzleFor,streakFor} from './core.js';
const $=id=>document.getElementById(id);
let data,engine,mode='daily',date=easternDate(),start,end,optimal,route=[],finished=false,revealed=false,selectedStart,selectedEnd;
const key=()=>`line-change-v1:${data.version}:${date}`;
function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{status('Your browser cannot save progress. You can still play.')}}
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error)}
const name=p=>data.players[p][0];
const season=s=>String(s).slice(0,4)+'–'+String(s).slice(-2);
function save(){if(mode==='daily')write(key(),{route,finished,revealed})}
function showStreak(){$('streak').textContent=streakFor(read('line-change-wins',{}),easternDate())}
function proof(a,b){const e=engine.evidence(a,b);return e.length?`${data.teams[e[0][0]]||e[0][0]} · ${season(e[0][1])}${e.length>1?` · +${e.length-1} other team-seasons`:''}`:''}
function render(){
 $('start-name').textContent=name(start);$('end-name').textContent=name(end);$('par').textContent=`PAR ${optimal} LINKS`;
 $('chain').replaceChildren();route.forEach((p,i)=>{const li=document.createElement('li'),n=document.createElement('span'),body=document.createElement('div'),title=document.createElement('strong');n.className='number';n.textContent=i;title.textContent=name(p);body.append(title);if(i){const text=document.createElement('div');text.className='proof';text.textContent=proof(route[i-1],p);body.append(text)}else{const text=document.createElement('div');text.className='proof';text.textContent='Your starting line';body.append(text)}li.append(n,body);$('chain').append(li)});
 $('entry').hidden=finished;$('actions').hidden=finished;$('undo').disabled=route.length<2;$('give-up').disabled=false;$('player-search').disabled=false;
 const canFinish=!!engine.evidence(route.at(-1),end).length;$('connect').disabled=!canFinish;$('result').hidden=!finished;
 if(finished)renderResult();
}
function add(p){
 if(finished)return;if(route.includes(p)){status('That player is already in your chain.',true);return}
 if(!engine.evidence(route.at(-1),p).length){status(`${name(route.at(-1))} and ${name(p)} don’t share an NHL team-season. Try another player.`,true);return}
 route.push(p);$('player-search').value='';$('player-results').replaceChildren();
 if(p===end){finished=true;if(mode==='daily'){const wins=read('line-change-wins',{});wins[date]=true;write('line-change-wins',wins);showStreak()}}
 save();render();status(finished?'Every link verified. Nice line change.':`Valid connection. ${proof(route.at(-2),p)}`);
}
function renderResult(){
 const el=$('result');el.replaceChildren();const heading=document.createElement('h2'),score=document.createElement('div'),desc=document.createElement('p');heading.textContent=revealed?'The shortest line.':route.length-1===optimal?'Top of the league.':'You’re connected.';score.className='score';score.textContent=`${route.length-1} LINKS · PAR ${optimal}`;desc.textContent=revealed?'Route revealed. This daily attempt won’t count toward your streak.':route.length-1===optimal?'You found a shortest possible route.':'A valid route. See if you can match par in free play.';el.append(heading,score,desc);
 if(!revealed){const b=document.createElement('button');b.textContent='Share result';b.onclick=share;el.append(b)}
 if(mode==='free'){const b=document.createElement('button');b.className='secondary';b.textContent='Choose another matchup';b.style.marginLeft='8px';b.onclick=setupFree;el.append(b)}
}
async function share(){const text=`🏒 LINE CHANGE${mode==='daily'?` · ${date}`:' · FREE PLAY'}\n${name(start)} → ${name(end)}\n${'🟩'.repeat(Math.min(route.length-1,12))}\n${route.length-1} links · Par ${optimal}${mode==='daily'?`\n🔥 ${$('streak').textContent} day streak`:''}\n${location.origin}`;try{if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);status('Result copied. Share it with your locker room.')}}catch(e){if(e.name!=='AbortError'){status('Copy your result below.');const box=document.createElement('textarea');box.value=text;box.rows=6;box.style.width='100%';$('result').append(box);box.focus();box.select()}}}
function daily(){if(!data)return;mode='daily';date=easternDate();$('daily').classList.add('active');$('free').classList.remove('active');$('setup').hidden=true;$('board').hidden=false;$('date').textContent=`DAILY · ${date}`;[start,end,optimal]=puzzleFor(data,date);const stored=read(key(),null);route=[start];finished=false;revealed=false;
 if(stored&&Array.isArray(stored.route)&&stored.route[0]===start&&stored.route.every((p,i)=>data.players[p]&&(!i||engine.evidence(stored.route[i-1],p).length))){route=stored.route;revealed=stored.revealed===true;finished=(stored.finished===true&&route.at(-1)===end);if(revealed&&!finished){route=[start];revealed=false}}
 $('player-search').value='';$('player-results').replaceChildren();render();showStreak();status(finished?'Today’s attempt is saved. Come back tomorrow for a new matchup.':'Build your chain. Search any NHL player to add a link.');}
function setupFree(){if(!data)return;mode='free';$('daily').classList.remove('active');$('free').classList.add('active');$('setup').hidden=false;$('board').hidden=true;$('date').textContent='FREE PLAY · YOUR MATCHUP';$('par').textContent='ANY TWO PLAYERS';selectedStart=selectedEnd=null;for(const id of ['start-search','end-search'])$(id).value='';for(const id of ['start-results','end-results'])$(id).replaceChildren();$('start-free').disabled=true;}
function autocomplete(inputId,resultId,callback){const input=$(inputId),container=$(resultId);let timer;input.addEventListener('input',()=>{clearTimeout(timer);if(inputId==='start-search')selectedStart=null;if(inputId==='end-search')selectedEnd=null;if(inputId!=='player-search')$('start-free').disabled=true;timer=setTimeout(()=>{container.replaceChildren();if(!engine)return;const matches=engine.search(input.value);if(!matches.length&&input.value.trim()){const p=document.createElement('p');p.textContent='No matching players.';container.append(p)}for(const p of matches){const button=document.createElement('button');button.type='button';button.textContent=p.name;const details=document.createElement('small');details.textContent=`${p.position} · ${String(p.first).slice(0,4)}–${String(p.last).slice(-4)} · #${p.id}`;button.append(details);button.onclick=()=>{container.replaceChildren();callback(p)};container.append(button)}},100)});input.addEventListener('keydown',e=>{if(e.key==='Escape')container.replaceChildren();if(e.key==='ArrowDown'){e.preventDefault();container.querySelector('button')?.focus()}});container.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...container.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}if(e.key==='Escape'){container.replaceChildren();input.focus()}})}
autocomplete('player-search','player-results',p=>add(p.id));
for(const side of ['start','end'])autocomplete(side+'-search',side+'-results',p=>{if(side==='start')selectedStart=p.id;else selectedEnd=p.id;$(side+'-search').value=p.name;$('start-free').disabled=!selectedStart||!selectedEnd||selectedStart===selectedEnd});
$('start-free').onclick=()=>{if(!selectedStart||!selectedEnd||selectedStart===selectedEnd)return;start=selectedStart;end=selectedEnd;const path=engine.shortest(start,end);if(!path)return;optimal=path.length-1;route=[start];finished=revealed=false;$('setup').hidden=true;$('board').hidden=false;render();status('Your matchup is ready. Make the first connection.')};
$('daily').onclick=daily;$('free').onclick=setupFree;$('connect').onclick=()=>add(end);$('undo').onclick=()=>{if(finished||route.length<2)return;route.pop();save();render();status('Last link removed.')};
$('give-up').onclick=()=>{if(!confirm('Reveal the shortest route? This ends your attempt and won’t earn a daily streak.'))return;route=engine.shortest(start,end);finished=revealed=true;save();render();status('Shortest route revealed, with team-season evidence.')};
$('help').onclick=()=>$('rules').showModal();$('close-help').onclick=()=>$('rules').close();
async function load(){try{const r=await fetch('data/hockey.json');if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();engine=createEngine(data);daily()}catch(e){status('The hockey data couldn’t load. Check your connection and try again.',true);const b=document.createElement('button');b.textContent='Retry';b.onclick=()=>{b.remove();load()};$('status').after(b)}}
load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mode==='daily'&&data&&date!==easternDate())daily()});
