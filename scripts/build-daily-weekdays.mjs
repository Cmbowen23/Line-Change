// Rank the existing curated daily matchups; keep historical games unchanged.
import {readFile,writeFile} from 'node:fs/promises';
import {createEngine} from '../public/core.js';
const path=new URL('../public/data/daily-puzzles.json',import.meta.url);
const schedule=JSON.parse(await readFile(path,'utf8'));
const data=JSON.parse(await readFile(new URL('../public/data/hockey.json',import.meta.url),'utf8'));
const engine=createEngine(data),ranked=[];
for(const puzzle of schedule.puzzles){const answers=engine.allShortest(puzzle[0],puzzle[1]);if(answers.distance!==puzzle[2])throw Error('Stale daily route length');ranked.push({puzzle,count:answers.count});}
let seed=209;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const days=[];
for(const [connections,labels] of [[2,['Warm-up','Easy']],[3,['Medium','Challenging']],[4,['Hard','Very hard','Expert']]]){
 const matches=ranked.filter(x=>x.puzzle[2]===connections).sort((a,b)=>a.count===b.count?a.puzzle[0]-b.puzzle[0]:a.count>b.count?-1:1);
 if(matches.length<labels.length)throw Error('Not enough distinct puzzles for weekly difficulty');
 for(let index=0;index<labels.length;index++){
  const pool=matches.slice(Math.floor(index*matches.length/labels.length),Math.floor((index+1)*matches.length/labels.length));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  days.push({label:labels[index],shots:connections-1,puzzles:pool.map(x=>x.puzzle),answerCounts:pool.map(x=>String(x.count))});
 }
}
schedule.weeklyDifficulty={startsOn:'2026-10-14',policy:'Monday is easiest. Routes get longer and shortest answers become fewer through Sunday. All endpoints stay on the curated notable-player list.',days};
await writeFile(path,JSON.stringify(schedule));
console.log(JSON.stringify(days.map((d,i)=>({day:i+1,label:d.label,shots:d.shots,puzzles:d.puzzles.length,minAnswers:String(d.answerCounts.reduce((a,b)=>BigInt(a)<BigInt(b)?a:b)),maxAnswers:String(d.answerCounts.reduce((a,b)=>BigInt(a)>BigInt(b)?a:b))}))));
