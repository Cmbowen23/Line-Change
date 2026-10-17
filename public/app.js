import {createEngine,easternDate,puzzleFor,dailyDifficultyFor,streakFor,matchesPlayerName,orderMatchup,reviewDailyRoute} from './core.js';
import {allDecades,challengeURL,parseChallenge} from './challenges.js';
import {portrait,teamLogo,connectionSentence,playerHistory,seasonRanges,difficultyPool,routePosition} from './presentation.js';
import {rosterFor,canAddPlayer,appendConnection} from './explore.js';
import {snakeStyles,positions,styleNames,positionNames,snakeRules,matchesPosition,snakeScore,playersFromEras,minimumShots,shortestShots,shotLabel,dailyStars} from './modes.js';
import {createSnake} from './snake.js';
const $=id=>document.getElementById(id);
let data,engine,mode='daily',date=easternDate(),start,end,optimal,route=[],routeLinks=[],finished=false,revealed=false,selectedStart,selectedEnd,hintsUsed=0,hintedPlayers=new Set();
let selectedDecades=allDecades;
let customSearchEngine;
let longTarget=null;
let lookupRequest=0;
let rightRoute=[],buildSide='start',shortHistory=[];
let exploreStack=[];
const explorePositions=new Map();
const exploreSeasons=new Map();
const canExplore=()=>true;
const activeDecades=()=>mode==='daily'||gameStyle==='shortest'?allDecades:selectedDecades;
let gameStyle=read('line-change-style','shortest');if(gameStyle==='longest')gameStyle='open';if(!['shortest',...snakeStyles].includes(gameStyle))gameStyle='shortest';
let position=read('line-change-position','any');if(!['random',...positions].includes(position))position='any';
// Older versions assigned Random implicitly. Keep it only after an explicit choice.
if(position==='random'&&!read('line-change-position-explicit',false))position='any';
let randomRuleBag=[],strikes=0;
let recentRandomGames=read('line-change-random-history',[]);
if(!Array.isArray(recentRandomGames))recentRandomGames=[];
recentRandomGames=recentRandomGames.filter(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(Number.isInteger)).slice(-8);
let shortestOnly=read('line-change-shortest-only',true)!==false;
let gamePosition='any',snake=null,lost=false,solving=false,revision=0,worker=null,workerId=0;const workerRequests=new Map();
const longest=()=>mode==='free'&&snakeStyles.includes(gameStyle);
const positionRuleTitles={defense:'Defensemen only',goalie:'Goalies only',forward:'Forwards only'};
const activePositionRule=()=>!longest()&&gamePosition!=='any'?positionRuleTitles[gamePosition]:'';
const gameURL=()=>challengeURL(location.href,start,end,selectedDecades,gameStyle,gamePosition);
const snakeContext=()=>snake.context(start,end,route,routeLinks);
const activeChain=()=>!longest()&&!finished&&buildSide==='end'?rightRoute:route;
const currentPlayer=()=>activeChain().at(-1);
const oppositePlayer=()=>!longest()&&buildSide==='end'?route.at(-1):longest()?end:rightRoute.at(-1);
const usedPlayers=()=>longest()||finished?route:[...route,...rightRoute];
function currentShortestScore(){return shortestShots(route,end)+(finished&&!lost?0:Math.max(0,rightRoute.length-1));}
function selectBuildSide(side){if(longest()||finished||solving)return;buildSide=side==='end'?'end':'start';$('player-search').value='';$('player-results').replaceChildren();save();render();if($('explorer').open){const view=exploreStack.at(-1);if(view)view.buildSide=buildSide;renderExplorer();}}

