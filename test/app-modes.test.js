import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as core from '../public/core.js';
import * as challenges from '../public/challenges.js';
import * as presentation from '../public/presentation.js';
import * as explore from '../public/explore.js';
import * as modes from '../public/modes.js';
import {createSnake} from '../public/snake.js';
import {lookupConnection} from '../public/lookup.js';

// A small DOM double exercises the actual app handlers without a browser,
// network access, or changing anyone's saved daily attempt.
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.open=false;this.hidden=false;this.value='';this._text='';this.isConnected=true;this.listeners={};this.classList={add(){},remove(){},toggle(){}}}
 set textContent(value){this._text=String(value);this.children=[]}
 get textContent(){return this._text+this.children.map(x=>typeof x==='string'?x:x.textContent).join('')}
 append(...items){this.children.push(...items)}
 replaceChildren(...items){this._text='';this.children=items}
 setAttribute(key,value){this[key]=value}
 addEventListener(type,fn){this.listeners[type]=fn}
 showModal(){this.open=true}
 close(){this.open=false;this.listeners.close?.()}
 querySelectorAll(selector){const all=this.children.filter(x=>typeof x!=='string').flatMap(x=>[x,...x.querySelectorAll('*')]);return selector==='*'?all:selector==='.chain-teams[open]'?all.filter(x=>x.className?.includes('chain-teams')&&x.open):[]}
 querySelector(){return null}
 focus(){}
 select(){}
}
function app(){
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(x=>[x[1],new Element()]));
 const document={getElementById:id=>{assert.ok(elements.has(id),'Missing HTML element '+id);return elements.get(id)},createElement:tag=>new Element(tag),createTextNode:text=>text,addEventListener(){}};
 const storage=new Map([['line-change-explore','false'],['line-change-daily-explore','false']]),location={href:'https://example.com/',origin:'https://example.com'},localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 class Worker{
  postMessage(request){if(request.type==='init'){this.data=request.data;return}queueMicrotask(()=>{if(request.type==='lookup'){this.onmessage?.({data:{id:request.id,result:lookupConnection(this.data,request)}});return}const game=createSnake(this.data,request.decades,request.style);this.onmessage?.({data:{id:request.id,result:request.type==='finish'?game.finish(game.context(request.start,request.end,request.route,request.links)):game.longest(game.context(request.start,request.end,request.route,request.links),{seedPath:request.seedPath,budgetMs:20})}})})}
  terminate(){}
 }
 const timers=[];
 const bindings={timers,...core,...challenges,...presentation,...explore,...modes,createSnake,document,localStorage,location,history:{replaceState(){}},Worker,URL,confirm:()=>true,navigator:{},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},requestAnimationFrame:fn=>fn(),portrait:()=>new Element('span'),teamLogo:()=>new Element('span')};
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/import\.meta\.url/g,"'https://example.com/app.js'").replace(/load\(\);document\.addEventListener\('visibilitychange',[\s\S]*$/,'');
 const api=new Function(...Object.keys(bindings),source+`;return {selectDecades(ds){selectedDecades=ds;changeDecades()},flushTimers(){while(timers.length)timers.shift()()},seedDaily(record){write(key(),record)},setupFree,beginFree,add,daily,openExplorer,fillTeamDetails,seasonExploreAllowed,configure(d,style,restriction='any'){data=d;gameStyle=style;selectedDecades=[2010];position=restriction;mode='free'},state(){return {route:[...route],links:[...routeLinks],finished,lost,gamePosition}},element:id=>$(id)};`)(...Object.values(bindings));return api;
}
const graph={version:'test',teams:{A:'Team A',B:'Team B',C:'Team C',D:'Team D'},puzzles:[[1,4,3]],players:{1:['Start','C',20102011,20102011],2:['Bridge','D',20102011,20122013],3:['Next','G',20122013,20132014],4:['End','C',20132014,20132014],5:['Trap','D',20102011,20142015],6:['Other','R',20142015,20142015]},groups:[['A',20102011,[1,2,5]],['B',20122013,[2,3]],['C',20132014,[3,4]],['D',20142015,[5,6]]]};
test('Lookup renders an answer without modifying the chain or opening completion',async()=>{
 const ui=app();ui.configure(graph,'shortest');ui.daily();const before=ui.state();ui.setupFree();
 assert.equal(ui.element('lookup-options').hidden,true);assert.equal(ui.element('lookup-open').disabled,true);assert.ok(!ui.element('custom-actions').hidden);
 for(const [side,query] of [['start','Start'],['end','End']]){ui.element(side+'-search').value=query;ui.element(side+'-search').listeners.input();ui.flushTimers();ui.element(side+'-results').children.find(x=>x.tagName==='button').onclick()}
 assert.equal(ui.element('lookup-submit').disabled,false);
 ui.element('lookup-open').onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.element('lookup-options').hidden,false);assert.equal(ui.element('lookup-result').hidden,false);assert.equal(ui.element('lookup-heading').textContent,'Shortest route');assert.match(ui.element('lookup-summary').textContent,/2 shots/);
 assert.equal(ui.element('lookup-chain').children.filter(x=>x.dataset.playerId).length,4);assert.deepEqual(ui.state(),before);assert.equal(ui.element('completion').open,false);
 for(const style of ['career','road']){ui.element('lookup-style').value=style;ui.element('lookup-style').onchange();await ui.element('lookup-submit').onclick();assert.equal(ui.element('lookup-result').hidden,false);assert.match(ui.element('lookup-summary').textContent,style==='career'?/3 seasons/:/3 teams/)}
});
test('Changing a lookup while it is searching discards its stale result',async()=>{
 const ui=app();ui.configure(graph,'shortest');ui.setupFree();
 for(const [side,query] of [['start','Start'],['end','End']]){ui.element(side+'-search').value=query;ui.element(side+'-search').listeners.input();ui.flushTimers();ui.element(side+'-results').children.find(x=>x.tagName==='button').onclick()}
 const pending=ui.element('lookup-submit').onclick();ui.element('lookup-style').value='road';ui.element('lookup-style').onchange();await pending;
 assert.equal(ui.element('lookup-result').hidden,true);assert.equal(ui.element('lookup-submit').disabled,false);
});
test('Shortest lookup lists every option in batches and selecting one updates its visual route',async()=>{
 const bridges=Array.from({length:25},(_,i)=>i+2),d={...graph,players:{1:['Start','C',20102011,20102011],100:['End','C',20112012,20112012],...Object.fromEntries(bridges.map(id=>[id,['Bridge '+id,'D',20102011,20112012]]))},groups:bridges.flatMap(id=>[['A',20102011,[1,id]],['B',20112012,[id,100]]])};
 const ui=app();ui.configure(d,'shortest');ui.setupFree();
 for(const [side,query] of [['start','Start'],['end','End']]){ui.element(side+'-search').value=query;ui.element(side+'-search').listeners.input();ui.flushTimers();ui.element(side+'-results').children.find(x=>x.tagName==='button').onclick()}
 await ui.element('lookup-submit').onclick();ui.flushTimers();
 const section=ui.element('lookup-answers').children[0],list=section.children.find(x=>x.className==='answer-list'),more=section.children.find(x=>x.tagName==='button'),progress=section.children.find(x=>x.className==='answer-progress');
 assert.equal(section.open,true);assert.match(section.textContent,/25 possible shortest routes/);assert.equal(list.children.length,20);assert.equal(more.hidden,false);
 more.onclick();assert.equal(list.children.length,25);assert.equal(more.hidden,true);assert.equal(progress.textContent,'Showing 25 of 25 routes');
 const option=list.children[24].children[0];option.onclick();assert.match(option.textContent,/Bridge/);
 const shown=ui.element('lookup-chain').children.filter(x=>x.dataset.playerId).map(x=>x.textContent);assert.equal(shown.length,3);assert.ok(option.textContent.includes(shown[1].replace('CONNECTION','')));
 ui.element('lookup-style').value='road';ui.element('lookup-style').onchange();const before=ui.element('lookup-chain').textContent;list.children[0].children[0].onclick();assert.equal(ui.element('lookup-chain').textContent,before);
});
test('Custom search finds Palffy outside selected eras and includes his rookie era on selection',()=>{
 const d={...graph,players:{...graph.players,8458540:['Ziggy Palffy','R',19931994,20052006]},groups:[...graph.groups,['A',19931994,[8458540,1]]]};
 const ui=app();ui.configure(d,'career');ui.setupFree();
 // Keep only modern eras before searching through the actual autocomplete handler.
 ui.selectDecades([2010,2020]);
 ui.element('start-search').value='Žigmund Palffy';ui.element('start-search').listeners.input();ui.flushTimers();
 const result=ui.element('start-results').children.find(x=>x.tagName==='button');assert.ok(result);assert.match(result.textContent,/Ziggy Palffy/);assert.match(result.textContent,/Include 1990s to select/);
 result.onclick();assert.equal(ui.element('start-search').value,'Ziggy Palffy');assert.match(ui.element('setup-status').textContent,/Included 1990s.*rookie season/);
});
test('Career Run app ends a dead run, shows restart, blocks undo, and resets the same matchup',()=>{
 const ui=app();ui.configure(graph,'career');assert.equal(ui.beginFree(1,4),true);assert.equal(ui.element('undo').hidden,true);
 ui.element('close-intro').onclick();ui.add(5,['A',20102011]);assert.equal(ui.state().lost,true);assert.equal(ui.state().finished,true);assert.equal(ui.element('completion').open,true);assert.equal(ui.element('completion-title').textContent,'Run over.');assert.equal(ui.element('completion-restart').hidden,false);assert.equal(ui.element('completion-share').hidden,true);
 ui.element('completion-restart').onclick();assert.deepEqual(ui.state().route,[1]);assert.equal(ui.state().lost,false);assert.equal(ui.element('completion').open,false);
 ui.add(2,['A',20102011]);ui.element('undo').onclick();assert.deepEqual(ui.state().route,[1,2]);ui.add(3,['B',20122013]);assert.equal(ui.state().finished,false);ui.add(4,['C',20132014]);assert.equal(ui.element('completion-title').textContent,'You’re connected!');assert.equal(ui.element('completion-shots').textContent,'3 seasons');assert.equal(ui.state().lost,false);
});
test('Open Ice app leaves a close-to-end chain open, counts shots, and labels its answer correctly',async()=>{
 const ui=app();ui.configure(graph,'open');assert.equal(ui.beginFree(1,4),true);ui.element('close-intro').onclick();ui.add(2);await new Promise(resolve=>setImmediate(resolve));ui.add(3);await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.state().finished,false);assert.equal(ui.element('give-up').textContent,'Reveal longest route');assert.equal(ui.element('par').textContent,'MOST SHOTS');assert.ok(ui.element('chain').children.some(x=>x.dataset.playerId===3));ui.add(4);assert.equal(ui.state().finished,true);assert.equal(ui.element('completion-shots').textContent,'3 shots');await Promise.resolve();
});
test('Shortest Chain app enforces restricted bridges, auto-finishes, and Daily restores Open Roster',()=>{
 const d={...graph,puzzles:[[1,4,2]],groups:[['A',20102011,[1,2,3]],['B',20112012,[2,4]],['C',20112012,[3,4]]]};
 const ui=app();ui.configure(d,'shortest','goalie');assert.equal(ui.beginFree(1,4),true);ui.element('close-intro').onclick();ui.add(2);assert.deepEqual(ui.state().route,[1]);ui.add(3);assert.deepEqual(ui.state().route,[1,3,4]);assert.equal(ui.state().finished,true);assert.equal(ui.element('completion-shots').textContent,'1 shot');ui.daily();assert.equal(ui.state().gamePosition,'any');assert.equal(ui.element('give-up').textContent,'Reveal shortest route');
});

