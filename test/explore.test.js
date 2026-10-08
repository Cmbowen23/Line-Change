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

test('longest chains reject repeated rosters and older years, allowing a later year or another team',()=>{
 const graph={players:{1:['Start'],2:['Current'],3:['Next'],4:['End']},groups:[['A',20212022,[1,2,3]],['B',20202021,[2,3]],['B',20212022,[2,3]],['A',20222023,[2,3]],['C',20232024,[3,4]]]};
 const engine=createEngine(graph),route=[1,2],links=[['A',20212022]],options={longest:true,links};
 assert.equal(canAddPlayer(engine,route,4,3,{...options,connection:['A',20212022]}).allowed,false);
 assert.equal(canAddPlayer(engine,route,4,3,{...options,connection:['B',20202021]}).allowed,false);
 assert.equal(canAddPlayer(engine,route,4,3,{...options,connection:['B',20212022]}).allowed,true);
 assert.equal(canAddPlayer(engine,route,4,3,{...options,connection:['A',20222023]}).allowed,true);
 assert.equal(canAddPlayer(engine,route,4,3).allowed,true);
 assert.deepEqual(links,[['A',20212022]]);
});
test('longest-chain finish and preview checks use the same forward rule and restore options after undo',()=>{
 const graph={players:{1:['Start'],2:['Current'],3:['Next'],4:['End']},groups:[['A',20202021,[1,2,4]],['B',20212022,[2,3]],['C',20222023,[3,4]]]};
 const engine=createEngine(graph);
 assert.equal(canAddPlayer(engine,[1,2],4,4,{longest:true,links:[['A',20202021]]}).allowed,false);
 assert.equal(canAddPlayer(engine,[1,2],4,3,{longest:true,links:[['A',20202021]]}).allowed,true);
 assert.equal(canAddPlayer(engine,[1,2,3],4,4,{longest:true,links:[['A',20202021],['B',20212022]]}).allowed,true);
 // Undoing the first link also releases its team-season.
 assert.equal(canAddPlayer(engine,[1],4,2,{longest:true,links:[]}).allowed,true);
});
test('a new link cannot move beyond the destination’s remaining seasons',()=>{
 const graph={players:{1:['Start'],2:['Current'],3:['Late'],4:['End']},groups:[['A',20202021,[1,2]],['B',20232024,[2,3]],['C',20212022,[3,4]]]};
 const engine=createEngine(graph);
 assert.equal(canAddPlayer(engine,[1,2],4,3,{longest:true,links:[['A',20202021]]}).allowed,false);
 assert.equal(canAddPlayer(engine,[1,2],4,3).allowed,true);
});
test('forward search keeps an earlier-season arrival even when a player is reached sooner in a later year',()=>{
 const graph={players:{1:['Start'],2:['Current'],3:['Bridge'],4:['End']},groups:[['A',20232024,[1,2]],['B',20102011,[1,3]],['C',20112012,[3,2]],['D',20122013,[2,4]]]};
 const engine=createEngine(graph),path=engine.forward(1,4);
 assert.deepEqual(path.players,[1,3,2,4]);assert.deepEqual(path.links,[['B',20102011],['C',20112012],['D',20122013]]);
 assert.equal(engine.forward(2,4,{afterSeason:20232024}),null);
 assert.equal(engine.forward(1,4,{usedGroups:[['C',20112012]]}),null);
});