function eligibility(id,connection=null){
 if(finished||solving)return {allowed:false,reason:solving?'Finding a route…':'Game complete'};
 if(longest())return snake.canAdd(snakeContext(),id,connection);
 const opposite=oppositePlayer();
 if(id!==start&&id!==end&&!matchesPosition(data.players[id],gamePosition))return {allowed:false,reason:'This challenge requires '+positionNames[gamePosition]};
 if(usedPlayers().includes(id)&&id!==opposite)return {allowed:false,reason:'Already used'};
 // Shortest Chain permits every season: prefer the browsed proof, but do not reject a teammate from another year.
 const matchingSeason=connection&&engine.evidence(currentPlayer(),id).some(group=>group[0]===connection[0]&&group[1]===connection[1]);
 return canAddPlayer(engine,activeChain(),opposite,id,{finished,connection:matchingSeason?connection:null});
}
function solve(type,request){if(!worker){worker=new Worker(new URL('./solver-worker.js',import.meta.url),{type:'module'});worker.postMessage({type:'init',data});worker.onmessage=e=>{const pending=workerRequests.get(e.data.id);if(!pending)return;workerRequests.delete(e.data.id);if(e.data.error)pending.reject(Error(e.data.error));else pending.resolve(e.data.result)};worker.onerror=()=>{for(const pending of workerRequests.values())pending.reject(Error('The route search could not finish. Please try again.'));workerRequests.clear();worker.terminate();worker=null}}const id=++workerId;return new Promise((resolve,reject)=>{workerRequests.set(id,{resolve,reject});worker.postMessage({id,type,...request})})}
function renderSettings(){$('era-title').textContent=gameStyle==='shortest'?'Which player eras?':'Which connection decades?';$('era-description').textContent=gameStyle==='shortest'?'Choose the eras for your starting and destination players. Connections, player search during play, and roster exploration can use every NHL season.':'Only connections from seasons starting in your selected decades count. Choose one or combine several.';$('snake-description').hidden=!snakeStyles.includes(gameStyle);$('snake-description').textContent=snakeRules[gameStyle]||'';$('position-settings').hidden=gameStyle!=='shortest';$('random-description').textContent=gameStyle==='career'?'Random games pair an earlier rookie season with a later final recorded season, with a verified route between them.':snakeStyles.includes(gameStyle)?'Random games favor players with many connections. Each generated matchup has a verified finish.':'Random games balance available 1–4-shot lengths and prefer fewer shortest answers. Unavailable lengths are skipped.'}
let difficulty=read('line-change-difficulty','easy');
if(!['easy','medium','hard'].includes(difficulty))difficulty='easy';
// Reopen this test daily after the scoring-rule change; other dates keep their saved attempts.
const dailyAttemptResets={'2026-10-14':2};
const key=()=>`line-change-v1:${data.version}:${date}:${puzzleFor(data,date).slice(0,2).join('-')}${dailyAttemptResets[date]?':attempt-'+dailyAttemptResets[date]:''}`;
function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{status('Your browser cannot save progress. You can still play.')}}
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);if($('explorer').open){$('explore-feedback').hidden=!error;$('explore-feedback').textContent=error?s:''}}
const name=p=>data.players[p][0];
const season=s=>String(s).slice(0,4)+'–'+String(s).slice(-2);
function save(){if(mode==='daily')write(key(),{route,rightRoute,buildSide,shortHistory,finished,lost,strikes,revealed,hintsUsed,hintedPlayers:[...hintedPlayers]})}
function showStreak(){$('streak').textContent=streakFor(read('line-change-wins',{}),easternDate())}
function proof(a,b){const e=longest()?[routeLinks.at(-1)]:engine.evidence(a,b);return e.length?`${data.teams[e[0][0]]||e[0][0]} · ${season(e[0][1])}${e.length>1?` · +${e.length-1} other team-seasons`:''}`:''}
function render(){
 $('hint-text').hidden=true;$('hint-text').textContent='';
 $('par').hidden=!longest();$('par').textContent=longest()?(gameStyle==='career'?'SEASONS CROSSED':gameStyle==='road'?'TEAMS VISITED':'MOST SHOTS'):'';$('free-controls').hidden=mode!=='free';
 for(const id of ['roster-hint','player-hint'])$(id).hidden=false;
 const score=longest()?snakeScore(gameStyle,routeLinks):null;
 $('game-goal').textContent=longest()?`${score.value} ${score.value===1?score.unit.slice(0,-1):score.unit}${gameStyle==='career'?` · ${score.span}-year span`:''} so far`:`${shotLabel(currentShortestScore())} taken`;renderRoundScore();renderRoute();
 $('restart-game').hidden=mode!=='free';$('entry').hidden=finished;$('actions').hidden=finished;$('undo').hidden=longest()&&['open','career'].includes(gameStyle);$('undo').disabled=solving||(longest()?route.length<2:!shortHistory.length);$('give-up').disabled=solving;$('give-up').textContent=solving?'Finding a route…':longest()?'Reveal longest route':'Reveal shortest route';$('player-search').disabled=solving;
 $('hint').textContent='Team hint';

 const canFinish=eligibility(oppositePlayer()).allowed;$('connect').disabled=!canFinish;$('connect').textContent=longest()?'Connect to destination →':'Join chains ↔';$('result').hidden=!finished;
 if(finished)renderResult();else $('result').replaceChildren();
}
function renderStars(element,stars,label){
 element.replaceChildren();element.setAttribute('aria-label',label);
 for(let i=1;i<=3;i++){const star=document.createElement('span');star.textContent='★';star.className=i<=stars?'star earned':'star';star.setAttribute('aria-hidden','true');element.append(star)}
}
function renderStrikeMarks(element){element.replaceChildren();element.setAttribute('aria-label',`${strikes} of 3 Xs`);for(let i=0;i<3;i++){const mark=document.createElement('span');mark.textContent='×';mark.className=i<strikes?'strike earned':'strike';mark.setAttribute('aria-hidden','true');element.append(mark)}}
function renderRoundScore(){renderStrikeMarks($('strike-count'));$('shortest-only-setting').hidden=mode!=='free'||longest();$('shortest-only').checked=shortestOnly;$('shortest-only').disabled=finished||solving;

 const rule=activePositionRule();$('round-position-rule').hidden=!rule;$('round-position-rule').textContent=rule;
 const shots=currentShortestScore(),stars=dailyStars(shots,optimal,revealed||lost);
 $('daily-stars').hidden=mode!=='daily';
 if(mode==='daily')renderStars($('daily-stars'),stars,revealed?'Answer revealed — no stars':`${stars} ${finished?'stars earned':'stars available'}`);
 if(longest()){
  if(finished&&!lost&&route.at(-1)===end&&(!longTarget||routeLinks.length>longTarget.moves))longTarget={moves:routeLinks.length,proven:false};
  $('route-target').textContent=longTarget?`${longTarget.proven?'Longest possible route':'Longest route found'}: ${shotLabel(longTarget.moves)}`:'Finding longest route…';
 }else $('route-target').textContent=`Shortest route: ${shotLabel(optimal)}`;
 $('route-target-note').hidden=!longest();
 $('route-target-note').textContent=longest()?(longTarget?(longTarget.proven?'Verified maximum under this round’s rules.':'Best verified route; a longer route may exist.'):'You can start playing while the route target is calculated.') : '';
 if(longest()&&gameStyle==='career')$('route-target-note').textContent+=` Goal: ${season(snakeContext().bounds.first)} → ${season(snakeContext().bounds.last)}.`;
}
async function findLongTarget(){
 const generation=revision,request={decades:[...selectedDecades],style:gameStyle,start,end,route:[start],links:[]};
 try{
  const answer=await solve('longest',request);
  if(generation!==revision||!longest())return;
  if(answer.path&&snake.validPath(snake.context(start,end),answer.path)){
   const candidate={moves:answer.path.links.length,proven:answer.proven===true};
   if(!longTarget||candidate.moves>=longTarget.moves)longTarget=candidate;
  }
  renderRoundScore();
  if(!longTarget){$('route-target').textContent='Longest target unavailable';$('route-target-note').textContent='Keep building a valid chain. Restart to retry the target search.'}
 }catch(error){if(generation===revision&&longest()){$('route-target').textContent='Longest target unavailable';$('route-target-note').textContent='Keep playing; the route search could not finish.'}}
}
function canAttemptPlayer(id){return !!data.players[id]&&!finished&&!solving&&(!usedPlayers().includes(id)||id===oppositePlayer())&&(longest()||id===start||id===end||matchesPosition(data.players[id],gamePosition));}
function rejectConnection(reason){
 strikes=Math.min(3,strikes+1);if(strikes===3){finished=lost=true;closeExplorer();}
 save();render();if($('explorer').open)renderExplorer();status(`× ${strikes}/3 — ${reason}. The player was not added.`,true);if(lost)showCompletion();
}
function add(p,connection=null){
 if(finished||solving)return;
 const verdict=eligibility(p,connection);if(!verdict.allowed){
  if(mode==='daily'&&engine.evidence(currentPlayer(),p).length){status(verdict.reason+'.',true);return}
  rejectConnection(verdict.reason);return
 }
 // Daily accepts valid teammate detours. Only a missing teammate link costs an X.
 if(mode==='daily'){commitConnection(p,verdict);return}
 if(longest()){
  const next={...snakeContext(),route:[...route,p],links:[...routeLinks,verdict.evidence.slice(0,2)]};
  const result=snake.finish(next,{maxStates:20000});
  if(!result.path){if(result.exhausted){rejectConnection('That link leaves no valid route to the destination');return}
   const generation=revision;solving=true;render();if($('explorer').open)renderExplorer();status('Checking the proposed connection…');
   return solve('finish',{decades:selectedDecades,style:gameStyle,start,end,route:next.route,links:next.links}).then(answer=>{if(generation!==revision)return;solving=false;if(answer.path)commitConnection(p,verdict);else if(answer.exhausted)rejectConnection('That link leaves no valid route to the destination');else{render();if($('explorer').open)renderExplorer();status('The route check could not finish. Try another player.',true)}}).catch(error=>{if(generation!==revision)return;solving=false;render();if($('explorer').open)renderExplorer();status(error.message,true)});
  }
 }else{
  const opposite=oppositePlayer(),excluded=usedPlayers().filter(id=>id!==p&&id!==opposite);
  const remaining=p===opposite?[p]:engine.shortest(p,opposite,excluded);
  if(!remaining){rejectConnection('That link leaves no valid route to the destination');return}
  const bestPossible=Math.max(1,route.length-1+rightRoute.length-1+remaining.length-1);
  if(shortestOnly&&bestPossible>optimal){rejectConnection(`That link would need at least ${shotLabel(bestPossible)}; the shortest route is ${shotLabel(optimal)}`);return}
 }
 commitConnection(p,verdict);
}
function commitConnection(p,verdict){
 const previous=currentPlayer();
 exploreSeasons.clear();
 if(longest()){routeLinks.push(verdict.evidence.slice(0,2));route=appendConnection(engine,route,p,end,true)}else{
  const opposite=oppositePlayer();
  if(p!==opposite){activeChain().push(p);shortHistory.push(buildSide)}
  if(p===opposite||engine.evidence(p,opposite).length){route=[...route,...[...rightRoute].reverse()];rightRoute=[];}
 }$('player-search').value='';$('player-results').replaceChildren();
 for(const details of $('chain').querySelectorAll('.chain-teams[open]'))details.open=false;
 if(route.at(-1)===end){finished=true;if(mode==='daily'){const wins=read('line-change-wins',{});wins[date]=true;write('line-change-wins',wins);showStreak()}}
 save();render();status(lost?'No chronological finish remains. Your run is over—restart to try another route.':finished?'Every link verified. Nice line change.':`Valid connection. ${proof(previous,p)}`);
 if(finished){closeExplorer();showCompletion()}
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
function closeCompletion(){if($('completion').open)$('completion').close();if($('shorter-choices').open)$('shorter-choices').close()}
function showCompletion(){
 const shots=longest()?route.length-1:currentShortestScore(),score=longest()?snakeScore(gameStyle,routeLinks):null;
 $('completion-eyebrow').textContent=lost?'ROUND OVER':'LINE COMPLETE';$('completion-title').textContent=lost?'Run over.':'You’re connected!';
 $('completion-shots').textContent=lost?`${strikes} Xs`:longest()?`${score.value} ${score.value===1&&score.unit==='shots'?'shot':score.unit}`:`${shots} ${shots===1?'shot':'shots'}`;
 $('completion-stars').hidden=mode!=='daily';if(mode==='daily')renderStars($('completion-stars'),dailyStars(shots,optimal,revealed||lost),`${dailyStars(shots,optimal,revealed||lost)} stars earned`);
 $('completion-minimum').textContent=longest()?(gameStyle==='career'?`${score.span}-year span · ${shots} shots`:`${route.length} unique players`):`Shortest route: ${shotLabel(optimal)}`;
 $('completion-message').textContent=lost?'Three Xs. Your round is over. Failed guesses did not change your chain.':longest()?'Every link follows your Snake rules.':shots===optimal?'You found a shortest possible route.':'Every connection verified. You reached the destination!';
 $('completion-restart').hidden=mode!=='free';$('completion-share').hidden=lost;$('completion').showModal();
}
function renderResult(){
 const el=$('result');el.replaceChildren();const heading=document.createElement('h2'),score=document.createElement('div'),desc=document.createElement('p'),snakeResult=longest()?snakeScore(gameStyle,routeLinks):null;
 heading.textContent=lost?'Run over.':revealed?(longest()?'A longer line.':'The shortest line.'):longest()?'That’s a long line.':currentShortestScore()===optimal?'Top of the league.':'You’re connected.';
 score.className='score';score.textContent=longest()?`${snakeResult.value} ${snakeResult.unit.toUpperCase()}${gameStyle==='career'?` · ${snakeResult.span}-YEAR SPAN`:''}`:`${mode==='daily'&&!revealed?dailyStars(currentShortestScore(),optimal,revealed||lost)+' STARS · ':''}${shotLabel(currentShortestScore()).toUpperCase()}`;
 desc.textContent=lost?'Three Xs. Try a new round.':revealed?longest()?'A long valid route revealed.':'Shortest route revealed.':longest()?`You connected ${route.length} unique players.`:currentShortestScore()===optimal?'You used the fewest possible shots.':'A valid route. Try a shorter route in free play.';el.append(heading,score,desc);
 if(hintsUsed){const hintNote=document.createElement('p');hintNote.textContent=`${hintsUsed} hint${hintsUsed===1?'':'s'} used`;el.append(hintNote)}
 if(!revealed&&!lost){const b=document.createElement('button');b.textContent='Share result';b.onclick=share;el.append(b)}
 if(mode==='free'){const b=document.createElement('button');b.className='secondary';b.textContent='Choose another matchup';b.style.marginLeft='8px';b.onclick=setupFree;el.append(b)}
 if(!lost)appendAllAnswers(el);
}
function openShorterChoices(step){
 const {left,right,shots}=step.before,from=step.from,to=route[step.side==='end'?left:right],blocked=[...route.slice(0,left),...route.slice(right+1)];
 const choices=engine.shortestChoices(from,to,blocked),list=$('shorter-players'),preview=$('shorter-preview');
 list.replaceChildren();preview.replaceChildren();preview.hidden=true;
 $('shorter-title').textContent=`${shotLabel(shots)} · Better choices`;
 const origin=$('shorter-origin');origin.replaceChildren(portrait(from,name(from)));const caption=document.createElement('strong');caption.textContent=name(from);origin.append(caption);
 let shown=0;
 function batch(){
  for(const id of choices.slice(shown,shown+24)){
   const button=document.createElement('button'),label=document.createElement('span');button.type='button';button.className='shorter-player';button.dataset.playerId=id;label.textContent=name(id);button.append(portrait(id,name(id)),label);
   button.onclick=()=>{
    const rest=engine.shortest(id,to,[...blocked,from]),bridge=[from,...rest];
    const alternative=[...route.slice(0,left),...(step.side==='end'?bridge.reverse():bridge),...route.slice(right+1)];
    const links=alternative.slice(1).map((p,i)=>engine.evidence(alternative[i],p)[0].slice(0,2));renderRoute(preview,alternative,links,engine);preview.hidden=false;
    for(const item of list.children)item.setAttribute('aria-pressed',String(item===button));
    preview.scrollIntoView?.({behavior:'smooth',block:'nearest'});
   };list.append(button);
  }
  shown+=24;$('shorter-more').hidden=shown>=choices.length;
 }
 $('shorter-more').onclick=batch;batch();$('shorter-choices').showModal();
}
$('close-shorter').onclick=()=>$('shorter-choices').close();
function chainPortrait(id,linkedTeam=null){
 const head=portrait(id,name(id));if(id!==start&&id!==end)return head;
 const frame=document.createElement('span');frame.className='endpoint-portrait';frame.append(head);
 const teams=playerHistory(data,id,allDecades).filter(record=>record.team!==linkedTeam);
 for(let i=0;i<teams.length;i++){
  const team=teams[i].team,logo=teamLogo(team,data.teams[team]||team),angle=-Math.PI/2+i*2*Math.PI/teams.length;
  logo.className+=' career-team-logo';logo.title=data.teams[team]||team;
  logo.style.left=(50+43*Math.cos(angle))+'%';logo.style.top=(50+43*Math.sin(angle))+'%';frame.append(logo);
 }
 return frame;
}
function endpointLinkedTeam(id,index,players,pending,links=routeLinks,isLookup=false){
 if(id!==start&&id!==end)return null;
 const edge=id===start?index:index-1;
 if(edge<0||edge>=players.length-1||pending&&edge===route.length-1)return null;
 return isLookup||longest()?links[edge]?.[0]:engine.evidence(players[edge],players[edge+1])[0]?.[0];
}
function renderRoute(target=$('chain'),path=route,links=routeLinks,lookupEngine=null){
 const isLookup=Boolean(lookupEngine),chain=target,openTeams=new Set([...chain.querySelectorAll('.chain-teams[open]')].map(el=>Number(el.dataset.playerId)));
 const destination=isLookup?path.at(-1):end,pending=!isLookup&&path.at(-1)!==end,players=pending?(longest()?[...path,end]:[...path,...[...rightRoute].reverse()]):path;
 const review=!isLookup&&target===$('chain')&&mode==='daily'&&finished&&!lost&&!revealed&&currentShortestScore()>optimal?reviewDailyRoute(engine,route,shortHistory):null,detour=review&&review.firstDetour>=0?review.steps[review.firstDetour]:null;
 const positionFor=i=>players.length===2?{row:1,column:i*2+1}:routePosition(i);
 chain.className='route-chain'+(players.length===2?' route-pair':'');chain.setAttribute('aria-label',isLookup?'Connection lookup route':revealed?'Revealed route':'Your player chain');chain.replaceChildren();
 for(let i=0;i<players.length;i++){
  const id=players[i],position=positionFor(i),player=document.createElement('li'),caption=document.createElement('span'),role=document.createElement('span');
  player.className='route-player'+(!isLookup&&!longest()&&!finished&&id===currentPlayer()?' active-frontier':'');player.dataset.playerId=id;player.style.gridRow=position.row;player.style.gridColumn=position.column;caption.className='route-name';caption.textContent=name(id);

  if(!isLookup&&canExplore()){const button=document.createElement('button');button.className='explore-player-button';button.type='button';button.setAttribute('aria-label','Explore '+name(id));button.append(chainPortrait(id,endpointLinkedTeam(id,i,players,pending,links,isLookup)),caption);button.onclick=()=>openExplorer({kind:'player',id});player.append(button)}else player.append(portrait(id,name(id)),caption);
  if(!isLookup&&canExplore()){const details=document.createElement('details');details.className='endpoint-teams chain-teams';details.dataset.playerId=id;details.open=openTeams.has(id);const summary=document.createElement('summary');summary.textContent='Teams & seasons';details.append(summary);const loadHistory=()=>{if(details.open&&details.dataset.loaded!=='true'){fillTeamDetails(details,id);details.dataset.loaded='true'}};details.addEventListener('toggle',loadHistory);loadHistory();player.append(details)}chain.append(player);
  if(i===players.length-1)continue;
  const next=positionFor(i+1),unconnected=pending&&i===route.length-1,link=document.createElement('li');
  const vertical=next.row!==position.row;link.className='route-link '+(vertical?'route-down':next.column<position.column?'route-left':'route-right')+(unconnected?' route-pending'+(!longest()?' route-both':''):'');
  link.style.gridRow=vertical?position.row+1:position.row;link.style.gridColumn=vertical?position.column:(position.column+next.column)/2;
  const line=document.createElement('span');line.className='route-line'+(unconnected&&!longest()?' route-gap-mark':'');line.setAttribute('aria-hidden','true');if(unconnected&&!longest())line.append(gapArrow());link.append(line);
  if(unconnected){link.setAttribute('aria-label','Destination not yet reached. Keep adding connections.');link.title='Keep adding connections to reach '+name(end)}else{
   const [team,year]=isLookup?links[i]:longest()?routeLinks[i]:engine.evidence(id,players[i+1])[0];
   const sentence=connectionSentence({fromName:name(id),toName:name(players[i+1]),teamName:data.teams[team]||team,season:season(year)});link.setAttribute('aria-label',sentence);link.title=sentence;
   const logo=teamLogo(team,data.teams[team]||team),label=document.createElement('span');label.className='route-season';label.textContent=season(year);label.setAttribute('aria-hidden','true');link.append(logo,label);
  }
  if(detour&&((id===detour.from&&players[i+1]===detour.player)||(id===detour.player&&players[i+1]===detour.from))){
   const marker=document.createElement('button');marker.type='button';marker.className='shorter-route-marker';marker.textContent='↗ Shorter route';marker.setAttribute('aria-label','Show better choices from '+name(detour.from));marker.onclick=()=>openShorterChoices(detour);link.className+=' has-shorter-route';link.append(marker);
  }
  chain.append(link);
 }
}
function appendAllAnswers(parent,lookup=null){
 if(!lookup&&longest()){
  const section=document.createElement('section'),heading=document.createElement('h3'),note=document.createElement('p');section.className='all-answers';heading.textContent='Longest route found';note.textContent='Finding a longer valid route…';section.append(heading,note);parent.append(section);
  const generation=revision,seedPath=route.at(-1)===end?{players:[...route],links:[...routeLinks]}:null;
  solve('longest',{decades:selectedDecades,style:gameStyle,start,end,route:[start],links:[],seedPath}).then(answer=>{
   if(!section.isConnected||generation!==revision)return;
   heading.textContent=answer.proven?'Longest possible route':'Longest route found';
   note.className='long-answer';note.textContent=answer.path?`${answer.path.links.length} shots · ${answer.path.players.map(name).join(' → ')}${answer.proven?'':'. A longer route may still exist.'}`:'No valid route found.';
  }).catch(error=>{if(section.isConnected)note.textContent=error.message});return;
 }
 const section=document.createElement('details');section.className='all-answers';
 const heading=document.createElement('summary');heading.textContent=lookup?'All shortest routes':'All shortest answers';section.open=Boolean(lookup);
 const summary=document.createElement('p');summary.textContent='Calculating every shortest route…';section.append(heading,summary);parent.append(section);
 const a=lookup?.start??start,b=lookup?.end??end,currentEngine=lookup?.engine??engine;
 // Let the completion message paint before calculating alternatives.
 setTimeout(()=>{
  if(!section.isConnected||(lookup&&!lookup.current()))return;
  const answers=currentEngine.allShortest(a,b),iterator=answers.routes();
  summary.textContent=`${answers.count.toLocaleString()} possible shortest ${answers.count===1n?'route':'routes'} · ${shotLabel(minimumShots(answers.distance))}. Longer detours are not listed. Team-season variants for the same player chain count as one answer.`;
  const list=document.createElement('ol');list.className='answer-list';
  const progress=document.createElement('p');progress.className='answer-progress';progress.setAttribute('aria-live','polite');
  const more=document.createElement('button');more.className='secondary';more.textContent='Show next 20 answers';
  let shown=0n;
  function batch(){for(let i=0;i<20;i++){const item=iterator.next();if(item.done)break;const li=document.createElement('li'),label=item.value.map(p=>name(p)).join(' → ');if(lookup){const button=document.createElement('button');button.type='button';button.className='lookup-route-option secondary';button.textContent=label;button.setAttribute('aria-label','Show route: '+label);button.onclick=()=>{if(lookup.current())lookup.select(item.value)};li.append(button)}else li.textContent=label;list.append(li);shown++}progress.textContent=`Showing ${shown.toLocaleString()} of ${answers.count.toLocaleString()} routes`;more.hidden=shown>=answers.count;}
  more.onclick=batch;section.append(list,progress,more);batch();
 },0);
}
async function share(){const text=`🏒 LINE CHANGE${mode==='daily'?` · ${date}`:' · FREE PLAY'}\n${name(start)} → ${name(end)}\n${'🟩'.repeat(Math.min(longest()?route.length-1:currentShortestScore(),12))}\n${longest()?snakeScore(gameStyle,routeLinks).value+' '+snakeScore(gameStyle,routeLinks).unit:shotLabel(currentShortestScore())+' · Shortest route '+shotLabel(optimal)+(mode==='daily'?' · '+dailyStars(currentShortestScore(),optimal,revealed)+' stars':'')}${longest()?' · '+styleNames[gameStyle]:gamePosition!=='any'?' · '+positionNames[gamePosition]:''} · ${hintsUsed} hints${mode==='daily'?`\n🔥 ${$('streak').textContent} day streak`:''}\n${mode==='free'?gameURL():location.origin}`;try{if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);status('Result copied. Share it with your locker room.')}}catch(e){if(e.name!=='AbortError'){status('Copy your result below.');const box=document.createElement('textarea');box.value=text;box.rows=6;box.style.width='100%';$('result').append(box);box.focus();box.select()}}}
function daily(){if(!data)return;longTarget=null;lookupRequest++;revision++;snake=null;gamePosition='any';lost=solving=false;closeExplorer();exploreSeasons.clear();explorePositions.clear();closeCompletion();clearChallengeURL();mode='daily';engine=createEngine(data);date=easternDate();$('daily').classList.add('active');$('free').classList.remove('active');$('setup').hidden=true;$('board').hidden=false;const dailyLevel=dailyDifficultyFor(data,date);$('date').textContent=`DAILY · ${date}${dailyLevel?' · '+dailyLevel.label.toUpperCase():''}`;[start,end,optimal]=puzzleFor(data,date);[start,end]=orderMatchup(data,start,end);optimal=minimumShots(optimal);const stored=read(key(),null);route=[start];rightRoute=[end];buildSide='start';shortHistory=[];routeLinks=[];finished=false;revealed=false;hintsUsed=0;strikes=0;hintedPlayers=new Set();
 if(stored?.finished&&Array.isArray(stored.route)&&stored.route[0]===end&&stored.route.at(-1)===start)stored.route=[...stored.route].reverse();
 if(stored&&Array.isArray(stored.route)&&stored.route[0]===start&&stored.route.every((p,i)=>data.players[p]&&(!i||engine.evidence(stored.route[i-1],p).length))){route=stored.route;hintsUsed=Number.isInteger(stored.hintsUsed)&&stored.hintsUsed>=0?stored.hintsUsed:0;hintedPlayers=new Set(stored.hintedPlayers||[]);revealed=stored.revealed===true;finished=(stored.finished===true&&route.at(-1)===end);if(revealed&&!finished){route=[start];revealed=false}}
 if(!finished&&Array.isArray(stored?.rightRoute)&&stored.rightRoute[0]===end&&stored.rightRoute.every((id,i)=>data.players[id]&&!route.includes(id)&&(id===end||matchesPosition(data.players[id],gamePosition))&&(!i||engine.evidence(stored.rightRoute[i-1],id).length)))rightRoute=stored.rightRoute;
 if(finished&&Array.isArray(stored?.shortHistory)&&stored.shortHistory.length===Math.max(0,route.length-2)&&stored.shortHistory.every(side=>side==='start'||side==='end'))shortHistory=[...stored.shortHistory];
 if(!finished){buildSide=stored?.buildSide==='end'?'end':'start';const history=stored?.shortHistory;shortHistory=Array.isArray(history)&&history.filter(x=>x==='start').length===route.length-1&&history.filter(x=>x==='end').length===rightRoute.length-1&&history.every(x=>x==='start'||x==='end')?history:[...Array(route.length-1).fill('start'),...Array(rightRoute.length-1).fill('end')];}
 strikes=Math.max(0,Math.min(3,Number.isInteger(stored?.strikes)?stored.strikes:0));if(strikes===3){finished=lost=true;}
 $('player-search').value='';$('player-results').replaceChildren();render();showStreak();status(finished?'Today’s attempt is saved. Come back tomorrow for a new matchup.':'Build your chain. Search any NHL player to add a link.');maybeShowIntro();}