test('Open Ice accepts a risky shot then ends the round on a proven dead end, with restart and no undo',async()=>{
 const ui=app();ui.configure(graph,'open');ui.beginFree(1,4);ui.element('close-intro').onclick();assert.equal(ui.element('undo').hidden,true);
 ui.add(5,['A',20102011]);assert.deepEqual(ui.state().route,[1,5]);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.state().lost,true);assert.equal(ui.state().finished,true);assert.equal(ui.element('completion-title').textContent,'Run over.');assert.equal(ui.element('completion-shots').textContent,'1 shot');
 ui.element('undo').onclick();assert.deepEqual(ui.state().route,[1,5]);ui.element('completion-restart').onclick();assert.deepEqual(ui.state().route,[1]);assert.equal(ui.state().lost,false);
});
test('Career Run exploration restricts the first shot to rookie year and keeps the dated goal visible',()=>{
 const d={...graph,groups:[...graph.groups,['E',20112012,[1,6]]]};const ui=app();ui.configure(d,'career');assert.equal(ui.beginFree(1,4),true);
 assert.equal(ui.seasonExploreAllowed(20102011),true);assert.equal(ui.seasonExploreAllowed(20112012),false);
 ui.openExplorer({kind:'player',id:1});assert.equal(ui.element('explore-goal').textContent,'Trying to connect Start 2010–11 to End 2013–14.');
 const buttons=ui.element('explore-content').querySelectorAll('*').filter(x=>x.tagName==='button'&&x.className==='season-link');assert.deepEqual(buttons.map(x=>x.textContent),['2010–11']);
 const details=new Element('details');ui.fillTeamDetails(details,1);const inline=details.querySelectorAll('*').filter(x=>x.tagName==='button');assert.equal(inline.some(x=>x.textContent==='2011–12'),false);assert.ok(details.querySelectorAll('*').some(x=>x.className==='endpoint-years outside-years'&&x.textContent==='2011–12'));
 ui.openExplorer({kind:'roster',team:'E',year:20112012});assert.equal(ui.element('explore-title').textContent,'Start');
 ui.add(2,['A',20102011]);assert.equal(ui.seasonExploreAllowed(20102011),false);assert.equal(ui.seasonExploreAllowed(20122013),true);assert.equal(ui.seasonExploreAllowed(20142015),false);
 ui.openExplorer({kind:'player',id:2});assert.match(ui.element('explore-step').textContent,/later season than 2010/);assert.equal(ui.element('explore-goal').textContent,'Trying to connect Start 2010–11 to End 2013–14.');
});
test('a late Open Ice dead-end result cannot end a restarted game',async()=>{
 const ui=app();ui.configure(graph,'open');ui.beginFree(1,4);ui.add(5,['A',20102011]);ui.element('restart-game').onclick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(ui.state().route,[1]);assert.equal(ui.state().finished,false);assert.equal(ui.state().lost,false);
});

