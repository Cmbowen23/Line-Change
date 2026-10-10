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
 const html=readFileSync(new URL('../../public/baseball/index.html',import.meta.url),'utf8'),elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(x=>[x[1],new Element()]));
 const document={getElementById:id=>{assert.ok(elements.has(id),'Missing HTML element '+id);return elements.get(id)},createElement:tag=>new Element(tag),createTextNode:text=>text,addEventListener(){}};
 const storage=new Map([['baseball-connections-explore','false'],['baseball-connections-daily-explore','false']]),location={href:'https://example.com/baseball/',origin:'https://example.com'},localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 class Worker{
  postMessage(request){if(request.type==='init'){this.data=request.data;return}queueMicrotask(()=>{if(request.type==='lookup'){this.onmessage?.({data:{id:request.id,result:lookupConnection(this.data,request)}});return}const game=createSnake(this.data,request.decades,request.style);this.onmessage?.({data:{id:request.id,result:request.type==='finish'?game.finish(game.context(request.start,request.end,request.route,request.links)):game.longest(game.context(request.start,request.end,request.route,request.links),{seedPath:request.seedPath,budgetMs:this.data.targetBudget??20})}})})}
  terminate(){}
 }
 const timers=[];
 const bindings={timers,...core,...challenges,...presentation,...explore,...modes,createSnake,document,localStorage,location,history:{replaceState(){}},Worker,URL,confirm:()=>{throw Error('Native confirmation must not be used in embedded previews')},navigator:{clipboard:{async writeText(text){this.lastText=text}}},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},requestAnimationFrame:fn=>fn(),portrait:()=>new Element('span'),teamLogo:()=>new Element('span')};
 const source=readFileSync(new URL('../../public/baseball/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/import\.meta\.url/g,"'https://example.com/app.js'").replace(/load\(\);document\.addEventListener\('visibilitychange',[\s\S]*$/,'');
 const api=new Function(...Object.keys(bindings),source+`;return {selectDecades(ds){selectedDecades=ds;changeDecades()},flushTimers(){while(timers.length)timers.shift()()},seedDaily(record){write(key(),record)},setupFree,beginFree,add,daily,share,sharedText(){return navigator.clipboard.lastText},openExplorer,fillTeamDetails,seasonExploreAllowed,configure(d,style,restriction='any'){data=d;gameStyle=style;selectedDecades=[2010];position=restriction;mode='free'},state(){return {route:[...route],links:[...routeLinks],finished,lost,gamePosition,revealed}},element:id=>$(id)};`)(...Object.values(bindings));return api;
}
const graph={version:'test-mlb',teams:{A:'Club A',B:'Club B',C:'Club C'},puzzles:[[1,4,2]],players:{1:['Start','SS',20102010,20102010],2:['Pitcher','P',20102010,20122012],3:['Outfielder','CF',20102010,20122012],4:['End','C',20122012,20122012]},groups:[['A',20102010,[1,2,3]],['B',20122012,[2,4]],['C',20122012,[3,4]]]};
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
