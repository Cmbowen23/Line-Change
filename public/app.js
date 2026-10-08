import {createEngine,easternDate,puzzleFor,streakFor} from './core.js';
import {allDecades,challengeURL,parseChallenge} from './challenges.js';
import {portrait,teamLogo,connectionSentence,playerHistory,seasonRanges,difficultyPool,routePosition} from './presentation.js';
import {rosterFor,canAddPlayer,appendConnection} from './explore.js';
import {snakeStyles,positions,styleNames,positionNames,snakeRules,matchesPosition,snakeScore,playersFromEras,minimumShots,shortestShots,shotLabel} from './modes.js';
import {createSnake} from './snake.js';
const $=id=>document.getElementById(id);
let data,engine,mode='daily',date=easternDate(),start,end,optimal,route=[],routeLinks=[],finished=false,revealed=false,selectedStart,selectedEnd,hintsUsed=0,hintedPlayers=new Set();
let selectedDecades=allDecades;
let exploreEnabled=read('line-change-explore',true)!==false,dailyExploreEnabled=read('line-change-daily-explore',true)!==false,exploreStack=[];
const canExplore=()=>mode==='daily'?dailyExploreEnabled:exploreEnabled;
const activeDecades=()=>mode==='daily'||gameStyle==='shortest'?allDecades:selectedDecades;
let gameStyle=read('line-change-style','shortest');if(gameStyle==='longest')gameStyle='open';if(!['shortest',...snakeStyles].includes(gameStyle))gameStyle='shortest';
let position=read('line-change-position','random');if(!['random',...positions].includes(position))position='random';
let gamePosition='any',snake=null,lost=false,solving=false,revision=0,worker=null,workerId=0;const workerRequests=new Map();
const longest=()=>mode==='free'&&snakeStyles.includes(gameStyle);
const gameURL=()=>challengeURL(location.href,start,end,selectedDecades,gameStyle,gamePosition);
const snakeContext=()=>snake.context(start,end,route,routeLinks);
function eligibility(id,connection=null){if(finished||solving)return {allowed:false,reason:solving?'Finding a route…':'Game complete'};if(longest())return snake.canAdd(snakeContext(),id,connection);if(id!==end&&!matchesPosition(data.players[id],gamePosition))return {allowed:false,reason:'This challenge requires '+positionNames[gamePosition]};return canAddPlayer(engine,route,end,id,{finished,connection})}
function solve(type,request){if(!worker){worker=new Worker(new URL('./solver-worker.js',import.meta.url),{type:'module'});worker.postMessage({type:'init',data});worker.onmessage=e=>{const pending=workerRequests.get(e.data.id);if(!pending)return;workerRequests.delete(e.data.id);if(e.data.error)pending.reject(Error(e.data.error));else pending.resolve(e.data.result)};worker.onerror=()=>{for(const pending of workerRequests.values())pending.reject(Error('The route search could not finish. Please try again.'));workerRequests.clear();worker.terminate();worker=null}}const id=++workerId;return new Promise((resolve,reject)=>{workerRequests.set(id,{resolve,reject});worker.postMessage({id,type,...request})})}
function renderSettings(){$('era-title').textContent=gameStyle==='shortest'?'Which player eras?':'Which connection decades?';$('era-description').textContent=gameStyle==='shortest'?'Choose the eras for your starting and destination players. Connections, player search during play, and roster exploration can use every NHL season.':'Only connections from seasons starting in your selected decades count. Choose one or combine several.';$('snake-description').hidden=!snakeStyles.includes(gameStyle);$('snake-description').textContent=snakeRules[gameStyle]||'';$('position-settings').hidden=gameStyle!=='shortest';$('random-description').textContent=gameStyle==='career'?'Random games pair an earlier rookie season with a later final recorded season, with a verified route between them.':snakeStyles.includes(gameStyle)?'Random games favor players with many connections. Each generated matchup has a verified finish.':'Each new game chooses a minimum of 2, 3, or 4 shots under its position rule. Unavailable lengths are skipped.'}
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
function proof(a,b){const e=longest()?[routeLinks.at(-1)]:engine.evidence(a,b);return e.length?`${data.teams[e[0][0]]||e[0][0]} · ${season(e[0][1])}${e.length>1?` · +${e.length-1} other team-seasons`:''}`:''}
function render(){
 $('hint-text').hidden=true;$('hint-text').textContent='';
 $('par').textContent=longest()?(gameStyle==='career'?'SEASONS CROSSED':gameStyle==='road'?'TEAMS VISITED':'MOST SHOTS'):`MINIMUM ${shotLabel(optimal).toUpperCase()}`;$('free-controls').hidden=mode!=='free';$('era-summary').textContent=mode==='free'?(longest()?'Allowed seasons: ':'Matchup player eras: ')+selectedDecades.map(d=>d+'s').join(', ')+(longest()?'':' · All seasons allowed for connections.'):'All NHL seasons count';
 $('daily-controls').hidden=mode!=='daily';$('daily-explore-mode').checked=dailyExploreEnabled;$('explore-daily-current').hidden=!dailyExploreEnabled;
 $('explore-current').hidden=!canExplore();for(const id of ['roster-hint','player-hint'])$(id).hidden=!canExplore();
 const score=longest()?snakeScore(gameStyle,routeLinks):null;
 $('game-goal').textContent=longest()?`${score.value} ${score.value===1?score.unit.slice(0,-1):score.unit}${gameStyle==='career'?` · ${score.span}-year span`:''} so far`:`${shotLabel(shortestShots(route,end))} taken`;renderRoundRules();renderRoute();
 $('restart-game').hidden=mode!=='free';$('entry').hidden=finished;$('actions').hidden=finished;$('undo').hidden=longest()&&['open','career'].includes(gameStyle);$('undo').disabled=solving||route.length<2;$('give-up').disabled=solving;$('give-up').textContent=solving?'Finding a route…':longest()?'Reveal longest route':'Reveal shortest route';$('player-search').disabled=solving;
 $('hint').textContent='Team hint';
 const canFinish=eligibility(end).allowed;$('connect').disabled=!canFinish;$('result').hidden=!finished;
 if(finished)renderResult();else $('result').replaceChildren();
}
function renderRoundRules(){
 let title,target,rules;
 if(longest()){
  title=styleNames[gameStyle];target=gameStyle==='career'?'CROSS THE YEARS':gameStyle==='road'?'VISIT THE MOST TEAMS':'BUILD THE LONGEST CHAIN';
  if(gameStyle==='career'){const bounds=snakeContext().bounds;rules=[`First shot: ${name(start)}’s rookie season, ${season(bounds.first)}.`,`Move to a later season every shot. Finish with ${name(end)} in ${season(bounds.last)}.`,'Use each player once. A dead end ends the round—restart to try again. No undo.']}
  else if(gameStyle==='open')rules=['Change teams every shot. Years may move in either direction.','Each team: two uses total, in different seasons. Each season: three uses total.','No repeated players or team-seasons. A dead end ends the round—restart to try again. No undo.'];
  else rules=['Use each player and each team once, including across different seasons.','Years may move in either direction. Visit as many teams as possible before reaching the destination.'];
 }else{
  title={any:'Shortest chain',defense:'Defensemen only',goalie:'Goalies only',forward:'Forwards only'}[gamePosition];target=`MINIMUM ${shotLabel(optimal).toUpperCase()}`;
  const positionRule={any:'Use any NHL player to connect your endpoints.',defense:'Only defensemen between the endpoints. Starting and destination players are unrestricted.',goalie:'Only goalies between the endpoints. Starting and destination players are unrestricted.',forward:'Only forwards between the endpoints. Starting and destination players are unrestricted.'}[gamePosition];
  rules=[positionRule,'Connections can use any NHL season. Each player you add takes one shot; the automatic link to the destination takes no extra shot. Reach the destination in as few shots as possible; players cannot repeat.'];
 }
 $('round-rules-title').textContent=title;$('round-target').textContent=target;
 const list=$('round-rule-list');list.replaceChildren();for(const rule of rules){const item=document.createElement('li');item.textContent=rule;list.append(item)}
}
function add(p,connection=null){
 const verdict=eligibility(p,connection);
 if(!verdict.allowed){if(!finished)status(verdict.reason+'.',true);return}
 if(longest())routeLinks.push(verdict.evidence.slice(0,2));
 route=appendConnection(engine,route,p,end,longest());$('player-search').value='';$('player-results').replaceChildren();
 for(const details of $('chain').querySelectorAll('.chain-teams[open]'))details.open=false;
 if(route.at(-1)===end){finished=true;if(mode==='daily'){const wins=read('line-change-wins',{});wins[date]=true;write('line-change-wins',wins);showStreak()}}
 if(!finished&&longest()&&gameStyle==='career'&&!snake.finish(snakeContext()).path){finished=true;lost=true}
 save();render();status(lost?'No chronological finish remains. Your run is over—restart to try another route.':finished?'Every link verified. Nice line change.':`Valid connection. ${proof(route.at(-2),p)}`);
 if(finished){closeExplorer();showCompletion()}else if(longest()&&gameStyle==='open')void checkOpenRun();
}
async function checkOpenRun(){
 const generation=revision;let failed=false;solving=true;render();status('Checking whether a legal finish remains…');
 try{const result=await solve('finish',{decades:selectedDecades,style:gameStyle,start,end,route:[...route],links:[...routeLinks]});if(generation!==revision)return;if(!result.path&&result.exhausted){finished=lost=true;closeExplorer()}}
 catch(error){failed=true;if(generation===revision)status(error.message,true)}
 finally{if(generation===revision){solving=false;save();render();if(lost){status('No legal finish remains. Your round is over—restart to try another route.');showCompletion()}else if(!finished&&!failed)status('Valid connection. Keep building your chain.')}}
}
function maybeShowIntro(){
 const firstGame=!read('line-change-rules-seen-v1',false),firstLongest=longest()&&!read('line-change-snake-rules-seen-v2:'+gameStyle,false);
 if(!firstGame&&!firstLongest)return;
 $('intro-basics').hidden=!firstGame;$('intro-longest').hidden=!longest();$('intro-snake-name').textContent=styleNames[gameStyle]||'Snake';$('intro-snake-rules').textContent=snakeRules[gameStyle]||'';
 $('intro-title').textContent=firstGame?'Make the connection.':'Build a longer line.';
 $('intro-start').textContent=finished?'View your game':'Let’s play';
 $('intro-rules').showModal();
}
function acknowledgeIntro(){
 write('line-change-rules-seen-v1',true);
 if(!$('intro-longest').hidden)write('line-change-snake-rules-seen-v2:'+gameStyle,true);
}
function closeCompletion(){if($('completion').open)$('completion').close()}
function showCompletion(){
 const shots=longest()?route.length-1:shortestShots(route,end),score=longest()?snakeScore(gameStyle,routeLinks):null;
 $('completion-title').textContent=lost?'Run over.':'You’re connected!';
 $('completion-shots').textContent=longest()?`${score.value} ${score.value===1&&score.unit==='shots'?'shot':score.unit}`:`${shots} ${shots===1?'shot':'shots'}`;
 $('completion-minimum').textContent=longest()?(gameStyle==='career'?`${score.span}-year span · ${shots} shots`:`${route.length} unique players`):`Minimum possible: ${shotLabel(optimal)}`;
 $('completion-message').textContent=lost?'No legal route to the destination remains. Restart this matchup to try a new line.':longest()?'Every link follows your Snake rules.':shots===optimal?'You found a shortest possible route.':'Every connection verified. You reached the destination!';
 $('completion-restart').hidden=!longest();$('completion-share').hidden=lost;$('completion').showModal();
}
function renderResult(){
 const el=$('result');el.replaceChildren();const heading=document.createElement('h2'),score=document.createElement('div'),desc=document.createElement('p'),snakeResult=longest()?snakeScore(gameStyle,routeLinks):null;
 heading.textContent=lost?'Run over.':revealed?(longest()?'A longer line.':'The shortest line.'):longest()?'That’s a long line.':shortestShots(route,end)===optimal?'Top of the league.':'You’re connected.';
 score.className='score';score.textContent=longest()?`${snakeResult.value} ${snakeResult.unit.toUpperCase()}${gameStyle==='career'?` · ${snakeResult.span}-YEAR SPAN`:''}`:`${shotLabel(shortestShots(route,end)).toUpperCase()} · MINIMUM ${optimal}`;
 desc.textContent=lost?'No finish remains. Restart to try a different chain.':revealed?longest()?'A long valid route revealed.':'Shortest route revealed.':longest()?`You connected ${route.length} unique players.`:shortestShots(route,end)===optimal?'You used the fewest possible shots.':'A valid route. Try to reach the minimum shots in free play.';el.append(heading,score,desc);
 const hintNote=document.createElement('p');hintNote.textContent=`${hintsUsed} hint${hintsUsed===1?'':'s'} used`;el.append(hintNote);
 if(!revealed&&!lost){const b=document.createElement('button');b.textContent='Share result';b.onclick=share;el.append(b)}
 if(mode==='free'){const b=document.createElement('button');b.className='secondary';b.textContent='Choose another matchup';b.style.marginLeft='8px';b.onclick=setupFree;el.append(b)}
 if(!lost)appendAllAnswers(el);
}
function renderRoute(){
 const chain=$('chain'),openTeams=new Set([...chain.querySelectorAll('.chain-teams[open]')].map(el=>Number(el.dataset.playerId)));
 const pending=route.at(-1)!==end,players=pending?[...route,end]:route;
 const positionFor=i=>players.length===2?{row:1,column:i*2+1}:routePosition(i);
 chain.className='route-chain'+(players.length===2?' route-pair':'');chain.setAttribute('aria-label',revealed?'Revealed route':'Your player chain');chain.replaceChildren();
 for(let i=0;i<players.length;i++){
  const id=players[i],position=positionFor(i),player=document.createElement('li'),caption=document.createElement('span'),role=document.createElement('span');
  player.className='route-player';player.dataset.playerId=id;player.style.gridRow=position.row;player.style.gridColumn=position.column;caption.className='route-name';caption.textContent=name(id);
  role.className='route-role';role.textContent=i===0?'START WITH':id===end?'GET TO':i===route.length-1?'CURRENT PLAYER':'CONNECTION';player.append(role);
  if(canExplore()){const button=document.createElement('button');button.className='explore-player-button';button.type='button';button.setAttribute('aria-label','Explore '+name(id));button.append(portrait(id,name(id)),caption);button.onclick=()=>openExplorer({kind:'player',id});player.append(button)}else player.append(portrait(id,name(id)),caption);
  if(canExplore()||(mode==='free'&&showHistory)){const details=document.createElement('details');details.className='endpoint-teams chain-teams';details.dataset.playerId=id;details.open=openTeams.has(id);const summary=document.createElement('summary');summary.textContent='Teams & seasons';details.append(summary);const loadHistory=()=>{if(details.open&&details.dataset.loaded!=='true'){fillTeamDetails(details,id);details.dataset.loaded='true'}};details.addEventListener('toggle',loadHistory);loadHistory();player.append(details)}chain.append(player);
  if(i===players.length-1)continue;
  const next=positionFor(i+1),unconnected=pending&&i===route.length-1,link=document.createElement('li');
  const vertical=next.row!==position.row;link.className='route-link '+(vertical?'route-down':next.column<position.column?'route-left':'route-right')+(unconnected?' route-pending':'');
  link.style.gridRow=vertical?position.row+1:position.row;link.style.gridColumn=vertical?position.column:(position.column+next.column)/2;
  const line=document.createElement('span');line.className='route-line';line.setAttribute('aria-hidden','true');link.append(line);
  if(unconnected){link.setAttribute('aria-label','Destination not yet reached. Keep adding connections.');link.title='Keep adding connections to reach '+name(end)}else{
   const [team,year]=longest()?routeLinks[i]:engine.evidence(id,players[i+1])[0];
   const sentence=connectionSentence({fromName:name(id),toName:name(players[i+1]),teamName:data.teams[team]||team,season:season(year)});link.setAttribute('aria-label',sentence);link.title=sentence;
   const logo=teamLogo(team,data.teams[team]||team),label=document.createElement('span');label.className='route-season';label.textContent=season(year);label.setAttribute('aria-hidden','true');link.append(logo,label);
  }
  chain.append(link);
 }
}
function appendAllAnswers(parent){
 if(longest()){
  const section=document.createElement('section'),heading=document.createElement('h3'),note=document.createElement('p');section.className='all-answers';heading.textContent='Longest route found';note.textContent='Finding a longer valid route…';section.append(heading,note);parent.append(section);
  const generation=revision,seedPath=route.at(-1)===end?{players:[...route],links:[...routeLinks]}:null;
  solve('longest',{decades:selectedDecades,style:gameStyle,start,end,route:[start],links:[],seedPath}).then(answer=>{
   if(!section.isConnected||generation!==revision)return;
   heading.textContent=answer.proven?'Longest possible route':'Longest route found';
   note.className='long-answer';note.textContent=answer.path?`${answer.path.links.length} shots · ${answer.path.players.map(name).join(' → ')}${answer.proven?'':'. A longer route may still exist.'}`:'No valid route found.';
  }).catch(error=>{if(section.isConnected)note.textContent=error.message});return;
 }
 const section=document.createElement('section');section.className='all-answers';
 const heading=document.createElement('h3');heading.textContent='All shortest answers';
 const summary=document.createElement('p');summary.textContent='Calculating every shortest route…';section.append(heading,summary);parent.append(section);
 const a=start,b=end,currentEngine=engine;
 // Let the completion message paint before calculating alternatives.
 setTimeout(()=>{
  if(!section.isConnected)return;
  const answers=currentEngine.allShortest(a,b),iterator=answers.routes();
  summary.textContent=`${answers.count.toLocaleString()} possible shortest ${answers.count===1n?'route':'routes'} · ${shotLabel(minimumShots(answers.distance))}. Longer detours are not listed. Team-season variants for the same player chain count as one answer.`;
  const list=document.createElement('ol');list.className='answer-list';
  const progress=document.createElement('p');progress.className='answer-progress';progress.setAttribute('aria-live','polite');
  const more=document.createElement('button');more.className='secondary';more.textContent='Show next 20 answers';
  let shown=0n;
  function batch(){for(let i=0;i<20;i++){const item=iterator.next();if(item.done)break;const li=document.createElement('li');li.textContent=item.value.map(p=>name(p)).join(' → ');list.append(li);shown++}progress.textContent=`Showing ${shown.toLocaleString()} of ${answers.count.toLocaleString()} routes`;more.hidden=shown>=answers.count;}
  more.onclick=batch;section.append(list,progress,more);batch();
 },0);
}
async function share(){const text=`🏒 LINE CHANGE${mode==='daily'?` · ${date}`:' · FREE PLAY'}\n${name(start)} → ${name(end)}\n${'🟩'.repeat(Math.min(longest()?route.length-1:shortestShots(route,end),12))}\n${longest()?snakeScore(gameStyle,routeLinks).value+' '+snakeScore(gameStyle,routeLinks).unit:shotLabel(shortestShots(route,end))+' · Minimum '+optimal}${longest()?' · '+styleNames[gameStyle]:gamePosition!=='any'?' · '+positionNames[gamePosition]:''} · ${hintsUsed} hints${mode==='daily'?`\n🔥 ${$('streak').textContent} day streak`:''}\n${mode==='free'?gameURL():location.origin}`;try{if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);status('Result copied. Share it with your locker room.')}}catch(e){if(e.name!=='AbortError'){status('Copy your result below.');const box=document.createElement('textarea');box.value=text;box.rows=6;box.style.width='100%';$('result').append(box);box.focus();box.select()}}}
function daily(){if(!data)return;revision++;snake=null;gamePosition='any';lost=solving=false;closeExplorer();closeCompletion();clearChallengeURL();mode='daily';engine=createEngine(data);date=easternDate();$('daily').classList.add('active');$('free').classList.remove('active');$('setup').hidden=true;$('board').hidden=false;$('date').textContent=`DAILY · ${date}`;[start,end,optimal]=puzzleFor(data,date);optimal=minimumShots(optimal);const stored=read(key(),null);route=[start];routeLinks=[];finished=false;revealed=false;hintsUsed=0;hintedPlayers=new Set();
 if(stored&&Array.isArray(stored.route)&&stored.route[0]===start&&stored.route.every((p,i)=>data.players[p]&&(!i||engine.evidence(stored.route[i-1],p).length))){route=stored.route;hintsUsed=Number.isInteger(stored.hintsUsed)&&stored.hintsUsed>=0?stored.hintsUsed:0;hintedPlayers=new Set(stored.hintedPlayers||[]);revealed=stored.revealed===true;finished=(stored.finished===true&&route.at(-1)===end);if(revealed&&!finished){route=[start];revealed=false}}
 $('player-search').value='';$('player-results').replaceChildren();render();showStreak();status(finished?'Today’s attempt is saved. Come back tomorrow for a new matchup.':'Build your chain. Search any NHL player to add a link.');maybeShowIntro();}