test('Career Run player history advances its bold years and greys out every earlier year after a shot',()=>{
 const d={...graph,groups:[...graph.groups,['E',20102011,[3,6]],['F',20112012,[3,6]],['G',20142015,[3,6]]]};const ui=app();ui.configure(d,'career');ui.beginFree(1,4);ui.add(2,['A',20102011]);ui.add(3,['B',20122013]);
 const details=new Element('details');ui.fillTeamDetails(details,3);const all=details.querySelectorAll('*');const buttons=all.filter(x=>x.tagName==='button'&&x.className==='season-link');assert.deepEqual(buttons.map(x=>x.textContent),['2013–14']);assert.ok(all.some(x=>x.className==='history-progress'&&x.textContent.includes('Continue after 2012–13')));
 const grey=all.filter(x=>x.className==='endpoint-years outside-years').map(x=>x.textContent).join(' ');for(const year of ['2010–11','2011–12','2012–13','2014–15'])assert.ok(grey.includes(year),year);
 ui.openExplorer({kind:'player',id:3});const discovery=ui.element('explore-content').querySelectorAll('*');assert.deepEqual(discovery.filter(x=>x.tagName==='button'&&x.className==='season-link').map(x=>x.textContent),['2013–14']);assert.ok(discovery.some(x=>x.className==='outside-years'&&x.textContent==='2012–13'));assert.match(ui.element('explore-step').textContent,/later season than 2012–13/);
});