function setupFree(){if(!data)return;longTarget=null;lookupRequest++;revision++;solving=false;closeExplorer();closeCompletion();clearChallengeURL();mode='free';selectedDecades=read('line-change-decades',allDecades);if(!Array.isArray(selectedDecades))selectedDecades=allDecades;selectedDecades=selectedDecades.filter(d=>allDecades.includes(d));engine=createEngine(data,selectedDecades);renderDecades();$('game-style').value=gameStyle;$('position-rule').value=position;renderSettings();$('difficulty').value=difficulty;$('setup-status').textContent='';$('daily').classList.remove('active');$('free').classList.add('active');$('setup').hidden=false;$('board').hidden=true;$('free-controls').hidden=true;$('date').textContent='FREE PLAY · YOUR MATCHUP';$('par').hidden=true;$('par').textContent='';selectedStart=selectedEnd=null;for(const id of ['start-search','end-search'])$(id).value='';for(const id of ['start-results','end-results'])$(id).replaceChildren();resetLookup();updateCustomButtons();$('random-free').disabled=!selectedDecades.length;}
function autocomplete(inputId,resultId,callback){const input=$(inputId),container=$(resultId);let timer;input.addEventListener('input',()=>{clearTimeout(timer);if(inputId==='start-search')selectedStart=null;if(inputId==='end-search')selectedEnd=null;if(inputId!=='player-search'){lookupRequest++;$('lookup-result').hidden=true;updateCustomButtons();}timer=setTimeout(()=>{container.replaceChildren();if(!engine)return;const custom=inputId!=='player-search';const searchEngine=custom?(customSearchEngine ||= createEngine(data,allDecades)):engine;const matches=searchEngine.search(input.value);const eligible=custom?new Set(playersFromEras(data,selectedDecades)):null;if(!matches.length&&input.value.trim()){const p=document.createElement('p');p.textContent='No matching players.';container.append(p)}for(const p of matches){const button=document.createElement('button');button.type='button';button.textContent=p.name;const details=document.createElement('small');details.textContent=`${p.position} · ${String(p.first).slice(0,4)}–${String(p.last).slice(-4)} · #${p.id}`;const endpointSeason=inputId==='end-search'?p.last:p.first;const neededDecade=Math.floor(Number(endpointSeason)/10000/10)*10;const outside=custom&&(gameStyle==='career'?!selectedDecades.includes(neededDecade):!eligible.has(p.id));if(outside)details.textContent+=` · Include ${neededDecade}s to select`;button.append(details);button.onclick=()=>{if(outside){selectedDecades=[...new Set([...selectedDecades,neededDecade])].sort((a,b)=>a-b);revision++;write('line-change-decades',selectedDecades);engine=createEngine(data,selectedDecades);renderDecades();$('random-free').disabled=false;$('setup-status').textContent=`Included ${neededDecade}s for ${p.name}${gameStyle==='career'?(inputId==='end-search'?"’s final season.":"’s rookie season."):'.'}`}container.replaceChildren();callback(p)};container.append(button)}},100)});input.addEventListener('keydown',e=>{if(e.key==='Escape')container.replaceChildren();if(e.key==='ArrowDown'){e.preventDefault();container.querySelector('button')?.focus()}});container.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...container.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}if(e.key==='Escape'){container.replaceChildren();input.focus()}})}
autocomplete('player-search','player-results',p=>add(p.id));
for(const side of ['start','end'])autocomplete(side+'-search',side+'-results',p=>{if(side==='start')selectedStart=p.id;else selectedEnd=p.id;$(side+'-search').value=p.name;updateCustomButtons()});
function clearChallengeURL(){const url=new URL(location.href);for(const k of ['start','end','decades','style','position'])url.searchParams.delete(k);history.replaceState(null,'',url);}
function updateCustomButtons(){if(selectedStart&&selectedEnd&&selectedStart!==selectedEnd){
 [selectedStart,selectedEnd]=orderMatchup(data,selectedStart,selectedEnd);
 $('start-search').value=name(selectedStart);$('end-search').value=name(selectedEnd);
 if(gameStyle==='career'){
  const required=[data.players[selectedStart][2],data.players[selectedEnd][3]].map(year=>Math.floor(Number(String(year).slice(0,4))/10)*10);
  if(required.some(decade=>!selectedDecades.includes(decade))){selectedDecades=[...new Set([...selectedDecades,...required])].sort((a,b)=>a-b);write('line-change-decades',selectedDecades);engine=createEngine(data,selectedDecades);renderDecades();$('random-free').disabled=false}
 }
 }const disabled=!selectedStart||!selectedEnd||selectedStart===selectedEnd;$('start-free').disabled=$('share-custom').disabled=disabled;$('challenge-link-box').hidden=true;$('lookup-submit').disabled=$('lookup-open').disabled=disabled;}
