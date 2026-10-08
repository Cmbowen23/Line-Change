import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEngine} from '../public/core.js';
import {playerHistory,seasonRanges,difficultyPool} from '../public/presentation.js';
const read=file=>JSON.parse(readFileSync(new URL('../public/data/'+file,import.meta.url)));
const data=read('hockey.json');data.dailySchedule=read('daily-puzzles.json');data.playerDepth=read('player-depth.json');
test('difficulty restricts endpoints while allowing other intermediate players',()=>{
 for(const level of ['easy','medium','hard'])for(const decades of [[1980],[2020]]){
  const engine=createEngine(data,decades),pool=difficultyPool(data,level),pair=engine.randomMatchup(()=>0.4,pool);
  assert.ok(pair);assert.ok(engine.shortest(pair.start,pair.end));
  if(pool){assert.ok(pool.includes(pair.start));assert.ok(pool.includes(pair.end))}
  if(level==='medium'){assert.ok(data.playerDepth.regularSeasonGames[pair.start]>=300);assert.ok(data.playerDepth.regularSeasonGames[pair.end]>=300)}
 }
 const tiny={players:{1:['A'],2:['B'],3:['C']},groups:[['X',20202021,[1,2]],['Y',20202021,[2,3]]]};
 assert.deepEqual(createEngine(tiny).shortest(1,3),[1,2,3]);
 const pair=createEngine(tiny).randomMatchup(()=>0.3,[1,3]);assert.deepEqual([pair.start,pair.end].sort(),[1,3]);assert.equal(pair.par,2);
 assert.equal(createEngine(tiny).randomMatchup(()=>0.3,[1]),null);
});
test('team histories keep full careers and mark only allowed seasons',()=>{
 const history=playerHistory(data,8473512,[2020]);
 assert.ok(history.some(r=>r.team==='PHI'));assert.ok(history.some(r=>r.team==='FLA'));assert.ok(history.some(r=>r.team==='OTT'));
 for(const record of history)for(const year of record.allowed)assert.equal(Math.floor(Number(String(year).slice(0,4))/10)*10,2020);
 assert.ok(history.some(r=>r.seasons.length>r.allowed.length));
 assert.equal(seasonRanges([20202021,20212022,20232024]),'2020–21 to 2021–22, 2023–24');
 assert.equal(seasonRanges([20202021,20202021]),'2020–21');
});
