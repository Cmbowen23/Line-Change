import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEngine,puzzleFor,dailyDifficultyFor,easternDate} from '../public/core.js';
const schedule=JSON.parse(readFileSync(new URL('../public/data/daily-puzzles.json',import.meta.url)));
const data={...JSON.parse(readFileSync(new URL('../public/data/hockey.json',import.meta.url))),dailySchedule:schedule};
const engine=createEngine(data);
test('Weekly pools retain notable endpoints and progress from shorter routes to fewer answers',()=>{
 const levels=schedule.weeklyDifficulty.days,notable=new Set(schedule.notablePlayerIds),pairs=new Set();
 assert.equal(levels.length,7);assert.deepEqual(levels.map(x=>x.shots),[1,1,2,2,3,3,3]);
 for(let day=0;day<7;day++){
  const level=levels[day];assert.equal(level.puzzles.length,level.answerCounts.length);assert.ok(level.puzzles.length>=25);
  for(const [a,b,connections] of level.puzzles){assert.ok(notable.has(a)&&notable.has(b));assert.equal(connections-1,level.shots);const key=[a,b].sort().join(':');assert.equal(pairs.has(key),false);pairs.add(key);}
  if(day&&levels[day-1].shots===level.shots){const previousMin=levels[day-1].answerCounts.reduce((a,b)=>BigInt(a)<BigInt(b)?a:b),currentMax=level.answerCounts.reduce((a,b)=>BigInt(a)>BigInt(b)?a:b);assert.ok(BigInt(previousMin)>=BigInt(currentMax));}
 }
 assert.equal(pairs.size,schedule.puzzles.length);
});
test('Daily gets harder through eight full weeks with verified routes and answer counts',()=>{
 const start=Date.parse('2026-10-19T00:00:00Z');
 for(let week=0;week<8;week++){
  let previous=null;
  for(let day=0;day<7;day++){
   const date=new Date(start+(week*7+day)*86400000).toISOString().slice(0,10),level=dailyDifficultyFor(data,date),puzzle=puzzleFor(data,date),answers=engine.allShortest(puzzle[0],puzzle[1]);
   assert.deepEqual(puzzleFor(data,date),puzzle);assert.equal(answers.distance,puzzle[2]);assert.equal(level.shots,puzzle[2]-1);
   const index=level.puzzles.findIndex(p=>p[0]===puzzle[0]&&p[1]===puzzle[1]);assert.equal(answers.count,BigInt(level.answerCounts[index]));
   if(previous){assert.ok(puzzle[2]>=previous.connections);if(puzzle[2]===previous.connections)assert.ok(answers.count<=previous.count)}
   previous={connections:puzzle[2],count:answers.count};
  }
 }
});
test('Weekly difficulty preserves current and historical games, respects overrides, and resets Monday in Eastern time',()=>{
 const date='2026-10-13',day=Math.floor(Date.parse(date+'T00:00:00Z')/86400000);
 assert.deepEqual(puzzleFor(data,date),(schedule.legacyPuzzles||schedule.puzzles)[day%(schedule.legacyPuzzles||schedule.puzzles).length]);assert.equal(dailyDifficultyFor(data,date),null);
 assert.equal(dailyDifficultyFor(data,'2026-10-14').label,'Medium');assert.equal(puzzleFor(data,'2026-10-14')[2]-1,2);assert.equal(dailyDifficultyFor(data,'2026-10-15').label,'Challenging');
 assert.equal(dailyDifficultyFor(data,easternDate(new Date('2026-10-19T03:59:59Z'))).label,'Expert');
 assert.equal(dailyDifficultyFor(data,easternDate(new Date('2026-10-19T04:00:00Z'))).label,'Warm-up');
 const override=[1,2,2],custom={...data,dailySchedule:{...schedule,overrides:{'2026-10-19':override}}};assert.deepEqual(puzzleFor(custom,'2026-10-19'),override);assert.equal(dailyDifficultyFor(custom,'2026-10-19'),null);
});
