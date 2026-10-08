import {createEngine,easternDate,puzzleFor,streakFor} from './core.js';
import {portrait,teamLogo,connectionSentence} from './presentation.js';
const $=id=>document.getElementById(id);
let data,engine,mode='daily',date=easternDate(),start,end,optimal,route=[],finished=false,revealed=false,selectedStart,selectedEnd,hintsUsed=0,hintedPlayers=new Set();
const allDecades=Array.from({length:12},(_,i)=>1910+i*10);
let selectedDecades=allDecades;
const key=()=>`line-change-v1:${data.version}:${date}:${puzzleFor(data,date).slice(0,2).join('-')}`;
function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{status('Your browser cannot save progress. You can still play.')}}
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error)}
const name=p=>data.players[p][0];
const season=s=>String(s).slice(0,4)+'–'+String(s).slice(-2);
function save(){if(mode==='daily')write(key(),{route,finished,revealed,hintsUsed,hintedPlayers:[...hintedPlayers]})}
function showStreak(){$('streak').textContent=streakFor(read('line-change-wins',{}),easternDate())}
function proof(a,b){const e=engine.evidence(a,b);return e.length?`${data.teams[e[0][0]]||e[0][0]} · ${season(e[0][1])}${e.length>1?` · +${e.length-1} other team-seasons`:''}`:''}
function render(){
 $('hint-text').hidden=true;$('hint-text').textContent='';
 $('start-name').textContent=name(start);$('end-name').textContent=name(end);
 for(const [side,p] of [['start',start],['end',end]]){let slot=$(side+'-portrait');if(!slot){slot=document.createElement('div');slot.id=side+'-portrait';$(side+'-name').before(slot)}slot.replaceChildren(portrait(p,name(p)))}$('par').textContent=`PAR ${optimal} LINKS`;
 $('chain').replaceChildren();route.forEach((p,i)=>{const li=document.createElement('li'),n=document.createElement('span'),body=document.createElement('div'),title=document.createElement('strong');n.className='number';n.textContent=i;title.textContent=name(p);body.append(title);if(i){const text=document.createElement('div');text.className='proof';text.textContent=proof(route[i-1],p);body.append(text)}else{const text=document.createElement('div');text.className='proof';text.textContent='Your starting line';body.append(text)}li.append(n,portrait(p,name(p)),body);$('chain').append(li)});
 $('entry').hidden=finished;$('actions').hidden=finished;$('undo').disabled=route.length<2;$('give-up').disabled=false;$('player-search').disabled=false;
 $('hint').textContent=`Team hint${hintsUsed?` (${hintsUsed} used)`:''}`;
 const canFinish=!!engine.evidence(route.at(-1),end).length;$('connect').disabled=!canFinish;$('result').hidden=!finished;
 if(finished)renderResult();else $('result').replaceChildren();
}
function add(p){
 if(finished)return;if(route.includes(p)){status('That player is already in your chain.',true);return}
 if(!engine.evidence(route.at(-1),p).length){status(`${name(route.at(-1))} and ${name(p)} don’t share an NHL team-season. Try another player.`,true);return}
 route.push(p);$('player-search').value='';$('player-results').replaceChildren();
 if(p===end){finished=true;if(mode==='daily'){const wins=read('line-change-wins',{});wins[date]=true;write('line-change-wins',wins);showStreak()}}
 save();render();status(finished?'Every link verified. Nice line change.':`Valid connection. ${proof(route.at(-2),p)}`);
}
function renderResult(){
 const el=$('result');el.replaceChildren();const heading=document.createElement('h2'),score=document.createElement('div'),desc=document.createElement('p');heading.textContent=revealed?'The shortest line.':route.length-1===optimal?'Top of the league.':'You’re connected.';score.className='score';score.textContent=`${route.length-1} LINKS · PAR ${optimal}`;desc.textContent=revealed?'Route revealed. This daily attempt won’t count toward your streak.':route.length-1===optimal?'You found a shortest possible route.':'A valid route. See if you can match par in free play.';el.append(heading,score,desc);const hintNote=document.createElement('p');hintNote.textContent=`${hintsUsed} team hint${hintsUsed===1?'':'s'} used`;el.append(hintNote);
 if(!revealed){const b=document.createElement('button');b.textContent='Share result';b.onclick=share;el.append(b)}
 if(mode==='free'){const b=document.createElement('button');b.className='secondary';b.textContent='Choose another matchup';b.style.marginLeft='8px';b.onclick=setupFree;el.append(b)}
 appendRouteExplanation(el);appendAllAnswers(el);
}
function appendRouteExplanation(parent){
 const section=document.createElement('section');section.className='route-explanation';
 const heading=document.createElement('h3');heading.textContent=revealed?'Revealed route evidence':'Your route, explained';section.append(heading);
 for(let i=0;i<route.length-1;i++){
  const [team,year]=engine.evidence(route[i],route[i+1])[0];
  const row=document.createElement('div');row.className='connection-explanation';
  const text=document.createElement('p');text.textContent=connectionSentence({fromName:name(route[i]),toName:name(route[i+1]),index:i,lastIndex:route.length-1,teamName:data.teams[team]||team,season:season(year)});
  row.append(teamLogo(team,data.teams[team]||team),text);section.append(row);
 }parent.append(section);
}
function appendAllAnswers(parent){
 const section=document.createElement('section');section.className='all-answers';
 const heading=document.createElement('h3');heading.textContent='All shortest answers';
 const summary=document.createElement('p');summary.textContent='Calculating every shortest route…';section.append(heading,summary);parent.append(section);
 const a=start,b=end,currentEngine=engine;
 // Let the completion message paint before calculating alternatives.
 setTimeout(()=>{
  if(!section.isConnected)return;
  const answers=currentEngine.allShortest(a,b),iterator=answers.routes();
  summary.textContent=`${answers.count.toLocaleString()} possible shortest ${answers.count===1n?'route':'routes'} · ${answers.distance} links. Longer detours are not listed. Team-season variants for the same player chain count as one answer.`;
  const list=document.createElement('ol');list.className='answer-list';
  const progress=document.createElement('p');progress.className='answer-progress';progress.setAttribute('aria-live','polite');
  const more=document.createElement('button');more.className='secondary';more.textContent='Show next 20 answers';
  let shown=0n;
  function batch(){for(let i=0;i<20;i++){const item=iterator.next();if(item.done)break;const li=document.createElement('li');li.textContent=item.value.map(p=>name(p)).join(' → ');list.append(li);shown++}progress.textContent=`Showing ${shown.toLocaleString()} of ${answers.count.toLocaleString()} routes`;more.hidden=shown>=answers.count;}
  more.onclick=batch;section.append(list,progress,more);batch();
 },0);
}
async function share(){const text=`🏒 LINE CHANGE${mode==='daily'?` · ${date}`:' · FREE PLAY'}\n${name(start)} → ${name(end)}\n${'🟩'.repeat(Math.min(route.length-1,12))}\n${route.length-1} links · Par ${optimal} · ${hintsUsed} hints${mode==='daily'?`\n🔥 ${$('streak').textContent} day streak`:''}\n${location.origin}`;try{if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);status('Result copied. Share it with your locker room.')}}catch(e){if(e.name!=='AbortError'){status('Copy your result below.');const box=document.createElement('textarea');box.value=text;box.rows=6;box.style.width='100%';$('result').append(box);box.focus();box.select()}}}
function daily(){if(!data)return;mode='daily';engine=createEngine(data);date=easternDate();$('daily').classList.add('active');$('free').classList.remove('active');$('setup').hidden=true;$('board').hidden=false;$('date').textContent=`DAILY · ${date}`;[start,end,optimal]=puzzleFor(data,date);const stored=read(key(),null);route=[start];finished=false;revealed=false;hintsUsed=0;hintedPlayers=new Set();
 if(stored&&Array.isArray(stored.route)&&stored.route[0]===start&&stored.route.every((p,i)=>data.players[p]&&(!i||engine.evidence(stored.route[i-1],p).length))){route=stored.route;hintsUsed=Number.isInteger(stored.hintsUsed)&&stored.hintsUsed>=0?stored.hintsUsed:0;hintedPlayers=new Set(stored.hintedPlayers||[]);revealed=stored.revealed===true;finished=(stored.finished===true&&route.at(-1)===end);if(revealed&&!finished){route=[start];revealed=false}}
 $('player-search').value='';$('player-results').replaceChildren();render();showStreak();status(finished?'Today’s attempt is saved. Come back tomorrow for a new matchup.':'Build your chain. Search any NHL player to add a link.');}
