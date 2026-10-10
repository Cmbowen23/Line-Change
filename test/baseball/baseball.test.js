import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEngine,matchesPlayerName,puzzleFor} from '../../public/baseball/core.js';
import {matchesPosition,playersFromEras,minimumMoves} from '../../public/baseball/modes.js';
import {playerHistory,seasonRanges,difficultyPool} from '../../public/baseball/presentation.js';
import {lookupConnection} from '../../public/baseball/lookup.js';
import {createSnake} from '../../public/baseball/snake.js';
import {allDecades,parseChallenge,challengeURL} from '../../public/baseball/challenges.js';
const data=JSON.parse(fs.readFileSync(new URL('../../public/baseball/data/baseball.json',import.meta.url)));
data.dailySchedule=JSON.parse(fs.readFileSync(new URL('../../public/baseball/data/daily-puzzles.json',import.meta.url)));
data.playerDepth=JSON.parse(fs.readFileSync(new URL('../../public/baseball/data/player-depth.json',import.meta.url)));
const engine=createEngine(data),id=name=>Number(Object.keys(data.players).find(id=>data.players[id][0]===name));
test('MLB coverage contains only valid MLB players and complete unique team-season membership',()=>{
 assert.equal(data.sport,'MLB');assert.deepEqual(data.coverage,[1970,2025]);assert.equal(Object.keys(data.players).length,11428);assert.equal(data.groups.length,1564);
 for(const [team,season,ids] of data.groups){assert.ok(data.teams[team]);assert.ok(data.teamSeasonNames[`${team}:${season}`]);assert.ok(season>=19701970&&season<=20252025);assert.equal(new Set(ids).size,ids.length);for(const id of ids)assert.ok(data.players[id])}
 assert.equal(data.players[660271][1],'TWP');
});
test('Traded players retain every club while aggregate totals create no fake membership',()=>{
 const naylor=id('Josh Naylor'),devers=id('Rafael Devers');
 assert.deepEqual(new Set(data.groups.filter(g=>g[1]===20252025&&g[2].includes(naylor)).map(g=>g[0])),new Set(['109','136']));
 assert.deepEqual(new Set(data.groups.filter(g=>g[1]===20252025&&g[2].includes(devers)).map(g=>g[0])),new Set(['111','137']));
 assert.equal(engine.evidence(id('Aaron Judge'),id('Derek Jeter')).length,0);
 assert.ok(engine.evidence(id('Aaron Judge'),id('Juan Soto')).some(g=>g[0]==='147'&&g[1]===20242024));
});
test('Baseball filters recognize two-way players, hitters, pitchers, infield and outfield',()=>{
 for(const p of ['pitcher','hitter'])assert.equal(matchesPosition(['Ohtani','TWP'],p),true);
 assert.equal(matchesPosition(['Pitcher','P'],'hitter'),false);assert.equal(matchesPosition(['DH','DH'],'hitter'),true);assert.equal(matchesPosition(['Catcher','C'],'hitter'),true);
 assert.equal(matchesPosition(['Shortstop','SS'],'infield'),true);assert.equal(matchesPosition(['RF','RF'],'outfield'),true);assert.equal(matchesPosition(['Pitcher','P'],'outfield'),false);
});
test('Names tolerate accents and familiar nicknames; era filtering remains valid',()=>{
 assert.ok(engine.search('Ronald Acuna').some(p=>p.name==='Ronald Acuña Jr.'));
 assert.ok(matchesPlayerName(114989,'Rich Gossage','Goose Gossage'));
 assert.ok(engine.search('Nolan Ryan').some(p=>p.id===121597));
 assert.ok(!playersFromEras(data,[2020]).includes(id('Derek Jeter')));
});
test('Every daily matchup has notable endpoints and a truthful one-to-three-move minimum',()=>{
 const pool=new Set(data.dailySchedule.notablePlayerIds);assert.ok(pool.has(121597));assert.ok(pool.has(114989));assert.ok(pool.has(460075));assert.ok(!pool.has(461334));assert.equal(data.dailySchedule.puzzles.length,730);
 for(const [a,b,distance] of data.dailySchedule.puzzles){assert.ok(pool.has(a)&&pool.has(b));assert.equal(engine.shortest(a,b).length-1,distance);assert.ok(minimumMoves(distance)>=1&&minimumMoves(distance)<=3)}
 assert.equal(puzzleFor(data,'2026-10-09').length,3);
});
test('Histories show baseball calendar years and historical franchise names',()=>{
 assert.equal(seasonRanges([19941994,19951995,19971997]),'1994–1995, 1997');
 assert.equal(data.teamSeasonNames['120:19941994'],'Montreal Expos');
 const history=playerHistory(data,id('Vladimir Guerrero'),allDecades);assert.ok(history.some(x=>x.name==='Montreal Expos'));assert.ok(!history.some(x=>x.name==='Washington Nationals'));
 assert.ok(difficultyPool(data,'medium').every(id=>data.playerDepth.seasonsPlayed[id]>=5));
});
test('Lookup alternatives have exact counts and legal evidence, and sharing preserves baseball rules',()=>{
 const a=id('Aaron Judge'),b=id('Derek Jeter'),result=lookupConnection(data,{start:a,end:b});assert.ok(result.path);
 const alternatives=engine.allShortest(a,b),routes=[...alternatives.routes()];assert.equal(BigInt(routes.length),alternatives.count);
 for(const route of routes){assert.equal(route.length-1,alternatives.distance);for(let i=1;i<route.length;i++)assert.ok(engine.evidence(route[i-1],route[i]).length)}
 const parsed=parseChallenge(challengeURL('https://example.com/',a,b,allDecades,'shortest','hitter'),data);assert.equal(parsed.position,'hitter');
 const game=createSnake(data,allDecades,'career'),answer=game.longest(game.context(id('Johnny Bench'),id('Aaron Judge')),{budgetMs:50});assert.ok(answer.path);assert.ok(game.validPath(game.context(id('Johnny Bench'),id('Aaron Judge')),answer.path));
});
