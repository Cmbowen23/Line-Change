import {createEngine,easternDate,puzzleFor,streakFor} from './core.js';
import {allDecades,challengeURL,parseChallenge} from './challenges.js';
import {portrait,teamLogo,connectionSentence,playerHistory,seasonRanges,difficultyPool,routePosition} from './presentation.js';
import {rosterFor,canAddPlayer,appendConnection} from './explore.js';
const $=id=>document.getElementById(id);
let data,engine,mode='daily',date=easternDate(),start,end,optimal,route=[],finished=false,revealed=false,selectedStart,selectedEnd,hintsUsed=0,hintedPlayers=new Set();
let selectedDecades=allDecades;
let exploreEnabled=read('line-change-explore',true)!==false,exploreStack=[];
let gameStyle=read('line-change-style','shortest');if(!['shortest','longest'].includes(gameStyle))gameStyle='shortest';
const longest=()=>mode==='free'&&gameStyle==='longest';
let difficulty=read('line-change-difficulty','easy'),showHistory=read('line-change-team-history',false)===true;
if(!['easy','medium','hard'].includes(difficulty))difficulty='easy';
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
 for(const [side,p] of [['start',start],['end',end]]){let slot=$(side+'-portrait');if(!slot){slot=document.createElement('div');slot.id=side+'-portrait';$(side+'-name').before(slot)}slot.replaceChildren(portrait(p,name(p)))}$('par').textContent=`MINIMUM ${optimal} SHOTS`;$('free-controls').hidden=mode!=='free';$('era-summary').textContent=mode==='free'?'Allowed seasons: '+selectedDecades.map(d=>d+'s').join(', '):'';
 $('explore-current').hidden=mode!=='free'||!exploreEnabled;for(const id of ['roster-hint','player-hint'])$(id).hidden=mode!=='free'||!exploreEnabled;
 $('game-goal').textContent=longest()?`LONGEST CHAIN · ${route.length-1} ${route.length===2?'shot':'shots'}. Add as many unique players as you can, then connect to the destination.`:`${route.length-1} ${route.length===2?'shot':'shots'} taken · Reach the destination in as few shots as possible.`;renderRoute();
 $('entry').hidden=finished;$('actions').hidden=finished;$('undo').disabled=route.length<2;$('give-up').disabled=false;$('player-search').disabled=false;
 $('hint').textContent='Team hint';
 const canFinish=!!engine.evidence(route.at(-1),end).length;$('connect').disabled=!canFinish;$('result').hidden=!finished;
 renderHistory();if(finished)renderResult();else $('result').replaceChildren();
}
function add(p){
 if(finished)return;if(route.includes(p)){status('That player is already in your chain.',true);return}
 if(!engine.evidence(route.at(-1),p).length){status(`${name(route.at(-1))} and ${name(p)} don’t share an NHL team-season. Try another player.`,true);return}
 if(longest()&&p!==end&&!engine.shortest(p,end,route)){status('That player leaves no route to the destination without repeating a player. Try a different connection.',true);return}
 route=appendConnection(engine,route,p,end,longest());$('player-search').value='';$('player-results').replaceChildren();
 if(route.at(-1)===end){finished=true;if(mode==='daily'){const wins=read('line-change-wins',{});wins[date]=true;write('line-change-wins',wins);showStreak()}}
 save();render();status(finished?'Every link verified. Nice line change.':`Valid connection. ${proof(route.at(-2),p)}`);
}
function renderResult(){
 const el=$('result');el.replaceChildren();const heading=document.createElement('h2'),score=document.createElement('div'),desc=document.createElement('p');heading.textContent=revealed?'The shortest line.':longest()?'That’s a long line.':route.length-1===optimal?'Top of the league.':'You’re connected.';score.className='score';score.textContent=`${route.length-1} SHOTS · MINIMUM ${optimal}`;desc.textContent=revealed?'Shortest route revealed.':longest()?`You connected ${route.length} unique players. Try to beat ${route.length-1} shots in another game.`:route.length-1===optimal?'You used the fewest possible shots.':'A valid route. Try to reach the minimum shots in free play.';el.append(heading,score,desc);const hintNote=document.createElement('p');hintNote.textContent=`${hintsUsed} hint${hintsUsed===1?'':'s'} used`;el.append(hintNote);
 if(!revealed){const b=document.createElement('button');b.textContent='Share result';b.onclick=share;el.append(b)}
 if(mode==='free'){const b=document.createElement('button');b.className='secondary';b.textContent='Choose another matchup';b.style.marginLeft='8px';b.onclick=setupFree;el.append(b)}
 appendAllAnswers(el);
}
function renderRoute(){
 const chain=$('chain'),openTeams=new Set([...chain.querySelectorAll('.chain-teams[open]')].map(el=>Number(el.dataset.playerId)));chain.className='route-chain';chain.setAttribute('aria-label',revealed?'Revealed route':'Your player chain');chain.replaceChildren();
 for(let i=0;i<route.length;i++){
  const id=route[i],position=routePosition(i),player=document.createElement('li'),caption=document.createElement('span');player.className='route-player';player.dataset.playerId=id;player.style.gridRow=position.row;player.style.gridColumn=position.column;caption.textContent=name(id);if(mode==='free'&&exploreEnabled){const button=document.createElement('button');button.className='explore-player-button';button.type='button';button.setAttribute('aria-label','Explore '+name(id));button.append(portrait(id,name(id)),caption);button.onclick=()=>openExplorer({kind:'player',id});player.append(button)}else player.append(portrait(id,name(id)),caption);if(mode==='free'&&(exploreEnabled||showHistory)){const details=document.createElement('details');details.className='endpoint-teams chain-teams';details.dataset.playerId=id;details.open=openTeams.has(id);fillTeamDetails(details,id);player.append(details)}chain.append(player);
  if(i===route.length-1)continue;
  const next=routePosition(i+1),[team,year]=engine.evidence(id,route[i+1])[0],link=document.createElement('li');
  const vertical=next.row!==position.row;link.className='route-link '+(vertical?'route-down':next.column<position.column?'route-left':'route-right');
  link.style.gridRow=vertical?position.row+1:position.row;link.style.gridColumn=vertical?position.column:(position.column+next.column)/2;
  const sentence=connectionSentence({fromName:name(id),toName:name(route[i+1]),teamName:data.teams[team]||team,season:season(year)});link.setAttribute('aria-label',sentence);link.title=sentence;
  const line=document.createElement('span');line.className='route-line';line.setAttribute('aria-hidden','true');
  const logo=teamLogo(team,data.teams[team]||team);const label=document.createElement('span');label.className='route-season';label.textContent=season(year);label.setAttribute('aria-hidden','true');link.append(line,logo,label);chain.append(link);
 }
}
function appendAllAnswers(parent){
 const section=document.createElement('section');section.className='all-answers';
 const heading=document.createElement('h3');heading.textContent=longest()?'Shortest reference routes':'All shortest answers';
 const summary=document.createElement('p');summary.textContent='Calculating every shortest route…';section.append(heading,summary);parent.append(section);
 const a=start,b=end,currentEngine=engine;
 // Let the completion message paint before calculating alternatives.
 setTimeout(()=>{
  if(!section.isConnected)return;
  const answers=currentEngine.allShortest(a,b),iterator=answers.routes();
  summary.textContent=`${answers.count.toLocaleString()} possible shortest ${answers.count===1n?'route':'routes'} · ${answers.distance} shots. Longer detours are not listed. Team-season variants for the same player chain count as one answer.`;
  const list=document.createElement('ol');list.className='answer-list';
  const progress=document.createElement('p');progress.className='answer-progress';progress.setAttribute('aria-live','polite');
  const more=document.createElement('button');more.className='secondary';more.textContent='Show next 20 answers';
  let shown=0n;
  function batch(){for(let i=0;i<20;i++){const item=iterator.next();if(item.done)break;const li=document.createElement('li');li.textContent=item.value.map(p=>name(p)).join(' → ');list.append(li);shown++}progress.textContent=`Showing ${shown.toLocaleString()} of ${answers.count.toLocaleString()} routes`;more.hidden=shown>=answers.count;}
  more.onclick=batch;section.append(list,progress,more);batch();
 },0);
}
async function share(){const text=`🏒 LINE CHANGE${mode==='daily'?` · ${date}`:' · FREE PLAY'}\n${name(start)} → ${name(end)}\n${'🟩'.repeat(Math.min(route.length-1,12))}\n${route.length-1} shots · Minimum ${optimal}${longest()?' · Longest Chain':''} · ${hintsUsed} hints${mode==='daily'?`\n🔥 ${$('streak').textContent} day streak`:''}\n${mode==='free'?challengeURL(location.href,start,end,selectedDecades,gameStyle):location.origin}`;try{if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);status('Result copied. Share it with your locker room.')}}catch(e){if(e.name!=='AbortError'){status('Copy your result below.');const box=document.createElement('textarea');box.value=text;box.rows=6;box.style.width='100%';$('result').append(box);box.focus();box.select()}}}
function daily(){if(!data)return;closeExplorer();clearChallengeURL();mode='daily';engine=createEngine(data);date=easternDate();$('daily').classList.add('active');$('free').classList.remove('active');$('setup').hidden=true;$('board').hidden=false;$('date').textContent=`DAILY · ${date}`;[start,end,optimal]=puzzleFor(data,date);const stored=read(key(),null);route=[start];finished=false;revealed=false;hintsUsed=0;hintedPlayers=new Set();
 if(stored&&Array.isArray(stored.route)&&stored.route[0]===start&&stored.route.every((p,i)=>data.players[p]&&(!i||engine.evidence(stored.route[i-1],p).length))){route=stored.route;hintsUsed=Number.isInteger(stored.hintsUsed)&&stored.hintsUsed>=0?stored.hintsUsed:0;hintedPlayers=new Set(stored.hintedPlayers||[]);revealed=stored.revealed===true;finished=(stored.finished===true&&route.at(-1)===end);if(revealed&&!finished){route=[start];revealed=false}}
 $('player-search').value='';$('player-results').replaceChildren();render();showStreak();status(finished?'Today’s attempt is saved. Come back tomorrow for a new matchup.':'Build your chain. Search any NHL player to add a link.');}