function setupFree(){if(!data)return;revision++;solving=false;closeExplorer();closeCompletion();clearChallengeURL();mode='free';selectedDecades=read('line-change-decades',allDecades);if(!Array.isArray(selectedDecades))selectedDecades=allDecades;selectedDecades=selectedDecades.filter(d=>allDecades.includes(d));engine=createEngine(data,selectedDecades);renderDecades();$('explore-mode').checked=exploreEnabled;$('game-style').value=gameStyle;$('position-rule').value=position;renderSettings();$('difficulty').value=difficulty;$('show-history').checked=showHistory;$('setup-status').textContent='';$('daily').classList.remove('active');$('free').classList.add('active');$('setup').hidden=false;$('board').hidden=true;$('free-controls').hidden=true;$('date').textContent='FREE PLAY · YOUR MATCHUP';$('par').textContent='ANY TWO PLAYERS';selectedStart=selectedEnd=null;for(const id of ['start-search','end-search'])$(id).value='';for(const id of ['start-results','end-results'])$(id).replaceChildren();updateCustomButtons();$('random-free').disabled=!selectedDecades.length;}
function autocomplete(inputId,resultId,callback){const input=$(inputId),container=$(resultId);let timer;input.addEventListener('input',()=>{clearTimeout(timer);if(inputId==='start-search')selectedStart=null;if(inputId==='end-search')selectedEnd=null;if(inputId!=='player-search')updateCustomButtons();timer=setTimeout(()=>{container.replaceChildren();if(!engine)return;const matches=engine.search(input.value);if(!matches.length&&input.value.trim()){const p=document.createElement('p');p.textContent='No matching players.';container.append(p)}for(const p of matches){const button=document.createElement('button');button.type='button';button.textContent=p.name;const details=document.createElement('small');details.textContent=`${p.position} · ${String(p.first).slice(0,4)}–${String(p.last).slice(-4)} · #${p.id}`;button.append(details);button.onclick=()=>{container.replaceChildren();callback(p)};container.append(button)}},100)});input.addEventListener('keydown',e=>{if(e.key==='Escape')container.replaceChildren();if(e.key==='ArrowDown'){e.preventDefault();container.querySelector('button')?.focus()}});container.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...container.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}if(e.key==='Escape'){container.replaceChildren();input.focus()}})}
autocomplete('player-search','player-results',p=>add(p.id));
for(const side of ['start','end'])autocomplete(side+'-search',side+'-results',p=>{if(side==='start')selectedStart=p.id;else selectedEnd=p.id;$(side+'-search').value=p.name;updateCustomButtons()});
function clearChallengeURL(){const url=new URL(location.href);for(const k of ['start','end','decades','style','position'])url.searchParams.delete(k);history.replaceState(null,'',url);}
function updateCustomButtons(){const disabled=!selectedStart||!selectedEnd||selectedStart===selectedEnd;$('start-free').disabled=$('share-custom').disabled=disabled;$('challenge-link-box').hidden=true;}
function beginFree(a,b,restriction=null){
 closeExplorer();closeCompletion();revision++;solving=lost=false;
 gamePosition=snakeStyles.includes(gameStyle)?'any':restriction??(position==='random'?'any':position);
 if(gameStyle==='shortest'){const eligible=new Set(playersFromEras(data,selectedDecades));if(!eligible.has(a)||!eligible.has(b)){$('setup-status').textContent='Choose starting and destination players who appeared in your selected eras.';return false}}
 engine=createEngine(data,gameStyle==='shortest'?allDecades:selectedDecades,{position:gamePosition,start:a,end:b});snake=snakeStyles.includes(gameStyle)?createSnake(data,selectedDecades,gameStyle):null;
 const path=snake?snake.finish(snake.context(a,b)).path?.players:engine.shortest(a,b);
 if(!path||path.length<2){$('setup-status').textContent=snake?'No valid route was found under these Snake rules. Career Run needs both endpoint seasons in your selected decades. Try different players or eras.':'No route exists under this position rule. Choose another position or different players.';return false}
 mode='free';start=a;end=b;optimal=snake?path.length-1:minimumShots(path.length-1);route=[start];routeLinks=[];finished=revealed=false;hintsUsed=0;hintedPlayers=new Set();
 $('daily').classList.remove('active');$('free').classList.add('active');$('setup').hidden=true;$('board').hidden=false;$('date').textContent=snake?styleNames[gameStyle].toUpperCase():'FREE PLAY · '+positionNames[gamePosition].toUpperCase();
 $('player-search').value='';$('player-results').replaceChildren();history.replaceState(null,'',gameURL());
 render();status(snake?'Your Snake matchup is ready. '+snakeRules[gameStyle]:'Your matchup is ready. '+(gamePosition==='any'?'Make the first connection.':'Intermediate players must match '+positionNames[gamePosition]+'. Endpoints are unrestricted.'));maybeShowIntro();requestAnimationFrame(()=>$('round-rules').scrollIntoView?.({behavior:'smooth',block:'start'}));return true;
}
async function randomFree(){
 const generation=revision,style=gameStyle,decades=[...selectedDecades],pool=difficultyPool(data,difficulty);
 const restrictions=style==='shortest'?(position==='random'?(()=>{const values=[...positions];for(let i=values.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[values[i],values[j]]=[values[j],values[i]]}return values})():[position]):['any'];
 $('random-free').disabled=$('random-again').disabled=true;status('Finding a playable matchup…');$('setup-status').textContent='Finding a playable matchup…';
 try{
  let pair=null,restriction='any';for(const value of restrictions){if(generation!==revision)return;restriction=value;pair=await solve('random',{style,decades,pool,position:value});if(pair||generation!==revision)break}
  if(generation!==revision)return;
  if(!pair){const message='No playable matchup is available with these rules and difficulty in your selected decades. Add decades or increase the difficulty.';$('setup-status').textContent=message;status(message,true);return}
  beginFree(pair.start,pair.end,restriction);
 }catch(error){if(generation===revision){$('setup-status').textContent=error.message;status(error.message,true)}}finally{$('random-free').disabled=!selectedDecades.length;$('random-again').disabled=false}
}
async function copyChallenge(url,feedback){
 try{await navigator.clipboard.writeText(url);feedback.textContent='Matchup link copied. Anyone with the link can play these players and rules.';return true}
 catch{feedback.textContent='Copy the matchup link below.';return false}
}
$('start-free').onclick=()=>{if(selectedStart&&selectedEnd&&selectedStart!==selectedEnd)beginFree(selectedStart,selectedEnd)};
$('share-custom').onclick=()=>{
 if(!selectedStart||!selectedEnd||selectedStart===selectedEnd)return;
 const restriction=snakeStyles.includes(gameStyle)?'any':position==='random'?'any':position;
 const customSnake=snakeStyles.includes(gameStyle)?createSnake(data,selectedDecades,gameStyle):null;
 const path=customSnake?customSnake.finish(customSnake.context(selectedStart,selectedEnd)).path:createEngine(data,allDecades,{position:restriction,start:selectedStart,end:selectedEnd}).shortest(selectedStart,selectedEnd);
 if(!path){$('setup-status').textContent='No route exists for these players under the selected rules. Try different players or decades.';return}
 $('challenge-link').value=challengeURL(location.href,selectedStart,selectedEnd,selectedDecades,gameStyle,restriction);$('challenge-link-box').hidden=false;$('challenge-feedback').textContent='Your matchup is ready to share.';
};
$('copy-challenge').onclick=()=>copyChallenge($('challenge-link').value,$('challenge-feedback'));
$('random-free').onclick=$('random-again').onclick=randomFree;
$('choose-matchup').onclick=setupFree;
$('share-matchup').onclick=async()=>{const url=gameURL();const copied=await copyChallenge(url,$('status'));if(!copied){const box=document.createElement('textarea');box.value=url;$('status').append(box);box.focus();box.select()}};
$('daily').onclick=daily;$('free').onclick=setupFree;$('connect').onclick=()=>add(end);$('undo').onclick=()=>{if(finished||solving||route.length<2||(longest()&&['open','career'].includes(gameStyle)))return;route.pop();if(longest())routeLinks.pop();save();render();status('Last link removed.')};
$('give-up').onclick=async()=>{
 if(solving||finished||!confirm(`Reveal ${longest()?'the longest route found':'the shortest route'}? This ends your attempt.`))return;
 const generation=revision;
 if(!longest()){route=engine.shortest(start,end);routeLinks=[];finished=revealed=true;save();render();status('Shortest route revealed, with team-season evidence.');return}
 solving=true;render();status('Finding a long valid route…');
 try{
  const result=await solve('longest',{decades:selectedDecades,style:gameStyle,start,end,route:[...route],links:[...routeLinks]});
  if(generation!==revision)return;
  if(!result.path){status('No finish was found from this chain. Restart the matchup to try again.',true);return}
  route=[...route.slice(0,-1),...result.path.players];routeLinks=[...routeLinks,...result.path.links];finished=revealed=true;save();status(result.proven?'Longest possible continuation revealed.':'Longest continuation found. A longer route may still exist.');
 }catch(error){if(generation===revision)status(error.message,true)}finally{if(generation===revision){solving=false;render()}}
};
$('hint').onclick=()=>{if(finished||solving)return;const current=route.at(-1),finish=finishPath(),path=finish?.players,teams=path?.length>1?(longest()?[finish.links[0][0]]:[...new Set(engine.evidence(current,path[1]).map(g=>g[0]))]):[];if(!teams.length){status('No legal finish remains. Restart this matchup.',true);return}if(!hintedPlayers.has(current)){hintedPlayers.add(current);hintsUsed++}save();$('hint').textContent='Team hint';$('hint-text').hidden=false;$('hint-text').textContent='Your next link on one shortest route shares: '+teams.map(t=>data.teams[t]||t).join(' or ')+'. Find a player who connects here.'};
function renderDecades(){const box=$('decades');box.replaceChildren();for(const decade of allDecades){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=decade;input.checked=selectedDecades.includes(decade);input.onchange=()=>{selectedDecades=[...box.querySelectorAll('input:checked')].map(x=>Number(x.value));changeDecades()};label.append(input,document.createTextNode(decade+'s'));box.append(label)}}
function changeDecades(){revision++;write('line-change-decades',selectedDecades);engine=createEngine(data,selectedDecades);selectedStart=selectedEnd=null;$('start-search').value=$('end-search').value='';$('start-results').replaceChildren();$('end-results').replaceChildren();updateCustomButtons();$('random-free').disabled=!selectedDecades.length;$('setup-status').textContent=selectedDecades.length?'Choose your matchup using these decades.':'Select at least one decade.'}
$('all-decades').onclick=()=>{selectedDecades=[...allDecades];renderDecades();changeDecades()};$('modern-decades').onclick=()=>{selectedDecades=allDecades.filter(d=>d>=1990);renderDecades();changeDecades()};
function seasonExploreAllowed(year){
 if(!longest()||gameStyle!=='career')return true;
 const c=snakeContext();return routeLinks.length?year>routeLinks.at(-1)[1]&&year<=c.bounds.last:year===c.bounds.first;
}
function historyFor(id){
 return playerHistory(data,id,activeDecades()).map(record=>({...record,allowed:record.allowed.filter(seasonExploreAllowed)}));
}
function fillTeamDetails(details,id){
  if(!details.querySelector('summary')){const summary=document.createElement('summary');summary.textContent='Teams & seasons';details.append(summary)}
  if(longest()&&gameStyle==='career'){const progress=document.createElement('small');progress.className='history-progress';progress.textContent=routeLinks.length?`Continue after ${season(routeLinks.at(-1)[1])}. Earlier seasons are greyed out.`:`First shot: ${season(snakeContext().bounds.first)} only.`;details.append(progress)}
  for(const record of historyFor(id)){
   const row=document.createElement('div');row.className='endpoint-team';const team=document.createElement(record.allowed.length?'strong':'span');team.textContent=data.teams[record.team]||record.team;row.append(team);
   const allowed=document.createElement('div');allowed.className='endpoint-years';if(canExplore()){for(const year of record.allowed){const button=document.createElement('button');button.type='button';button.className='season-link';button.textContent=season(year);button.disabled=!seasonExploreAllowed(year);button.setAttribute('aria-label',`Explore ${data.teams[record.team]||record.team} ${season(year)} roster`);button.onclick=()=>openExplorer({kind:'roster',team:record.team,year,query:''});allowed.append(button)}}else{const text=document.createElement('strong');text.textContent=seasonRanges(record.allowed);allowed.append(text)}if(record.allowed.length)row.append(allowed);
   const outside=record.seasons.filter(s=>!record.allowed.includes(s));if(outside.length){const rest=document.createElement('span');rest.className='endpoint-years outside-years';rest.textContent=seasonRanges(outside);row.append(rest)}details.append(row);
  }
  const note=document.createElement('small');note.textContent=canExplore()?(longest()?'Tap a bold season to explore its roster. Grey seasons cannot be used for your next shot.':'All seasons are available. Tap a season to explore its roster.'):(longest()?'Bold teams and seasons count in this game.':'All NHL seasons count in this game.');details.append(note);
}
function closeExplorer(){if($('explorer').open)$('explorer').close();exploreStack=[];}
function openExplorer(view){if(!canExplore()||(view.kind==='roster'&&!seasonExploreAllowed(view.year)))return;exploreStack=[view];renderExplorer();if(!$('explorer').open)$('explorer').showModal();}
function visitExplorer(view){if(view.kind==='roster'&&!seasonExploreAllowed(view.year))return;exploreStack.push(view);renderExplorer();}
function renderExplorer(){
 const view=exploreStack.at(-1);if(!view)return;
 const bounds=longest()&&gameStyle==='career'?snakeContext().bounds:null;
 $('explore-goal').textContent=`Trying to connect ${name(start)}${bounds?' '+season(bounds.first):''} to ${name(end)}${bounds?' '+season(bounds.last):''}.`;
 $('explore-step').textContent=bounds?(routeLinks.length?`Next shot: a later season than ${season(routeLinks.at(-1)[1])}, ending by ${season(bounds.last)}.`:`First shot: ${name(start)}’s rookie season, ${season(bounds.first)}.`):longest()?`${styleNames[gameStyle]} · ${routeLinks.length} shots taken.`:`Minimum ${shotLabel(optimal)} · ${positionNames[gamePosition]}.`;
 $('explore-back').disabled=exploreStack.length<2;$('explore-content').replaceChildren();$('roster-search-box').hidden=view.kind!=='roster';
 const content=$('explore-content');
 if(view.kind==='roster'){
  $('explore-title').textContent=`${data.teams[view.team]||view.team} · ${season(view.year)}`;$('roster-search').value=view.query||'';
  const note=document.createElement('p');note.className='explore-note';note.textContent='Tap a player to browse their career. Browsing takes no shots.';content.append(note);renderRoster();
 }else{
  $('explore-title').textContent=name(view.id);const profile=document.createElement('div');profile.className='explore-profile';profile.append(portrait(view.id,name(view.id)));
  const verdict=eligibility(view.id,view.connection),button=document.createElement('button');button.textContent=verdict.allowed?(view.id===end?'Connect to destination':'Add to chain') :verdict.reason;button.disabled=!verdict.allowed;
  button.onclick=()=>{const before=route.length;add(view.id,view.connection);if(route.length>before){closeExplorer();if(!finished)requestAnimationFrame(()=>{const player=$('chain').querySelector(`[data-player-id="${view.id}"]`);player?.querySelector('summary')?.focus();player?.scrollIntoView({behavior:'smooth',block:'center'})})}else renderExplorer()};profile.append(button);content.append(profile);
  const note=document.createElement('p');note.className='explore-note';note.textContent=verdict.allowed?(!longest()&&view.id!==end&&engine.evidence(view.id,end).length?`This player connects to ${name(route.at(-1))} and ${name(end)}. Add them to finish automatically in one shot; the destination link takes no extra shot.`:`This player connects to ${name(route.at(-1))}. Adding them takes one shot.`):'You can keep exploring this career without adding a player.';content.append(note);
  for(const record of historyFor(view.id)){
   const row=document.createElement('div');row.className='explore-career-team'+(record.allowed.length?'':' inactive-history');const title=document.createElement(record.allowed.length?'strong':'span');title.textContent=data.teams[record.team]||record.team;row.append(teamLogo(record.team,title.textContent),title);content.append(row);
   const seasons=document.createElement('div');seasons.className='explore-seasons';for(const year of record.seasons){const allowed=record.allowed.includes(year)&&seasonExploreAllowed(year),link=document.createElement(allowed?'button':'span');link.textContent=season(year);if(allowed){link.type='button';link.className='season-link';link.setAttribute('aria-label',`Explore ${title.textContent} ${season(year)} roster`);link.onclick=()=>visitExplorer({kind:'roster',team:record.team,year,query:''})}else link.className='outside-years';seasons.append(link)}content.append(seasons);
  }
 }
}
function renderRoster(){
 const view=exploreStack.at(-1);if(view?.kind!=='roster')return;let list=$('explore-roster');if(!list){list=document.createElement('div');list.id='explore-roster';$('explore-content').append(list)}list.replaceChildren();
 const needle=(view.query||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const ids=rosterFor(data,view.team,view.year,activeDecades()).filter(id=>name(id).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle));
 const count=document.createElement('p');count.className='explore-note';count.setAttribute('role','status');count.textContent=ids.length?`${ids.length} ${ids.length===1?'player':'players'}`:'No players match this search.';list.append(count);
 for(const id of ids){const button=document.createElement('button');button.className='roster-player';button.type='button';const body=document.createElement('span'),title=document.createElement('strong'),label=document.createElement('small');title.textContent=name(id);label.textContent=route.includes(id)?'Already used':data.players[id][1]+(id===end?' · Destination':'');body.append(title,label);button.append(portrait(id,name(id)),body);button.onclick=()=>visitExplorer({kind:'player',id,connection:[view.team,view.year]});list.append(button)}
}
$('explore-mode').onchange=()=>{exploreEnabled=$('explore-mode').checked;write('line-change-explore',exploreEnabled)};
$('explore-current').onclick=$('explore-daily-current').onclick=()=>openExplorer({kind:'player',id:route.at(-1)});
$('close-explorer').onclick=closeExplorer;
$('explore-back').onclick=()=>{if(exploreStack.length>1){exploreStack.pop();renderExplorer()}};
$('explorer').addEventListener('close',()=>{exploreStack=[]});
$('roster-search').oninput=()=>{const view=exploreStack.at(-1);if(view?.kind==='roster'){view.query=$('roster-search').value;renderRoster()}};
function finishPath(){return longest()?snake.finish(snakeContext()).path:{players:engine.shortest(route.at(-1),end,route.slice(0,-1))}}
function nextHint(){return finishPath()?.players}
function countExploreHint(type){const key=type+':'+route.at(-1);if(!hintedPlayers.has(key)){hintedPlayers.add(key);hintsUsed++;save()}}
$('roster-hint').onclick=()=>{if(finished||solving)return;const finish=finishPath(),path=finish?.players;if(!path||path.length<2)return;const [team,year]=longest()?finish.links[0]:engine.evidence(path[0],path[1])[0];countExploreHint('roster');openExplorer({kind:'roster',team,year,query:''})};
$('player-hint').onclick=()=>{if(finished||solving)return;const path=nextHint();if(!path||path.length<2)return;countExploreHint('player');openExplorer({kind:'player',id:path[1]})};
$('game-style').onchange=()=>{revision++;gameStyle=$('game-style').value;write('line-change-style',gameStyle);renderSettings();if(snakeStyles.includes(gameStyle)){selectedDecades=[...allDecades];renderDecades();changeDecades();$('setup-status').textContent='All decades selected for Snake. You can narrow them above.'}};
$('position-rule').onchange=()=>{revision++;position=$('position-rule').value;write('line-change-position',position)};
$('restart-game').onclick=$('completion-restart').onclick=()=>beginFree(start,end,gamePosition);
$('difficulty').onchange=()=>{revision++;difficulty=$('difficulty').value;write('line-change-difficulty',difficulty)};
$('show-history').onchange=()=>{showHistory=$('show-history').checked;write('line-change-team-history',showHistory)};
$('daily-explore-mode').onchange=()=>{dailyExploreEnabled=$('daily-explore-mode').checked;write('line-change-daily-explore',dailyExploreEnabled);closeExplorer();render()};
$('close-completion').onclick=$('view-completed-route').onclick=closeCompletion;
$('completion-share').onclick=()=>{closeCompletion();share()};
$('intro-start').onclick=$('close-intro').onclick=()=>{acknowledgeIntro();$('intro-rules').close()};
$('intro-rules').addEventListener('close',acknowledgeIntro);
$('help').onclick=()=>$('rules').showModal();$('close-help').onclick=()=>$('rules').close();
async function load(){try{const r=await fetch('data/hockey.json');if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();const schedule=await fetch('data/daily-puzzles.json');if(!schedule.ok)throw Error('Puzzle schedule unavailable');data.dailySchedule=await schedule.json();const depth=await fetch('data/player-depth.json');if(!depth.ok)throw Error('Player difficulty data unavailable');data.playerDepth=await depth.json();engine=createEngine(data);const shared=parseChallenge(location.href,data);if(shared){gameStyle=shared.style==='longest'?'open':shared.style||'shortest';selectedDecades=shared.decades;engine=createEngine(data,selectedDecades);if(!beginFree(shared.start,shared.end,shared.position||'any')){setupFree();$('setup-status').textContent='No route exists for this shared matchup. Choose new players or decades.'}showStreak()}else daily()}catch(e){if(data?.playerDepth){setupFree();$('setup-status').textContent=e.message;return}status('The hockey data couldn’t load. Check your connection and try again.',true);const b=document.createElement('button');b.textContent='Retry';b.onclick=()=>{b.remove();load()};$('status').after(b)}}
load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mode==='daily'&&data&&date!==easternDate())daily()});
