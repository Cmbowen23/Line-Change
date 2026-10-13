import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as core from '../../public/baseball/core.js';
import * as challenges from '../../public/baseball/challenges.js';
import * as presentation from '../../public/baseball/presentation.js';
import * as explore from '../../public/baseball/explore.js';
import * as modes from '../../public/baseball/modes.js';
import {createSnake} from '../../public/baseball/snake.js';
import {lookupConnection} from '../../public/baseball/lookup.js';

// A small DOM double exercises the actual app handlers without a browser,
// network access, or changing anyone's saved daily attempt.
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.open=false;this.scrollTop=0;this.hidden=false;this.value='';this._text='';this.isConnected=true;this.listeners={};this.classList={add(){},remove(){},toggle(){}}}
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
 const html=readFileSync(new URL('../../public/baseball/index.html',import.meta.url),'utf8'),elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(x=>[x[1],new Element()]));
 const document={getElementById:id=>{const found=elements.get(id)||[...elements.values()].flatMap(x=>x.querySelectorAll('*')).find(x=>x.id===id);if(!found&&id==='explore-roster')return null;assert.ok(found,'Missing HTML element '+id);return found},createElement:tag=>new Element(tag),createTextNode:text=>text,addEventListener(){}};
 const storage=new Map([['baseball-connections-explore','false'],['baseball-connections-daily-explore','false']]),location={href:'https://example.com/baseball/',origin:'https://example.com'},localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 class Worker{
  postMessage(request){if(request.type==='init'){this.data=request.data;return}queueMicrotask(()=>{if(request.type==='lookup'){this.onmessage?.({data:{id:request.id,result:lookupConnection(this.data,request)}});return}const game=createSnake(this.data,request.decades,request.style);this.onmessage?.({data:{id:request.id,result:request.type==='finish'?game.finish(game.context(request.start,request.end,request.route,request.links)):game.longest(game.context(request.start,request.end,request.route,request.links),{seedPath:request.seedPath,budgetMs:this.data.targetBudget??20})}})})}
  terminate(){}
 }
 const timers=[];
 const bindings={timers,...core,...challenges,...presentation,...explore,...modes,createSnake,document,localStorage,location,history:{replaceState(){}},Worker,URL,confirm:()=>{throw Error('Native confirmation must not be used in embedded previews')},navigator:{clipboard:{async writeText(text){this.lastText=text}}},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},requestAnimationFrame:fn=>fn(),portrait:()=>new Element('span'),teamLogo:()=>new Element('span')};
 const source=readFileSync(new URL('../../public/baseball/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/import\.meta\.url/g,"'https://example.com/app.js'").replace(/load\(\);document\.addEventListener\('visibilitychange',[\s\S]*$/,'');
 const api=new Function(...Object.keys(bindings),source+`;return {selectDecades(ds){selectedDecades=ds;changeDecades()},flushTimers(){while(timers.length)timers.shift()()},seedDaily(record){write(key(),record)},setupFree,beginFree,add,daily,selectBuildSide,previewExplorerPlayer,submitExplorerDraft,share,sharedText(){return navigator.clipboard.lastText},openExplorer,fillTeamDetails,seasonExploreAllowed,configure(d,style,restriction='any'){data=d;gameStyle=style;selectedDecades=[2010];position=restriction;mode='free'},state(){return {draft:explorerDraft?{left:[...explorerDraft.left],right:[...explorerDraft.right],side:explorerDraft.side,actions:[...explorerDraft.actions],joined:explorerDraft.joined}:null,route:[...route],rightRoute:[...rightRoute],buildSide,score:currentShortestScore(),links:[...routeLinks],finished,lost,gamePosition,revealed}},element:id=>$(id)};`)(...Object.values(bindings));return api;
}
const graph={version:'test-mlb',teams:{A:'Club A',B:'Club B',C:'Club C'},puzzles:[[1,4,2]],players:{1:['Start','SS',20102010,20102010],2:['Pitcher','P',20102010,20122012],3:['Outfielder','CF',20102010,20122012],4:['End','C',20122012,20122012]},groups:[['A',20102010,[1,2,3]],['B',20122012,[2,4]],['C',20122012,[3,4]]]};
test('Baseball rosters keep eligible players first without allowing invalid previews',()=>{
 const d={...graph,groups:[['A',20102010,[1,2,3,4]],['B',20122012,[2,4]]]};
 const ui=app();ui.configure(d,'shortest','pitcher');assert.equal(ui.beginFree(1,4),true);
 
 ui.openExplorer({kind:'roster',team:'A',year:20102010});
 const rows=ui.element('explore-content').children.find(x=>x.id==='explore-roster').children.filter(x=>x.tagName==='button');assert.deepEqual(rows.map(x=>x.dataset.playerId),[4,2,1,3]);
 assert.ok(!rows[0].className.includes('position-excluded'));const excluded=rows.find(x=>x.dataset.playerId===3);assert.match(excluded.className,/position-excluded/);excluded.onclick();assert.equal(ui.element('explore-title').textContent,'Outfielder');
 const profile=ui.element('explore-content').children.find(x=>x.className==='explore-profile');assert.equal(profile.children.find(x=>x.tagName==='button').disabled,true);
 ui.daily();ui.openExplorer({kind:'roster',team:'A',year:20102010});
});
test('Baseball game enforces positions, auto-completes in one move, and restores daily Open Roster',()=>{
 const ui=app();ui.configure(graph,'shortest','pitcher');assert.equal(ui.beginFree(1,4),true);ui.add(3);assert.deepEqual(ui.state().route,[1]);ui.add(2);assert.deepEqual(ui.state().route,[1,2,4]);assert.equal(ui.element('completion-moves').textContent,'1 move');ui.daily();assert.equal(ui.state().gamePosition,'any');assert.equal(ui.element('daily-stars').hidden,false);
});
test('Custom baseball lookup shows all shortest options without changing the current game',async()=>{
 const ui=app();ui.configure(graph,'shortest');ui.daily();const before=ui.state();ui.setupFree();
 for(const [side,q] of [['start','Start'],['end','End']]){ui.element(side+'-search').value=q;ui.element(side+'-search').listeners.input();ui.flushTimers();ui.element(side+'-results').children.find(x=>x.tagName==='button').onclick()}
 ui.element('lookup-open').onclick();await new Promise(resolve=>setImmediate(resolve));ui.flushTimers();assert.equal(ui.element('lookup-result').hidden,false);assert.equal(ui.element('lookup-heading').textContent,'Shortest route');assert.match(ui.element('lookup-summary').textContent,/1 move/);assert.match(ui.element('lookup-answers').textContent,/2 possible shortest routes/);assert.deepEqual(ui.state(),before);
});
test('Baseball season explorer uses a calendar year, not a hockey split season',()=>{
 const ui=app();ui.configure(graph,'shortest');assert.equal(ui.beginFree(1,4),true);ui.openExplorer({kind:'player',id:1});assert.ok(!ui.element('explore-content').textContent.includes('2010–11'));assert.ok(ui.element('explore-content').textContent.includes('2010'));
});

test('Reveal uses an in-game confirmation, supports cancel, and shows the position-valid shortest route',async()=>{
 const ui=app();ui.configure(graph,'shortest','pitcher');ui.beginFree(1,4);
 ui.element('give-up').onclick();assert.equal(ui.element('reveal-confirmation').open,true);assert.equal(ui.state().finished,false);
 ui.element('cancel-reveal').onclick();assert.equal(ui.element('reveal-confirmation').open,false);assert.deepEqual(ui.state().route,[1]);
 ui.element('give-up').onclick();await ui.element('confirm-reveal').onclick();
 assert.equal(ui.element('reveal-confirmation').open,false);assert.deepEqual(ui.state().route,[1,2,4]);assert.equal(ui.state().revealed,true);assert.equal(ui.state().finished,true);assert.match(ui.element('result').textContent,/Shortest route revealed/);
});
test('Daily reveal awards no stars and a stale confirmation cannot end a new matchup',async()=>{
 const ui=app();ui.configure(graph,'shortest');ui.daily();ui.element('give-up').onclick();assert.match(ui.element('reveal-description').textContent,/no stars/);
 await ui.element('confirm-reveal').onclick();assert.equal(ui.state().revealed,true);assert.equal(ui.element('daily-stars')['aria-label'],'Answer revealed — no stars');
 ui.beginFree(1,4);ui.element('give-up').onclick();ui.beginFree(3,4);await ui.element('confirm-reveal').onclick();assert.equal(ui.state().finished,false);assert.deepEqual(ui.state().route,[3]);
});
test('Longest reveal still uses the Snake solver after accepting in-game confirmation',async()=>{
 const ui=app();ui.configure(graph,'road');ui.beginFree(1,4);ui.element('give-up').onclick();assert.equal(ui.element('reveal-title').textContent,'Reveal longest route?');
 await ui.element('confirm-reveal').onclick();assert.equal(ui.state().revealed,true);assert.equal(ui.state().route.at(-1),4);assert.equal(ui.state().links.length,ui.state().route.length-1);
});

test('Baseball daily and custom result sharing stay on the baseball tab',async()=>{
 const ui=app();ui.configure(graph,'shortest');ui.daily();await ui.share();assert.ok(ui.sharedText().endsWith('https://example.com/baseball/'));
 ui.beginFree(1,4);ui.add(2);await ui.share();const url=new URL(ui.sharedText().split('\n').at(-1));assert.equal(url.pathname,'/baseball/');assert.equal(url.searchParams.get('start'),'1');assert.equal(url.searchParams.get('end'),'4');
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

test('Random-game route target shows a proven maximum or an explicitly bounded longest result',async()=>{
 const ui=app();ui.configure(graph,'career');ui.beginFree(1,4);assert.equal(ui.element('route-target').textContent,'Finding longest route…');
 await new Promise(resolve=>setImmediate(resolve));assert.match(ui.element('route-target').textContent,/Longest possible route: \d+ (shots|moves)/);assert.match(ui.element('route-target-note').textContent,/Verified maximum/);
 const bounded=app();bounded.configure({...graph,targetBudget:0},'road');bounded.beginFree(1,4);await new Promise(resolve=>setImmediate(resolve));assert.match(bounded.element('route-target').textContent,/Longest route found: \d+ (shots|moves)/);assert.match(bounded.element('route-target-note').textContent,/longer route may exist/);
 ui.configure(graph,'career');ui.beginFree(1,4);ui.daily();const target=ui.element('route-target').textContent;await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.element('route-target').textContent,target);assert.match(target,/Shortest route/);assert.equal(ui.element('route-target-note').hidden,true);
});

test('Season explorer restores roster scroll after career browsing, closing, Escape, and search changes',()=>{
 const ui=app();ui.configure(graph,'shortest');ui.beginFree(1,4);
 const roster={kind:'roster',team:'A',year:20102010,query:''},dialog=ui.element('explorer');
 ui.openExplorer({...roster});dialog.scrollTop=480;
 const list=ui.element('explore-content').children.find(x=>x.id==='explore-roster');
 list.children.find(x=>x.tagName==='button'&&x.dataset.playerId===2).onclick();
 assert.equal(dialog.scrollTop,0);dialog.scrollTop=125;ui.element('explore-back').onclick();assert.equal(dialog.scrollTop,480);
 ui.element('close-explorer').onclick();dialog.scrollTop=0;ui.openExplorer({...roster});assert.equal(dialog.scrollTop,480);
 dialog.scrollTop=620;dialog.listeners.scroll();dialog.close();dialog.scrollTop=0;ui.openExplorer({...roster});assert.equal(dialog.scrollTop,620);
 ui.element('roster-search').value='Start';ui.element('roster-search').oninput();assert.equal(dialog.scrollTop,0);
 ui.element('roster-search').value='';ui.element('roster-search').oninput();assert.equal(dialog.scrollTop,620);
 ui.openExplorer({...roster,team:'B'});assert.equal(dialog.scrollTop,0);ui.openExplorer({...roster});assert.equal(dialog.scrollTop,620);
});


test('Roster arrows follow the explored career across seasons and trades, preserve scroll, and obey Career Run years',()=>{
 const d={...graph,teams:{A:'Team A',B:'Team B',C:'Team C',D:'Team D'},groups:[['A',20102010,[1,2]],['B',20112011,[2,3]],['C',20112011,[2,3]],['D',20122012,[2,4]]]};
 const ui=app();ui.configure(d,'shortest');ui.beginFree(1,4);
 ui.openExplorer({kind:'roster',playerId:2,team:'A',year:20102010,query:''});
 assert.equal(ui.element('explore-season-nav').hidden,false);assert.equal(ui.element('explore-prev-season').disabled,true);assert.equal(ui.element('explore-next-season').disabled,false);assert.match(ui.element('explore-season-context').textContent,/1 of 4/);
 ui.element('explorer').scrollTop=340;ui.element('explore-next-season').onclick();assert.match(ui.element('explore-title').textContent,/Team B/);assert.equal(ui.element('explorer').scrollTop,0);
 ui.element('explore-next-season').onclick();assert.match(ui.element('explore-title').textContent,/Team C/);ui.element('explore-next-season').onclick();assert.match(ui.element('explore-title').textContent,/Team D/);assert.equal(ui.element('explore-next-season').disabled,true);
 ui.element('explore-next-season').onclick();assert.match(ui.element('explore-title').textContent,/Team D/);
 for(let i=0;i<3;i++)ui.element('explore-prev-season').onclick();assert.match(ui.element('explore-title').textContent,/Team A/);assert.equal(ui.element('explorer').scrollTop,340);assert.deepEqual(ui.state().route,[1]);
 ui.openExplorer({kind:'player',id:2});assert.equal(ui.element('explore-season-nav').hidden,true);
 const seasons=ui.element('explore-content').children.find(x=>x.className==='explore-seasons');seasons.children.find(x=>x.tagName==='button').onclick();assert.match(ui.element('explore-season-context').textContent,/1 of 4/);
 ui.element('explore-next-season').onclick();ui.element('explore-back').onclick();assert.equal(ui.element('explore-title').textContent,d.players[2][0]);
 ui.configure(d,'career');ui.beginFree(1,4);ui.openExplorer({kind:'roster',playerId:2,team:'A',year:20102010,query:''});assert.equal(ui.element('explore-next-season').disabled,true);
 ui.add(2,['A',20102010]);ui.openExplorer({kind:'roster',playerId:2,team:'B',year:20112011,query:''});assert.equal(ui.element('explore-prev-season').disabled,true);assert.equal(ui.element('explore-next-season').disabled,false);
});

test('Shortest Chain builds from both endpoints, joins in the middle, counts additions, and undoes the most recent side',()=>{
 const d={...graph,puzzles:[[1,5,4]],players:{1:['Start','C',20102010,20102010],2:['Left','P',20102010,20112011],3:['Middle','P',20112011,20122012],4:['Right','P',20122012,20132013],5:['Finish','C',20132013,20132013]},groups:[['A',20102010,[1,2]],['B',20112011,[2,3]],['C',20122012,[3,4]],['D',20132013,[4,5]]]};
 const ui=app();ui.configure(d,'shortest');ui.beginFree(1,5);
 ui.openExplorer({kind:'player',id:5});assert.equal(ui.state().buildSide,'end');assert.ok(ui.element('explore-chain').textContent.includes('Finish'));
 ui.element('close-explorer').onclick();ui.add(4);assert.deepEqual(ui.state().rightRoute,[5,4]);assert.equal(ui.state().score,1);assert.equal(ui.state().finished,false);
 assert.deepEqual(ui.element('chain').children.filter(x=>x.dataset.playerId).map(x=>x.dataset.playerId),[1,4,5]);
 assert.equal(ui.element('chain').children.filter(x=>x.className?.includes('route-both')).length,1);
 ui.selectBuildSide('start');ui.add(2);assert.equal(ui.state().score,2);ui.selectBuildSide('end');ui.element('undo').onclick();assert.deepEqual(ui.state().route,[1]);assert.deepEqual(ui.state().rightRoute,[5,4]);assert.equal(ui.state().buildSide,'start');
 ui.add(2);ui.add(4);assert.equal(ui.state().finished,false);assert.equal(ui.state().score,2);ui.add(3);assert.equal(ui.state().finished,true);assert.deepEqual(ui.state().route,[1,2,3,4,5]);assert.equal(ui.state().score,3);
 assert.equal(ui.element('chain').children.filter(x=>x.className?.includes('route-both')).length,0);
 ui.beginFree(1,5);ui.selectBuildSide('end');ui.add(4);ui.element('roster-hint').onclick();assert.ok(ui.element('explore-chain').textContent.includes('Finish'));
 ui.element('close-explorer').onclick();ui.daily();ui.selectBuildSide('end');ui.add(4);ui.daily();assert.deepEqual(ui.state().rightRoute,[5,4]);assert.equal(ui.state().buildSide,'end');assert.equal(ui.state().score,1);
 ui.configure(d,'road');ui.beginFree(1,5);ui.selectBuildSide('end');assert.equal(ui.state().buildSide,'start');
});

test('Reverse Shortest Chain enforces intermediate positions, exempts both endpoints, and resets side state on reveal',async()=>{
 const d={...graph,players:{...graph.players,2:['Allowed','P',20102010,20112011]},groups:[['A',20102010,[1,2,3]],['B',20112011,[2,3,4]]],puzzles:[[1,4,2]]};
 const ui=app();ui.configure(d,'shortest','pitcher');assert.equal(ui.beginFree(1,4),true);ui.selectBuildSide('end');ui.add(3);assert.deepEqual(ui.state().rightRoute,[4]);assert.equal(ui.state().score,0);
 ui.add(2);assert.deepEqual(ui.state().route,[1,2,4]);assert.equal(ui.state().finished,true);assert.equal(ui.state().score,1);
 ui.beginFree(1,4);ui.selectBuildSide('end');ui.element('give-up').onclick();await ui.element('confirm-reveal').onclick();
 assert.equal(ui.state().revealed??ui.element('result').textContent.includes('revealed'),true);assert.deepEqual(ui.state().route,[1,2,4]);assert.deepEqual(ui.state().rightRoute,[]);assert.equal(ui.state().score,1);
});

test('Explorer preview builds on both sides without scoring, then atomically submits and completes a valid chain',()=>{
 const d={...graph,puzzles:[[1,5,4]],players:{1:['Start','C',20102010,20102010],2:['Left','P',20102010,20112011],3:['Middle','P',20112011,20122012],4:['Right','P',20122012,20132013],5:['Finish','C',20132013,20132013]},groups:[['A',20102010,[1,2]],['B',20112011,[2,3]],['C',20122012,[3,4]],['D',20132013,[4,5]]]};
 const ui=app();ui.configure(d,'shortest','pitcher');ui.beginFree(1,5);
 const rosterRow=id=>ui.element('explore-content').children.find(x=>x.id==='explore-roster').children.find(x=>x.dataset.playerId===id);
 const seasonButton=()=>ui.element('explore-content').children.filter(x=>x.className==='explore-seasons').flatMap(x=>x.children).filter(x=>x.tagName==='button').at(-1);
 ui.openExplorer({kind:'roster',playerId:1,team:'A',year:20102010,query:''});rosterRow(2).onclick();assert.deepEqual(ui.state().draft.left,[1,2]);assert.deepEqual(ui.state().route,[1]);assert.equal(ui.state().score,0);assert.equal(ui.element('explore-submit').disabled,false);
 seasonButton().onclick();rosterRow(3).onclick();assert.deepEqual(ui.state().draft.left,[1,2,3]);assert.equal(ui.state().score,0);
 ui.element('explore-chain').children.find(x=>x.dataset.playerId===5).children[0].onclick();assert.equal(ui.state().draft.side,'end');seasonButton().onclick();rosterRow(4).onclick();assert.equal(ui.state().draft.joined,true);
 assert.deepEqual(ui.element('explore-chain').children.filter(x=>x.dataset.playerId).map(x=>x.dataset.playerId),[1,2,3,4,5]);assert.equal(ui.state().score,0);assert.equal(ui.element('completion').open,false);
 ui.element('explore-submit').onclick();assert.deepEqual(ui.state().route,[1,2,3,4,5]);assert.equal(ui.state().score,3);assert.equal(ui.state().finished,true);assert.equal(ui.element('completion').open,true);assert.equal(ui.element('explorer').open,false);
});
test('Explorer preview supports removing drafts, partial submission, closing without scoring, and rejecting stale or invalid submissions',()=>{
 const d={...graph,groups:[['A',20102010,[1,2]],['B',20112011,[2,3]],['C',20122012,[3,4]]]};const ui=app();ui.configure(d,'shortest');ui.beginFree(1,4);ui.openExplorer({kind:'roster',team:'A',year:20102010,query:''});
 assert.equal(ui.previewExplorerPlayer(2,['A',20102010]),true);ui.openExplorer({kind:'player',id:1});assert.equal(ui.state().draft.actions.length,0);
 ui.previewExplorerPlayer(2,['A',20102010]);ui.element('explore-back').onclick();
 // Refresh the preview strip without changing the actual chain.
 ui.element('roster-search').value='';ui.element('roster-search').oninput();ui.element('explore-chain').children.find(x=>x.dataset.playerId===1).children[0].onclick();
 const preview=ui.element('explore-chain').children.find(x=>x.dataset.playerId===2);preview.children.find(x=>x.className==='remove-preview').onclick();assert.equal(ui.state().draft.actions.length,0);assert.equal(ui.state().score,0);
 ui.previewExplorerPlayer(2,['A',20102010]);ui.element('close-explorer').onclick();assert.deepEqual(ui.state().route,[1]);assert.equal(ui.state().score,0);
 ui.openExplorer({kind:'player',id:1});ui.previewExplorerPlayer(2,['A',20102010]);ui.submitExplorerDraft();assert.deepEqual(ui.state().route,[1,2]);
 if(!ui.state().finished){assert.equal(ui.element('explorer').open,true);assert.equal(ui.state().draft.actions.length,0);assert.equal(ui.state().score,1);}
 ui.beginFree(1,4);ui.openExplorer({kind:'player',id:1});assert.equal(ui.previewExplorerPlayer(4,['A',20102010]),false);assert.equal(ui.state().draft.actions.length,0);
 ui.previewExplorerPlayer(2,['A',20102010]);ui.add(2);const before=ui.state().route;ui.submitExplorerDraft();assert.deepEqual(ui.state().route,before);if(!ui.state().finished)assert.match(ui.element('explore-feedback').textContent,/game changed/);
 const html=readFileSync(new URL('../../public/baseball/index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/id="build-sides"|id="round-rule"|id="explore-goal"|id="explore-from"|id="explore-position-rule"/);
});