function setupFree(){if(!data)return;closeExplorer();clearChallengeURL();mode='free';selectedDecades=read('line-change-decades',allDecades);if(!Array.isArray(selectedDecades))selectedDecades=allDecades;selectedDecades=selectedDecades.filter(d=>allDecades.includes(d));engine=createEngine(data,selectedDecades);renderDecades();$('explore-mode').checked=exploreEnabled;$('game-style').value=gameStyle;$('difficulty').value=difficulty;$('show-history').checked=showHistory;$('setup-status').textContent='';$('daily').classList.remove('active');$('free').classList.add('active');$('setup').hidden=false;$('board').hidden=true;$('date').textContent='FREE PLAY · YOUR MATCHUP';$('par').textContent='ANY TWO PLAYERS';selectedStart=selectedEnd=null;for(const id of ['start-search','end-search'])$(id).value='';for(const id of ['start-results','end-results'])$(id).replaceChildren();updateCustomButtons();$('random-free').disabled=!selectedDecades.length;}
function autocomplete(inputId,resultId,callback){const input=$(inputId),container=$(resultId);let timer;input.addEventListener('input',()=>{clearTimeout(timer);if(inputId==='start-search')selectedStart=null;if(inputId==='end-search')selectedEnd=null;if(inputId!=='player-search')updateCustomButtons();timer=setTimeout(()=>{container.replaceChildren();if(!engine)return;const matches=engine.search(input.value);if(!matches.length&&input.value.trim()){const p=document.createElement('p');p.textContent='No matching players.';container.append(p)}for(const p of matches){const button=document.createElement('button');button.type='button';button.textContent=p.name;const details=document.createElement('small');details.textContent=`${p.position} · ${String(p.first).slice(0,4)}–${String(p.last).slice(-4)} · #${p.id}`;button.append(details);button.onclick=()=>{container.replaceChildren();callback(p)};container.append(button)}},100)});input.addEventListener('keydown',e=>{if(e.key==='Escape')container.replaceChildren();if(e.key==='ArrowDown'){e.preventDefault();container.querySelector('button')?.focus()}});container.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...container.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}if(e.key==='Escape'){container.replaceChildren();input.focus()}})}
autocomplete('player-search','player-results',p=>add(p.id));
for(const side of ['start','end'])autocomplete(side+'-search',side+'-results',p=>{if(side==='start')selectedStart=p.id;else selectedEnd=p.id;$(side+'-search').value=p.name;updateCustomButtons()});
function clearChallengeURL(){const url=new URL(location.href);for(const k of ['start','end','decades','style'])url.searchParams.delete(k);history.replaceState(null,'',url);}
function updateCustomButtons(){const disabled=!selectedStart||!selectedEnd||selectedStart===selectedEnd;$('start-free').disabled=$('share-custom').disabled=disabled;$('challenge-link-box').hidden=true;}
function beginFree(a,b){
 closeExplorer();
 const path=engine.shortest(a,b);
 if(!path||path.length<2){$('setup-status').textContent='No route exists in those decades. Add another decade or choose different players.';return false}
 mode='free';start=a;end=b;optimal=path.length-1;route=[start];finished=revealed=false;hintsUsed=0;hintedPlayers=new Set();
 $('daily').classList.remove('active');$('free').classList.add('active');$('setup').hidden=true;$('board').hidden=false;$('date').textContent=longest()?'FREE PLAY · LONGEST CHAIN':'FREE PLAY · SHORTEST CHAIN';
 $('player-search').value='';$('player-results').replaceChildren();history.replaceState(null,'',challengeURL(location.href,start,end,selectedDecades,gameStyle));
 render();status(longest()?'Build the longest chain you can. Each player can appear once.':'Your matchup is ready. Make the first connection.');return true;
}
function randomFree(){
 const pair=engine.randomMatchup(Math.random,difficultyPool(data,difficulty));
 if(!pair){const message='No matchup requiring at least two shots is available at this difficulty in those decades. Add decades or increase the difficulty.';$('setup-status').textContent=message;status(message,true);return}
 beginFree(pair.start,pair.end);
}
async function copyChallenge(url,feedback){
 try{await navigator.clipboard.writeText(url);feedback.textContent='Matchup link copied. Anyone with the link can play these players and decades.';return true}
 catch{feedback.textContent='Copy the matchup link below.';return false}
}
$('start-free').onclick=()=>{if(selectedStart&&selectedEnd&&selectedStart!==selectedEnd)beginFree(selectedStart,selectedEnd)};
$('share-custom').onclick=()=>{
 if(!selectedStart||!selectedEnd||selectedStart===selectedEnd)return;
 if(!engine.shortest(selectedStart,selectedEnd)){$('setup-status').textContent='No route exists in those decades. Add another decade or choose different players.';return}
 $('challenge-link').value=challengeURL(location.href,selectedStart,selectedEnd,selectedDecades,gameStyle);$('challenge-link-box').hidden=false;$('challenge-feedback').textContent='Your matchup is ready to share.';
};
$('copy-challenge').onclick=()=>copyChallenge($('challenge-link').value,$('challenge-feedback'));
$('random-free').onclick=$('random-again').onclick=randomFree;
$('choose-matchup').onclick=setupFree;
$('share-matchup').onclick=async()=>{const url=challengeURL(location.href,start,end,selectedDecades,gameStyle);const copied=await copyChallenge(url,$('status'));if(!copied){const box=document.createElement('textarea');box.value=url;$('status').append(box);box.focus();box.select()}};
$('daily').onclick=daily;$('free').onclick=setupFree;$('connect').onclick=()=>add(end);$('undo').onclick=()=>{if(finished||route.length<2)return;route.pop();save();render();status('Last link removed.')};
$('give-up').onclick=()=>{if(!confirm('Reveal the shortest route? This ends your attempt and won’t earn a daily streak.'))return;route=engine.shortest(start,end);finished=revealed=true;save();render();status('Shortest route revealed, with team-season evidence.')};
$('hint').onclick=()=>{if(finished)return;const current=route.at(-1),path=engine.shortest(current,end,longest()?route.slice(0,-1):[]),teams=path?.length>1?[...new Set(engine.evidence(current,path[1]).map(g=>g[0]))]:[];if(!teams.length)return;if(!hintedPlayers.has(current)){hintedPlayers.add(current);hintsUsed++}save();$('hint').textContent='Team hint';$('hint-text').hidden=false;$('hint-text').textContent='Your next link on one shortest route shares: '+teams.map(t=>data.teams[t]||t).join(' or ')+'. Find a player who connects here.'};
function renderDecades(){const box=$('decades');box.replaceChildren();for(const decade of allDecades){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=decade;input.checked=selectedDecades.includes(decade);input.onchange=()=>{selectedDecades=[...box.querySelectorAll('input:checked')].map(x=>Number(x.value));changeDecades()};label.append(input,document.createTextNode(decade+'s'));box.append(label)}}
function changeDecades(){write('line-change-decades',selectedDecades);engine=createEngine(data,selectedDecades);selectedStart=selectedEnd=null;$('start-search').value=$('end-search').value='';$('start-results').replaceChildren();$('end-results').replaceChildren();updateCustomButtons();$('random-free').disabled=!selectedDecades.length;$('setup-status').textContent=selectedDecades.length?'Choose your matchup using these decades.':'Select at least one decade.'}
$('all-decades').onclick=()=>{selectedDecades=[...allDecades];renderDecades();changeDecades()};$('modern-decades').onclick=()=>{selectedDecades=allDecades.filter(d=>d>=1990);renderDecades();changeDecades()};
function renderHistory(){
 $('toggle-history').textContent=showHistory?'Hide player teams':'Show player teams';
 for(const [side,id] of [['start',start],['end',end]]){
  let details=$(side+'-teams');if(!details){details=document.createElement('details');details.id=side+'-teams';details.className='endpoint-teams';$(side+'-name').after(details)}
  const open=details.open;details.replaceChildren();details.hidden=mode!=='free'||!showHistory;details.open=open;if(details.hidden)continue;
  fillTeamDetails(details,id);
 }
}
function fillTeamDetails(details,id){
  const summary=document.createElement('summary');summary.textContent='Teams & seasons';details.append(summary);
  for(const record of playerHistory(data,id,selectedDecades)){
   const row=document.createElement('div');row.className='endpoint-team';const team=document.createElement(record.allowed.length?'strong':'span');team.textContent=data.teams[record.team]||record.team;row.append(team);
   const allowed=document.createElement('div');allowed.className='endpoint-years';if(exploreEnabled){for(const year of record.allowed){const button=document.createElement('button');button.type='button';button.className='season-link';button.textContent=season(year);button.setAttribute('aria-label',`Explore ${data.teams[record.team]||record.team} ${season(year)} roster`);button.onclick=()=>openExplorer({kind:'roster',team:record.team,year,query:''});allowed.append(button)}}else{const text=document.createElement('strong');text.textContent=seasonRanges(record.allowed);allowed.append(text)}if(record.allowed.length)row.append(allowed);
   const outside=record.seasons.filter(s=>!record.allowed.includes(s));if(outside.length){const rest=document.createElement('span');rest.className='endpoint-years outside-years';rest.textContent=seasonRanges(outside);row.append(rest)}details.append(row);
  }
  const note=document.createElement('small');note.textContent=exploreEnabled?'Tap a bold season to explore its roster.':'Bold teams and seasons count in this game.';details.append(note);
}
function closeExplorer(){if($('explorer').open)$('explorer').close();exploreStack=[];}
function openExplorer(view){if(mode!=='free')return;exploreStack=[view];renderExplorer();if(!$('explorer').open)$('explorer').showModal();}
function visitExplorer(view){exploreStack.push(view);renderExplorer();}
function renderExplorer(){
 const view=exploreStack.at(-1);if(!view)return;
 $('explore-back').disabled=exploreStack.length<2;$('explore-content').replaceChildren();$('roster-search-box').hidden=view.kind!=='roster';
 const content=$('explore-content');
 if(view.kind==='roster'){
  $('explore-title').textContent=`${data.teams[view.team]||view.team} · ${season(view.year)}`;$('roster-search').value=view.query||'';
  const note=document.createElement('p');note.className='explore-note';note.textContent='Tap a player to browse their career. Browsing takes no shots.';content.append(note);renderRoster();
 }else{
  $('explore-title').textContent=name(view.id);const profile=document.createElement('div');profile.className='explore-profile';profile.append(portrait(view.id,name(view.id)));
  const eligibility=canAddPlayer(engine,route,end,view.id,{finished,longest:longest()}),button=document.createElement('button');button.textContent=eligibility.allowed?(view.id===end?'Connect to destination':'Add to chain') :eligibility.reason;button.disabled=!eligibility.allowed;
  button.onclick=()=>{const before=route.length;add(view.id);if(route.length>before){closeExplorer();requestAnimationFrame(()=>{const player=$('chain').querySelector(`[data-player-id="${view.id}"]`);player?.querySelector('summary')?.focus();player?.scrollIntoView({behavior:'smooth',block:'center'})})}else renderExplorer()};profile.append(button);content.append(profile);
  const note=document.createElement('p');note.className='explore-note';note.textContent=eligibility.allowed?(!longest()&&view.id!==end&&engine.evidence(view.id,end).length?`This player connects to ${name(route.at(-1))} and ${name(end)}. Add them to finish automatically; both connections count as shots.`:`This player connects to ${name(route.at(-1))}. Adding them takes one shot.`):'You can keep exploring this career without adding a player.';content.append(note);
  for(const record of playerHistory(data,view.id,selectedDecades)){
   const row=document.createElement('div');row.className='explore-career-team';const title=document.createElement('strong');title.textContent=data.teams[record.team]||record.team;row.append(teamLogo(record.team,title.textContent),title);content.append(row);
   const seasons=document.createElement('div');seasons.className='explore-seasons';for(const year of record.seasons){const allowed=record.allowed.includes(year),link=document.createElement(allowed?'button':'span');link.textContent=season(year);if(allowed){link.type='button';link.className='season-link';link.setAttribute('aria-label',`Explore ${title.textContent} ${season(year)} roster`);link.onclick=()=>visitExplorer({kind:'roster',team:record.team,year,query:''})}else link.className='outside-years';seasons.append(link)}content.append(seasons);
  }
 }
}
function renderRoster(){
 const view=exploreStack.at(-1);if(view?.kind!=='roster')return;let list=$('explore-roster');if(!list){list=document.createElement('div');list.id='explore-roster';$('explore-content').append(list)}list.replaceChildren();
 const needle=(view.query||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const ids=rosterFor(data,view.team,view.year,selectedDecades).filter(id=>name(id).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle));
 const count=document.createElement('p');count.className='explore-note';count.setAttribute('role','status');count.textContent=ids.length?`${ids.length} ${ids.length===1?'player':'players'}`:'No players match this search.';list.append(count);
 for(const id of ids){const button=document.createElement('button');button.className='roster-player';button.type='button';const body=document.createElement('span'),title=document.createElement('strong'),label=document.createElement('small');title.textContent=name(id);label.textContent=route.includes(id)?'Already used':data.players[id][1]+(id===end?' · Destination':'');body.append(title,label);button.append(portrait(id,name(id)),body);button.onclick=()=>visitExplorer({kind:'player',id});list.append(button)}
}
$('explore-mode').onchange=()=>{exploreEnabled=$('explore-mode').checked;write('line-change-explore',exploreEnabled)};
$('explore-current').onclick=()=>openExplorer({kind:'player',id:route.at(-1)});
$('close-explorer').onclick=closeExplorer;
$('explore-back').onclick=()=>{if(exploreStack.length>1){exploreStack.pop();renderExplorer()}};
$('explorer').addEventListener('close',()=>{exploreStack=[]});
$('roster-search').oninput=()=>{const view=exploreStack.at(-1);if(view?.kind==='roster'){view.query=$('roster-search').value;renderRoster()}};
function nextHint(){return engine.shortest(route.at(-1),end,longest()?route.slice(0,-1):[])}
function countExploreHint(type){const key=type+':'+route.at(-1);if(!hintedPlayers.has(key)){hintedPlayers.add(key);hintsUsed++}}
$('roster-hint').onclick=()=>{const path=nextHint();if(!path||path.length<2)return;const [team,year]=engine.evidence(path[0],path[1])[0];countExploreHint('roster');openExplorer({kind:'roster',team,year,query:''})};
$('player-hint').onclick=()=>{const path=nextHint();if(!path||path.length<2)return;countExploreHint('player');openExplorer({kind:'player',id:path[1]})};
$('game-style').onchange=()=>{gameStyle=$('game-style').value;write('line-change-style',gameStyle)};
$('difficulty').onchange=()=>{difficulty=$('difficulty').value;write('line-change-difficulty',difficulty)};
$('show-history').onchange=()=>{showHistory=$('show-history').checked;write('line-change-team-history',showHistory)};
$('toggle-history').onclick=()=>{showHistory=!showHistory;write('line-change-team-history',showHistory);renderHistory()};
$('help').onclick=()=>$('rules').showModal();$('close-help').onclick=()=>$('rules').close();
async function load(){try{const r=await fetch('data/hockey.json');if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();const schedule=await fetch('data/daily-puzzles.json');if(!schedule.ok)throw Error('Puzzle schedule unavailable');data.dailySchedule=await schedule.json();const depth=await fetch('data/player-depth.json');if(!depth.ok)throw Error('Player difficulty data unavailable');data.playerDepth=await depth.json();engine=createEngine(data);const shared=parseChallenge(location.href,data);if(shared){gameStyle=shared.style||'shortest';selectedDecades=shared.decades;engine=createEngine(data,selectedDecades);if(!beginFree(shared.start,shared.end)){setupFree();$('setup-status').textContent='No route exists for this shared matchup. Choose new players or decades.'}showStreak()}else daily()}catch(e){if(data?.playerDepth){setupFree();$('setup-status').textContent=e.message;return}status('The hockey data couldn’t load. Check your connection and try again.',true);const b=document.createElement('button');b.textContent='Retry';b.onclick=()=>{b.remove();load()};$('status').after(b)}}
load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mode==='daily'&&data&&date!==easternDate())daily()});