function resetLookup(){
 lookupRequest++;$('lookup-options').hidden=true;$('lookup-status').textContent='';$('lookup-result').hidden=true;
}
$('lookup-open').onclick=()=>{
 if(!selectedStart||!selectedEnd||selectedStart===selectedEnd)return;
 $('lookup-options').hidden=false;void $('lookup-submit').onclick();
};
$('lookup-style').onchange=()=>{
 lookupRequest++;$('lookup-result').hidden=true;$('lookup-status').textContent='';updateCustomButtons();
 $('lookup-rules').textContent=$('lookup-style').value==='career'?'Move forward from the starting player’s rookie season to the destination player’s final recorded season. Each player and season can be used once. All decades are included.':$('lookup-style').value==='road'?'Visit as many different teams as possible. Players and teams cannot repeat; seasons can move in either direction. All decades are included.':'Find the fewest player additions across all NHL seasons. No position restrictions.';
};
$('lookup-submit').onclick=async()=>{
 if(!selectedStart||!selectedEnd||selectedStart===selectedEnd)return;
 const request=++lookupRequest,a=selectedStart,b=selectedEnd,style=$('lookup-style').value||'shortest';
 $('lookup-submit').disabled=true;$('lookup-result').hidden=true;$('lookup-answers').replaceChildren();$('lookup-status').textContent='Finding connections…';
 try{
  const answer=await solve('lookup',{start:a,end:b,style,decades:allDecades});
  if(request!==lookupRequest)return;
  if(!answer.path){$('lookup-status').textContent=style==='career'?'No chronological route was found from this rookie season to that final recorded season. Try another pair or choose another lookup.':'No route was found under these rules. Try another pair or the shortest-route lookup.';return}
  const {players,links}=answer.path;
  $('lookup-heading').textContent=style==='shortest'?'Shortest route':answer.proven?'Longest possible route':'Longest route found';
  const teams=new Set(links.map(x=>x[0])).size,seasons=new Set(links.map(x=>x[1])).size;
  $('lookup-summary').textContent=`${name(a)} → ${name(b)} · ${players.length} players · ${style==='shortest'?shotLabel(answer.shots):style==='career'?seasons+' seasons':teams+' teams'}${style==='shortest'?'':answer.proven?' · Verified maximum.':' · A longer route may exist.'}`;
  renderRoute($('lookup-chain'),players,links,true);$('lookup-result').hidden=false;
  if(style==='shortest'){
   const lookupEngine=createEngine(data);
   appendAllAnswers($('lookup-answers'),{start:a,end:b,engine:lookupEngine,current:()=>request===lookupRequest,select:option=>{
    const evidence=option.slice(1).map((id,i)=>lookupEngine.evidence(option[i],id)[0].slice(0,2));renderRoute($('lookup-chain'),option,evidence,true);$('lookup-chain').scrollIntoView?.({behavior:'smooth',block:'center'});
   }});
  }
  $('lookup-status').textContent=style==='shortest'?'Every teammate connection is verified.':'Every connection follows the lookup rules. Long-route searches are bounded and show the best route found.';
 }catch(error){if(request===lookupRequest)$('lookup-status').textContent=error.message}
 finally{if(request===lookupRequest)updateCustomButtons()}
};
function beginFree(a,b,restriction=null){
 [a,b]=orderMatchup(data,a,b);
 closeExplorer();exploreSeasons.clear();explorePositions.clear();closeCompletion();revision++;solving=lost=false;
 gamePosition=snakeStyles.includes(gameStyle)?'any':restriction??(position==='random'?'any':position);
 if(gameStyle==='shortest'){const eligible=new Set(playersFromEras(data,selectedDecades));if(!eligible.has(a)||!eligible.has(b)){$('setup-status').textContent='Choose starting and destination players who appeared in your selected eras.';return false}}
 engine=createEngine(data,gameStyle==='shortest'?allDecades:selectedDecades,{position:gamePosition,start:a,end:b});snake=snakeStyles.includes(gameStyle)?createSnake(data,selectedDecades,gameStyle):null;
 const path=snake?snake.finish(snake.context(a,b)).path?.players:engine.shortest(a,b);
 if(!path||path.length<2){$('setup-status').textContent=snake?'No valid route was found under these Snake rules. Career Run needs both endpoint seasons in your selected decades. Try different players or eras.':'No route exists under this position rule. Choose another position or different players.';return false}
 longTarget=null;mode='free';start=a;end=b;optimal=snake?path.length-1:minimumShots(path.length-1);route=[start];rightRoute=[end];buildSide='start';shortHistory=[];routeLinks=[];finished=revealed=false;strikes=0;hintsUsed=0;hintedPlayers=new Set();
 $('daily').classList.remove('active');$('free').classList.add('active');$('setup').hidden=true;$('board').hidden=false;$('date').textContent=snake?styleNames[gameStyle].toUpperCase():'FREE PLAY · SHORTEST CHAIN';
 $('player-search').value='';$('player-results').replaceChildren();history.replaceState(null,'',gameURL());
 render();status('Explore a season or search for your next player.');if(snake)void findLongTarget();maybeShowIntro();requestAnimationFrame(()=>$('board').scrollIntoView?.({behavior:'smooth',block:'start'}));return true;
}
async function randomFree(){
 const generation=revision,style=gameStyle,decades=[...selectedDecades],pool=difficultyPool(data,difficulty);
 const restrictions=style==='shortest'?(position==='random'?(()=>{if(!randomRuleBag.length){randomRuleBag=[...positions];for(let i=randomRuleBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[randomRuleBag[i],randomRuleBag[j]]=[randomRuleBag[j],randomRuleBag[i]]}}return [...randomRuleBag,...positions.filter(value=>!randomRuleBag.includes(value))]})():[position]):['any'];
 $('random-free').disabled=$('random-again').disabled=true;status('Finding a playable matchup…');$('setup-status').textContent='Finding a playable matchup…';
 try{
  let pair=null,restriction='any';for(const value of restrictions){if(generation!==revision)return;restriction=value;pair=await solve('random',{style,decades,pool,position:value,recentPlayers:recentRandomGames.flat(),recentMatchups:recentRandomGames.map(pair=>[...pair].sort((a,b)=>a-b).join(':'))});if(pair||generation!==revision)break}
  if(generation!==revision)return;
  if(!pair){const message='No playable matchup is available with these rules and difficulty in your selected decades. Add decades or increase the difficulty.';$('setup-status').textContent=message;status(message,true);return}
  if(style==='shortest'&&position==='random')randomRuleBag=randomRuleBag.filter(value=>value!==restriction);
  if(beginFree(pair.start,pair.end,restriction)){recentRandomGames.push([pair.start,pair.end]);recentRandomGames=recentRandomGames.slice(-8);write('line-change-random-history',recentRandomGames);}
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
$('daily').onclick=daily;$('free').onclick=setupFree;$('connect').onclick=()=>add(oppositePlayer());$('undo').onclick=()=>{if(finished||solving||(longest()?route.length<2:!shortHistory.length)||(longest()&&['open','career'].includes(gameStyle)))return;if(longest()){route.pop();routeLinks.pop()}else{buildSide=shortHistory.pop();(buildSide==='end'?rightRoute:route).pop()}save();render();status('Last link removed.')};
$('give-up').onclick=async()=>{
 if(solving||finished||!confirm(`Reveal ${longest()?'the longest route found':'the shortest route'}? This ends your attempt.`))return;
 const generation=revision;
 if(!longest()){route=engine.shortest(start,end);rightRoute=[];buildSide='start';routeLinks=[];finished=revealed=true;save();render();status('Shortest route revealed, with team-season evidence.');return}
 solving=true;render();status('Finding a long valid route…');
 try{
  const result=await solve('longest',{decades:selectedDecades,style:gameStyle,start,end,route:[...route],links:[...routeLinks]});
  if(generation!==revision)return;
  if(!result.path){status('No finish was found from this chain. Restart the matchup to try again.',true);return}
  route=[...route.slice(0,-1),...result.path.players];routeLinks=[...routeLinks,...result.path.links];finished=revealed=true;save();status(result.proven?'Longest possible continuation revealed.':'Longest continuation found. A longer route may still exist.');
 }catch(error){if(generation===revision)status(error.message,true)}finally{if(generation===revision){solving=false;render()}}
};
$('hint').onclick=()=>{if(finished||solving)return;const current=currentPlayer(),finish=finishPath(),path=finish?.players,teams=path?.length>1?(longest()?[finish.links[0][0]]:[...new Set(engine.evidence(current,path[1]).map(g=>g[0]))]):[];if(!teams.length){status('No legal finish remains. Restart this matchup.',true);return}if(!hintedPlayers.has(current)){hintedPlayers.add(current);hintsUsed++}save();$('hint').textContent='Team hint';$('hint-text').hidden=false;$('hint-text').textContent='Your next link on one shortest route shares: '+teams.map(t=>data.teams[t]||t).join(' or ')+'. Find a player who connects here.'};
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
   const allowed=document.createElement('div');allowed.className='endpoint-years';if(canExplore()){for(const year of record.allowed){const button=document.createElement('button');button.type='button';button.className='season-link';button.textContent=season(year);button.disabled=!seasonExploreAllowed(year);button.setAttribute('aria-label',`Explore ${data.teams[record.team]||record.team} ${season(year)} roster`);button.onclick=()=>openExplorer({kind:'roster',playerId:id,team:record.team,year,query:''});allowed.append(button)}}else{const text=document.createElement('strong');text.textContent=seasonRanges(record.allowed);allowed.append(text)}if(record.allowed.length)row.append(allowed);
   const outside=record.seasons.filter(s=>!record.allowed.includes(s));if(outside.length){const rest=document.createElement('span');rest.className='endpoint-years outside-years';rest.textContent=seasonRanges(outside);row.append(rest)}details.append(row);
  }
  const note=document.createElement('small');note.textContent=canExplore()?(longest()?'Tap a bold season to explore its roster. Grey seasons cannot be used for your next shot.':'All seasons are available. Tap a season to explore its roster.'):(longest()?'Bold teams and seasons count in this game.':'All NHL seasons count in this game.');details.append(note);
}
function gapArrow(double=true){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 24');svg.setAttribute('aria-hidden','true');
 for(const [d,dash] of [['M 15 12 H 85',true],[double?'M 15 2 L 4 12 L 15 22 M 85 2 L 96 12 L 85 22':'M 85 2 L 96 12 L 85 22',false]]){
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');if(dash)path.setAttribute('stroke-dasharray','7 5');svg.append(path);
 }
 return svg;
}
function explorerSideFor(id){
 if(longest())return 'start';
 if(id==null)return buildSide;
 if(id===start||id===route.at(-1))return 'start';
 if(id===end||id===rightRoute.at(-1))return 'end';
 return buildSide;
}
function prepareExplorerView(view,side){
 const next={...view,buildSide:view.buildSide??side};
 if(next.kind==='roster')next.playerId??=next.buildSide==='end'?rightRoute.at(-1):route.at(-1);
 return next;
}
function rememberedExplorerPlayer(id){
 const side=explorerSideFor(id),saved=exploreSeasons.get(`${side}:${id}`);
 return saved?{...saved}:{kind:'player',id,buildSide:side};
}
function restoreExplorerSide(view){
 if(longest()||finished||solving||!view?.buildSide||view.buildSide===buildSide)return;
 buildSide=view.buildSide;save();render();
}
function browseExplorerPlayer(id,connection){$('explore-feedback').hidden=true;visitExplorer({kind:'player',id,connection,buildSide:exploreStack.at(-1)?.buildSide??buildSide});}
function addExplorerPlayer(){
 const view=exploreStack.at(-1);if(view?.kind!=='player')return;
 restoreExplorerSide(view);
 if(!canAttemptPlayer(view.id))return;
 rememberExplorerPosition();const previous=currentPlayer(),result=add(view.id,view.connection);if(result?.then){return result.then(()=>{if(!finished&&currentPlayer()!==previous){exploreStack=[prepareExplorerView({kind:'player',id:currentPlayer()},buildSide)];renderExplorer();restoreExplorerPosition();}})}
 if(!finished&&currentPlayer()!==previous){exploreStack=[prepareExplorerView({kind:'player',id:currentPlayer()},buildSide)];renderExplorer();restoreExplorerPosition();}
}
function undoExplorerLink(){
 $('undo').onclick();exploreSeasons.clear();exploreStack=[prepareExplorerView({kind:'player',id:currentPlayer()},buildSide)];renderExplorer();restoreExplorerPosition();
}
function renderExplorerChain(view){
 const strip=$('explore-chain');strip.replaceChildren();
 const pending=!finished&&route.at(-1)!==end,players=pending?[...route,...[...rightRoute].reverse()]:route,active=currentPlayer();
 for(let i=0;i<players.length;i++){
  const id=players[i],item=document.createElement('div'),button=document.createElement('button'),caption=document.createElement('span');
  item.className='explore-chain-player';item.dataset.playerId=id;
  button.type='button';button.className='explore-chain-head'+(id===active?' selected-origin':'');button.setAttribute('aria-label','Explore '+name(id));button.setAttribute('aria-pressed',String(id===active));button.append(chainPortrait(id,endpointLinkedTeam(id,i,players,pending)));caption.textContent=name(id)+(longest()&&gameStyle==='career'&&(id===start||id===end)?' '+season(id===start?snakeContext().bounds.first:snakeContext().bounds.last):'');button.append(caption);
  button.onclick=()=>{rememberExplorerPosition();visitExplorer(rememberedExplorerPlayer(id));};item.append(button);strip.append(item);
  if(i<players.length-1){
   const link=document.createElement('div'),gap=pending&&i===route.length-1;link.className='explore-chain-link';
   if(gap){link.className+=' unconnected';link.append(gapArrow(!longest()))}else{
    const [team,year]=longest()?routeLinks[i]:engine.evidence(id,players[i+1])[0];
    const before=document.createElement('span'),after=document.createElement('span'),middle=document.createElement('span'),yearLabel=document.createElement('small');before.textContent=after.textContent='→';before.setAttribute('aria-hidden','true');after.setAttribute('aria-hidden','true');middle.className='explore-chain-team';middle.append(teamLogo(team,data.teams[team]||team));yearLabel.textContent=season(year);middle.append(yearLabel);link.append(before,middle,after);
   }
   strip.append(link);
  }
 }
 const rule=activePositionRule();$('explore-position-rule').hidden=!rule;$('explore-position-rule').textContent=rule;
 $('explore-target').hidden=longest();$('explore-target').textContent=longest()?'':`Shortest possible route: ${shotLabel(optimal)}${mode==='free'&&shortestOnly?' · Shortest route only':''}`;
}
function closeExplorer(){rememberExplorerPosition();exploreStack=[];if($('explorer').open)$('explorer').close();}
function explorerViewKey(view){return view.kind==='roster'?JSON.stringify(['roster',view.buildSide??buildSide,view.playerId,view.team,view.year,view.query||'']):JSON.stringify(['player',view.buildSide??buildSide,view.id]);}
function rememberExplorerPosition(){const view=exploreStack.at(-1);if(view&&$('explorer').open){explorePositions.set(explorerViewKey(view),$('explorer').scrollTop||0);if(view.kind==='roster')exploreSeasons.set(`${view.buildSide}:${view.playerId}`,{...view});}}
function restoreExplorerPosition(){
 const view=exploreStack.at(-1);if(!view)return;
 const top=explorePositions.get(explorerViewKey(view))||0;
 $('explorer').scrollTop=top;
 requestAnimationFrame(()=>{if($('explorer').open&&exploreStack.at(-1)===view)$('explorer').scrollTop=top;});
}
function openExplorer(view){
 if(!canExplore()||(view.kind==='roster'&&!seasonExploreAllowed(view.year)))return;
 rememberExplorerPosition();const id=view.kind==='player'?view.id:view.playerId;
 const root=prepareExplorerView(view,explorerSideFor(id)),saved=view.kind==='player'?rememberedExplorerPlayer(id):null;
 exploreStack=saved?.kind==='roster'?[root,saved]:[root];renderExplorer();
 if(!$('explorer').open){$('explorer').showModal();$('close-explorer').focus({preventScroll:true});}restoreExplorerPosition();
}
function visitExplorer(view){
 if(view.kind==='roster'&&!seasonExploreAllowed(view.year))return;
 rememberExplorerPosition();exploreStack.push(prepareExplorerView(view,exploreStack.at(-1)?.buildSide??buildSide));renderExplorer();restoreExplorerPosition();
}
function rosterNavigation(view){
 const playerId=view.playerId??currentPlayer();
 const rosters=historyFor(playerId).flatMap(record=>record.allowed.map(year=>({kind:'roster',playerId,team:record.team,year,query:'',buildSide:view.buildSide}))).sort((a,b)=>a.year-b.year||a.team.localeCompare(b.team));
 const index=rosters.findIndex(item=>item.team===view.team&&item.year===view.year);
 return {playerId,rosters,index};
}
function changeExplorerSeason(direction){
 const view=exploreStack.at(-1);if(view?.kind!=='roster')return;
 const {rosters,index}=rosterNavigation(view);const next=rosters[index+direction];if(index<0||!next)return;
 rememberExplorerPosition();exploreStack[exploreStack.length-1]=next;renderExplorer();restoreExplorerPosition();
}
function renderExplorer(){
 const view=exploreStack.at(-1);if(!view)return;restoreExplorerSide(view);
 const bounds=longest()&&gameStyle==='career'?snakeContext().bounds:null;

 renderExplorerChain(view);
 renderStrikeMarks($('explore-strikes'));$('explore-add').disabled=view.kind!=='player'||!canAttemptPlayer(view.id);$('explore-undo').disabled=finished||solving||(longest()?route.length<2||['open','career'].includes(gameStyle):!shortHistory.length);
 $('explore-step').hidden=!longest();
 $('explore-step').textContent=bounds?(routeLinks.length?`Next shot: a later season than ${season(routeLinks.at(-1)[1])}, ending by ${season(bounds.last)}.`:`First shot: ${name(start)}’s rookie season, ${season(bounds.first)}.`):longest()?`${styleNames[gameStyle]} · ${routeLinks.length} shots taken.`:`Shortest route: ${shotLabel(optimal)}.`;

 $('explore-back').disabled=exploreStack.length<2;$('explore-content').replaceChildren();$('roster-search-box').hidden=view.kind!=='roster';
 $('explore-season-nav').hidden=false;$('explore-prev-season').hidden=$('explore-next-season').hidden=view.kind!=='roster';
 if(view.kind==='roster'){
  const {playerId,rosters,index}=rosterNavigation(view);
  $('explore-prev-season').disabled=index<=0;
  $('explore-next-season').disabled=index<0||index>=rosters.length-1;
  $('explore-season-context').textContent=index<0?'Roster':`${index+1} of ${rosters.length}`;
 }
 const content=$('explore-content');
 if(view.kind==='roster'){
  $('explore-title').textContent=`${data.teams[view.team]||view.team} · ${season(view.year)}`;$('roster-search').value=view.query||'';
  renderRoster();
 }else{
  $('explore-title').textContent=name(view.id);const profile=document.createElement('div');profile.className='explore-profile';if(longest())profile.append(portrait(view.id,name(view.id)));
  content.append(profile);

  for(const record of historyFor(view.id)){
   const row=document.createElement('div');row.className='explore-career-team'+(record.allowed.length?'':' inactive-history');const title=document.createElement(record.allowed.length?'strong':'span');title.textContent=data.teams[record.team]||record.team;row.append(teamLogo(record.team,title.textContent),title);content.append(row);
   const seasons=document.createElement('div');seasons.className='explore-seasons';for(const year of record.seasons){const allowed=record.allowed.includes(year)&&seasonExploreAllowed(year),link=document.createElement(allowed?'button':'span');link.textContent=season(year);if(allowed){link.type='button';link.className='season-link';link.setAttribute('aria-label',`Explore ${title.textContent} ${season(year)} roster`);link.onclick=()=>visitExplorer({kind:'roster',playerId:view.id,team:record.team,year,query:''})}else link.className='outside-years';seasons.append(link)}content.append(seasons);
  }
 }
}
function renderRoster(){
 const view=exploreStack.at(-1);if(view?.kind!=='roster')return;let list=$('explore-roster');if(!list){list=document.createElement('div');list.id='explore-roster';$('explore-content').append(list)}list.replaceChildren();
 const blocked=id=>!!activePositionRule()&&id!==start&&id!==end&&!matchesPosition(data.players[id],gamePosition);
 const rank=id=>blocked(id)?2:usedPlayers().includes(id)&&id!==end?1:0;
 const ids=rosterFor(data,view.team,view.year,activeDecades()).filter(id=>matchesPlayerName(id,name(id),view.query||'')).sort((a,b)=>rank(a)-rank(b));
 const count=document.createElement('p');count.className='explore-note';count.setAttribute('role','status');count.textContent=ids.length?`${ids.length} ${ids.length===1?'player':'players'}`:'No players match this search.';list.append(count);
 for(const id of ids){const button=document.createElement('button');button.className='roster-player'+(blocked(id)?' position-excluded':usedPlayers().includes(id)&&id!==end?' roster-used':'');button.dataset.playerId=id;button.type='button';const body=document.createElement('span'),title=document.createElement('strong'),label=document.createElement('small');title.textContent=name(id);label.textContent=data.players[id][1]+(id===end?' · Destination':usedPlayers().includes(id)?' · Already used':blocked(id)?'':'');body.append(title,label);button.append(portrait(id,name(id)),body);button.onclick=()=>browseExplorerPlayer(id,[view.team,view.year]);list.append(button)}
}
$('shortest-only').onchange=()=>{shortestOnly=$('shortest-only').checked;write('line-change-shortest-only',shortestOnly);render();if($('explorer').open)renderExplorer();status(shortestOnly?'Shortest route only: detours earn an X.':'Longer detours are allowed. Dead ends still earn an X.');};
$('explore-add').onclick=addExplorerPlayer;
$('explore-undo').onclick=undoExplorerLink;
$('close-explorer').onclick=closeExplorer;
$('explore-prev-season').onclick=()=>changeExplorerSeason(-1);
$('explore-next-season').onclick=()=>changeExplorerSeason(1);
$('explore-back').onclick=()=>{if(exploreStack.length>1){rememberExplorerPosition();exploreStack.pop();renderExplorer();restoreExplorerPosition()}};
$('explorer').addEventListener('scroll',rememberExplorerPosition);
$('explorer').addEventListener('close',()=>{if(!$('explorer').open){exploreStack=[]}});
$('roster-search').oninput=()=>{const view=exploreStack.at(-1);if(view?.kind==='roster'){rememberExplorerPosition();view.query=$('roster-search').value;renderRoster();restoreExplorerPosition()}};
function finishPath(){return longest()?snake.finish(snakeContext()).path:{players:engine.shortest(currentPlayer(),oppositePlayer(),[...route.slice(0,-1),...rightRoute.slice(0,-1)])}}
function nextHint(){return finishPath()?.players}
function countExploreHint(type){const key=type+':'+currentPlayer();if(!hintedPlayers.has(key)){hintedPlayers.add(key);hintsUsed++;save()}}
$('roster-hint').onclick=()=>{if(finished||solving)return;const finish=finishPath(),path=finish?.players;if(!path||path.length<2)return;const [team,year]=longest()?finish.links[0]:engine.evidence(path[0],path[1])[0];countExploreHint('roster');openExplorer({kind:'roster',team,year,query:''})};
$('player-hint').onclick=()=>{if(finished||solving)return;const path=nextHint();if(!path||path.length<2)return;countExploreHint('player');openExplorer({kind:'player',id:path[1]})};
$('game-style').onchange=()=>{revision++;gameStyle=$('game-style').value;write('line-change-style',gameStyle);renderSettings();if(snakeStyles.includes(gameStyle)){selectedDecades=[...allDecades];renderDecades();changeDecades();$('setup-status').textContent='All decades selected for Snake. You can narrow them above.'}};
$('position-rule').onchange=()=>{revision++;position=$('position-rule').value;write('line-change-position',position);write('line-change-position-explicit',true)};
$('restart-game').onclick=$('completion-restart').onclick=()=>beginFree(start,end,gamePosition);
$('difficulty').onchange=()=>{revision++;difficulty=$('difficulty').value;write('line-change-difficulty',difficulty)};
$('close-completion').onclick=$('view-completed-route').onclick=closeCompletion;
$('completion-share').onclick=()=>{closeCompletion();share()};
$('intro-start').onclick=$('close-intro').onclick=()=>{acknowledgeIntro();$('intro-rules').close()};
$('intro-rules').addEventListener('close',acknowledgeIntro);
$('help').onclick=()=>$('rules').showModal();$('close-help').onclick=()=>$('rules').close();
async function load(){try{const r=await fetch('data/hockey.json',{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();const schedule=await fetch('data/daily-puzzles.json',{cache:'no-cache'});if(!schedule.ok)throw Error('Puzzle schedule unavailable');data.dailySchedule=await schedule.json();const depth=await fetch('data/player-depth.json',{cache:'no-cache'});if(!depth.ok)throw Error('Player difficulty data unavailable');data.playerDepth=await depth.json();engine=createEngine(data);const shared=parseChallenge(location.href,data);if(shared){gameStyle=shared.style==='longest'?'open':shared.style||'shortest';selectedDecades=shared.decades;engine=createEngine(data,selectedDecades);if(!beginFree(shared.start,shared.end,shared.position||'any')){setupFree();$('setup-status').textContent='No route exists for this shared matchup. Choose new players or decades.'}showStreak()}else daily()}catch(e){if(data?.playerDepth){setupFree();$('setup-status').textContent=e.message;return}status('The hockey data couldn’t load. Check your connection and try again.',true);const b=document.createElement('button');b.textContent='Retry';b.onclick=()=>{b.remove();load()};$('status').after(b)}}
load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mode==='daily'&&data&&date!==easternDate())daily()});