test('the compact board shows the route target and keeps rules in help rather than above players',()=>{
 const ui=app();ui.configure(graph,'shortest');ui.beginFree(1,4);assert.equal(ui.element('route-target').textContent,'Shortest route: 2 shots');assert.equal(ui.element('par').hidden,true);assert.equal(ui.element('daily-stars').hidden,true);
 ui.configure(graph,'career');ui.beginFree(1,4);assert.match(ui.element('route-target').textContent,/Start 2010–11 → End 2013–14/);
 ui.daily();assert.equal(ui.element('route-target').textContent,'Shortest route: 2 shots');assert.equal(ui.element('daily-stars').hidden,false);assert.equal(ui.element('free-controls').hidden,true);
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/id="round-rules"|id="explore-mode"|id="daily-explore-mode"|Small world|Big league/);assert.match(html,/Or type a player’s name/);
});

test('Shortest Chain era selection limits endpoints while old connections, histories and rosters remain playable',()=>{
 const d={...graph,puzzles:[[1,4,2]],groups:[['A',20102011,[1,5]],['B',20102011,[4,6]],['C',19901991,[1,2]],['D',19801981,[2,4]]]};const ui=app();ui.configure(d,'shortest','defense');assert.equal(ui.beginFree(1,4),true);assert.equal(ui.element('route-target').textContent,'Shortest route: 1 shot');
 const details=new Element('details');ui.fillTeamDetails(details,1);assert.ok(details.querySelectorAll('*').some(x=>x.tagName==='button'&&x.textContent==='1990–91'));assert.equal(details.querySelectorAll('*').some(x=>x.className==='endpoint-years outside-years'),false);
 ui.openExplorer({kind:'player',id:1});assert.ok(ui.element('explore-content').querySelectorAll('*').some(x=>x.tagName==='button'&&x.textContent==='1990–91'));
 ui.add(2,['C',19901991]);assert.deepEqual(ui.state().route,[1,2,4]);assert.equal(ui.state().finished,true);
 const other=app();other.configure(d,'shortest','defense');assert.equal(other.beginFree(2,4),false);
 const snakeUI=app();snakeUI.configure(d,'open');assert.equal(snakeUI.beginFree(1,4),false);
});

