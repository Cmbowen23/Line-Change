import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rosterFor,canAddPlayer,appendConnection} from '../public/explore.js';
import {createEngine} from '../public/core.js';
const data=JSON.parse(readFileSync(new URL('../public/data/hockey.json',import.meta.url)));
const id=name=>Number(Object.keys(data.players).find(p=>data.players[p][0]===name));
test('rosters show only exact team-season appearances within selected eras',()=>{
 const roster=rosterFor(data,'OTT',20222023,[2020]);
 assert.ok(roster.includes(id('Claude Giroux')));assert.ok(roster.includes(id('Derick Brassard')));
 assert.ok(!roster.includes(id('Connor McDavid')));
 assert.equal(new Set(roster).size,roster.length);
 assert.deepEqual(rosterFor(data,'OTT',20222023,[1990]),[]);
 assert.deepEqual(rosterFor(data,'OTT',20042005,[2000]),[]);
 for(const p of roster)assert.ok(data.groups.some(g=>g[0]==='OTT'&&g[1]===20222023&&g[2].includes(p)));
});
test('preview eligibility respects current chain, duplicates, and completed games without mutation',()=>{
 const engine=createEngine(data,[2020]),a=id('Claude Giroux'),b=id('Derick Brassard'),end=id('Connor McDavid'),route=[a];
 assert.equal(canAddPlayer(engine,route,end,b).allowed,true);
 assert.equal(canAddPlayer(engine,route,end,a).reason,'Already used');
 assert.equal(canAddPlayer(engine,route,end,end).allowed,false);
 assert.equal(canAddPlayer(engine,[a,b],end,end).reason,'Connect to destination');
 assert.equal(canAddPlayer(engine,route,end,b,{finished:true}).allowed,false);
 assert.deepEqual(route,[a]);
});
test('longest-chain previews reject a next player that cannot finish without repeats',()=>{
 const graph={players:{1:['Start'],2:['Current'],3:['Dead end'],4:['Destination']},groups:[['X',20202021,[1,2]],['Y',20202021,[2,3]],['Z',20202021,[2,4]]]};
 const engine=createEngine(graph);
 assert.equal(canAddPlayer(engine,[1,2],4,3,{longest:true}).allowed,false);
 assert.equal(canAddPlayer(engine,[1,2],4,4,{longest:true}).allowed,true);
});

test('shortest play auto-finishes and counts both shots; longest play stays open',()=>{
 const engine=createEngine(data,[2020]),a=id('Claude Giroux'),b=id('Derick Brassard'),end=id('Connor McDavid'),route=[a];
 assert.deepEqual(appendConnection(engine,route,b,end),[a,b,end]);
 assert.deepEqual(appendConnection(engine,route,b,end,true),[a,b]);
 assert.deepEqual(appendConnection(engine,[a,b],end,end),[a,b,end]);
 assert.deepEqual(route,[a]);
 assert.deepEqual(appendConnection(createEngine(data,[1990]),route,b,end),[a,b]);
});