function setupFree(){if(!data)return;mode='free';selectedDecades=read('line-change-decades',allDecades);if(!Array.isArray(selectedDecades))selectedDecades=allDecades;selectedDecades=selectedDecades.filter(d=>allDecades.includes(d));engine=createEngine(data,selectedDecades);renderDecades();$('setup-status').textContent='';$('daily').classList.remove('active');$('free').classList.add('active');$('setup').hidden=false;$('board').hidden=true;$('date').textContent='FREE PLAY · YOUR MATCHUP';$('par').textContent='ANY TWO PLAYERS';selectedStart=selectedEnd=null;for(const id of ['start-search','end-search'])$(id).value='';for(const id of ['start-results','end-results'])$(id).replaceChildren();$('start-free').disabled=true;}
function autocomplete(inputId,resultId,callback){const input=$(inputId),container=$(resultId);let timer;input.addEventListener('input',()=>{clearTimeout(timer);if(inputId==='start-search')selectedStart=null;if(inputId==='end-search')selectedEnd=null;if(inputId!=='player-search')$('start-free').disabled=true;timer=setTimeout(()=>{container.replaceChildren();if(!engine)return;const matches=engine.search(input.value);if(!matches.length&&input.value.trim()){const p=document.createElement('p');p.textContent='No matching players.';container.append(p)}for(const p of matches){const button=document.createElement('button');button.type='button';button.textContent=p.name;const details=document.createElement('small');details.textContent=`${p.position} · ${String(p.first).slice(0,4)}–${String(p.last).slice(-4)} · #${p.id}`;button.append(details);button.onclick=()=>{container.replaceChildren();callback(p)};container.append(button)}},100)});input.addEventListener('keydown',e=>{if(e.key==='Escape')container.replaceChildren();if(e.key==='ArrowDown'){e.preventDefault();container.querySelector('button')?.focus()}});container.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...container.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}if(e.key==='Escape'){container.replaceChildren();input.focus()}})}
autocomplete('player-search','player-results',p=>add(p.id));
for(const side of ['start','end'])autocomplete(side+'-search',side+'-results',p=>{if(side==='start')selectedStart=p.id;else selectedEnd=p.id;$(side+'-search').value=p.name;$('start-free').disabled=!selectedStart||!selectedEnd||selectedStart===selectedEnd});
$('start-free').onclick=()=>{if(!selectedStart||!selectedEnd||selectedStart===selectedEnd)return;start=selectedStart;end=selectedEnd;const path=engine.shortest(start,end);if(!path){$('setup-status').textContent='No route exists in those decades. Add another decade or choose different players.';return}optimal=path.length-1;route=[start];finished=revealed=false;hintsUsed=0;hintedPlayers=new Set();$('setup').hidden=true;$('board').hidden=false;render();status('Your matchup is ready. Make the first connection.')};
$('daily').onclick=daily;$('free').onclick=setupFree;$('connect').onclick=()=>add(end);$('undo').onclick=()=>{if(finished||route.length<2)return;route.pop();save();render();status('Last link removed.')};
$('give-up').onclick=()=>{if(!confirm('Reveal the shortest route? This ends your attempt and won’t earn a daily streak.'))return;route=engine.shortest(start,end);finished=revealed=true;save();render();status('Shortest route revealed, with team-season evidence.')};
$('hint').onclick=()=>{if(finished)return;const current=route.at(-1),teams=engine.hintTeams(current,end);if(!teams.length)return;if(!hintedPlayers.has(current)){hintedPlayers.add(current);hintsUsed++}save();$('hint').textContent=`Team hint (${hintsUsed} used)`;$('hint-text').hidden=false;$('hint-text').textContent='Your next link on one shortest route shares: '+teams.map(t=>data.teams[t]||t).join(' or ')+'. Find a player who connects here.'};
function renderDecades(){const box=$('decades');box.replaceChildren();for(const decade of allDecades){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=decade;input.checked=selectedDecades.includes(decade);input.onchange=()=>{selectedDecades=[...box.querySelectorAll('input:checked')].map(x=>Number(x.value));changeDecades()};label.append(input,document.createTextNode(decade+'s'));box.append(label)}}
function changeDecades(){write('line-change-decades',selectedDecades);engine=createEngine(data,selectedDecades);selectedStart=selectedEnd=null;$('start-search').value=$('end-search').value='';$('start-results').replaceChildren();$('end-results').replaceChildren();$('start-free').disabled=true;$('setup-status').textContent=selectedDecades.length?'Choose your matchup using these decades.':'Select at least one decade.'}
$('all-decades').onclick=()=>{selectedDecades=[...allDecades];renderDecades();changeDecades()};$('modern-decades').onclick=()=>{selectedDecades=allDecades.filter(d=>d>=1990);renderDecades();changeDecades()};
$('help').onclick=()=>$('rules').showModal();$('close-help').onclick=()=>$('rules').close();
async function load(){try{const r=await fetch('data/hockey.json');if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();const schedule=await fetch('data/daily-puzzles.json');if(!schedule.ok)throw Error('Puzzle schedule unavailable');data.dailySchedule=await schedule.json();engine=createEngine(data);daily()}catch(e){status('The hockey data couldn’t load. Check your connection and try again.',true);const b=document.createElement('button');b.textContent='Retry';b.onclick=()=>{b.remove();load()};$('status').after(b)}}
load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mode==='daily'&&data&&date!==easternDate())daily()});