test('Shortest Chain counts player additions, with no extra shot for the automatic destination link',()=>{
 const ui=app();ui.configure(graph,'shortest');assert.equal(ui.beginFree(1,4),true);
 assert.equal(ui.element('game-goal').textContent,'0 shots taken');assert.equal(ui.element('route-target').textContent,'Shortest route: 2 shots');
 ui.add(2);assert.deepEqual(ui.state().route,[1,2]);assert.equal(ui.element('game-goal').textContent,'1 shot taken');
 ui.element('undo').onclick();assert.equal(ui.element('game-goal').textContent,'0 shots taken');ui.add(2);ui.add(3);
 assert.deepEqual(ui.state().route,[1,2,3,4]);assert.equal(ui.element('game-goal').textContent,'2 shots taken');assert.equal(ui.element('completion-shots').textContent,'2 shots');assert.equal(ui.element('completion-minimum').textContent,'Shortest route: 2 shots');assert.match(ui.element('result').textContent,/2 SHOTS/);
 ui.daily();assert.equal(ui.element('route-target').textContent,'Shortest route: 2 shots');ui.add(2);ui.add(3);assert.equal(ui.element('completion-shots').textContent,'2 shots');ui.daily();assert.equal(ui.element('game-goal').textContent,'2 shots taken');
});
test('direct teammates still take one shot and revealed Shortest Chain answers use player-addition scoring',()=>{
 const ui=app();ui.configure(graph,'shortest');ui.beginFree(1,2);assert.equal(ui.element('route-target').textContent,'Shortest route: 1 shot');ui.add(2);assert.equal(ui.element('completion-shots').textContent,'1 shot');assert.equal(ui.element('completion-minimum').textContent,'Shortest route: 1 shot');
 ui.beginFree(1,4);ui.element('give-up').onclick();assert.match(ui.element('result').textContent,/2 SHOTS/);assert.equal(ui.element('game-goal').textContent,'2 shots taken');
});

test('daily stars decrease with extra player additions, persist on reload, and revealing earns none',()=>{
 const d={...graph,puzzles:[[1,4,2]],groups:[['A',20102011,[1,2]],['B',20102011,[2,4]],['C',20102011,[1,5]],['D',20102011,[5,6]],['E',20102011,[6,3]],['F',20102011,[3,4]],['G',20102011,[5,3]]]};
 for(const [path,stars] of [[[2],3],[[5,3],2],[[5,6,3],1]]){
  const ui=app();ui.configure(d,'shortest');ui.daily();assert.equal(ui.element('daily-stars')['aria-label'],'3 stars available');
  for(const id of path)ui.add(id);assert.equal(ui.state().finished,true);assert.equal(ui.element('daily-stars')['aria-label'],`${stars} stars earned`);assert.equal(ui.element('completion-stars')['aria-label'],`${stars} stars earned`);assert.match(ui.element('result').textContent,new RegExp(stars+' STARS'));ui.daily();assert.equal(ui.element('daily-stars')['aria-label'],`${stars} stars earned`);
 }
 const ui=app();ui.configure(d,'shortest');ui.daily();ui.add(5);ui.add(6);assert.equal(ui.element('daily-stars')['aria-label'],'2 stars available');ui.element('undo').onclick();assert.equal(ui.element('daily-stars')['aria-label'],'3 stars available');ui.element('give-up').onclick();assert.equal(ui.element('daily-stars')['aria-label'],'Answer revealed — no stars');assert.doesNotMatch(ui.element('result').textContent,/3 STARS/);
});
test('season exploration stays available even when legacy saved toggles are disabled',()=>{
 const ui=app();ui.configure(graph,'shortest');ui.daily();ui.openExplorer({kind:'player',id:1});assert.equal(ui.element('explorer').open,true);assert.equal(ui.element('explore-title').textContent,'Start');assert.equal(ui.element('roster-hint').hidden,false);assert.equal(ui.element('player-hint').hidden,false);
});

test('Earlier career starts first in reversed daily, free-play, custom shares and lookup matchups',async()=>{
 const d={...graph,puzzles:[[4,1,graph.puzzles[0][2]]]};
 const ui=app();ui.configure(d,'shortest');ui.daily();assert.deepEqual(ui.state().route,[1]);
 for(const style of ['shortest','open','road','career']){ui.configure(d,style);assert.equal(ui.beginFree(4,1),true,style);assert.deepEqual(ui.state().route,[1],style)}
 ui.configure(d,'shortest');ui.setupFree();
 for(const [side,q] of [['start','End'],['end','Start']]){ui.element(side+'-search').value=q;ui.element(side+'-search').listeners.input();ui.flushTimers();ui.element(side+'-results').children.find(x=>x.tagName==='button').onclick()}
 assert.equal(ui.element('start-search').value,'Start');assert.equal(ui.element('end-search').value,'End');
 ui.element('share-custom').onclick();const url=new URL(ui.element('challenge-link').value);assert.equal(url.searchParams.get('start'),'1');assert.equal(url.searchParams.get('end'),'4');
 await ui.element('lookup-submit').onclick();assert.match(ui.element('lookup-summary').textContent,/Start → End/);
});
test('Completed daily results survive reversed endpoint ordering',()=>{
 const ui=app();ui.configure({...graph,puzzles:[[4,1,graph.puzzles[0][2]]]},'shortest');ui.daily();
 const route=graph.players[3][0]==='Next'?[4,3,2,1]:[4,2,1];
 ui.seedDaily({route,finished:true,revealed:false,hintsUsed:2});ui.daily();assert.equal(ui.state().finished,true);assert.deepEqual(ui.state().route,[...route].reverse());assert.match(ui.element('result').textContent,/2 hints used/);
});
