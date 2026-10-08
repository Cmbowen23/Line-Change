import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEngine} from '../public/core.js';
import {challengeURL,parseChallenge} from '../public/challenges.js';
const data=JSON.parse(await readFile(new URL('../public/data/hockey.json',import.meta.url)));
test('shared matchups round trip players and decade rules',()=>{
 const engine=createEngine(data,[1990,2000]);const pair=engine.randomMatchup(()=>0.4);
 const url=challengeURL('https://example.com/?unrelated=1#old',pair.start,pair.end,[2000,1990]);
 const shared=parseChallenge(url,data);
 assert.deepEqual(shared,{start:pair.start,end:pair.end,decades:[1990,2000]});
 assert.equal(createEngine(data,shared.decades).shortest(shared.start,shared.end).length-1,pair.par);
 assert.equal(new URL(url).hash,'');
 assert.equal(parseChallenge('https://example.com/',data),null);
});
test('invalid shared links cannot create broken games',()=>{
 for(const query of ['start=1','start=abc&end=2&decades=1990','start=99999999&end=2&decades=1990','start=1&end=1&decades=1990','start=1&end=2&decades=1880','start=1&end=2&decades='])assert.throws(()=>parseChallenge('https://example.com/?'+query,data));
});
test('random matchups are distinct, reachable, and constrained to selected eras',()=>{
 for(const decades of [[1910],[1940,1950],[1990,2010],[2020]]){
  const engine=createEngine(data,decades);
  for(const rng of [()=>0,()=>0.5,()=>0.9999]){
   const pair=engine.randomMatchup(rng);assert.ok(pair);assert.notEqual(pair.start,pair.end);
   const path=engine.shortest(pair.start,pair.end);assert.equal(pair.par,path.length-1);assert.ok(pair.par>=2);
   for(let i=1;i<path.length;i++)assert.ok(engine.evidence(path[i-1],path[i]).every(g=>decades.includes(Math.floor(Number(String(g[1]).slice(0,4))/10)*10)));
  }
 }
 assert.equal(createEngine(data,[]).randomMatchup(),null);
});
test('random games skip isolated players and reject teammate-only games by default',()=>{
 const tiny={players:{1:['A'],2:['B'],3:['C']},groups:[['X',20002001,[1]],['Y',20002001,[2,3]]]};
 assert.equal(createEngine(tiny).randomMatchup(()=>0.99),null);
 const pair=createEngine(tiny).randomMatchup(()=>0.99,null,1);
 assert.deepEqual([pair.start,pair.end].sort(),[2,3]);assert.equal(pair.par,1);
});

test('shared games preserve longest-chain style and reject unknown styles',()=>{
 const pair=createEngine(data,[2020]).randomMatchup(()=>0.4);
 const url=challengeURL('https://example.com/',pair.start,pair.end,[2020],'longest');
 assert.equal(parseChallenge(url,data).style,'longest');
 assert.throws(()=>parseChallenge(url.replace('style=longest','style=unknown'),data));
});

test('random games include longer shot lengths and try past an all-connected start',()=>{
 const tiny={players:{1:['Center'],2:['Left'],3:['Right'],4:['Far'],5:['Farther']},groups:[['A',20202021,[1,2]],['B',20202021,[1,3]],['C',20202021,[3,4]],['D',20202021,[4,5]]]};
 const engine=createEngine(tiny),pairs=[0,0.4,0.999].map(x=>engine.randomMatchup(()=>x));
 assert.ok(pairs.every(p=>p.par>=2));assert.ok(pairs.some(p=>p.par>=3));
 const star={players:{1:['Center'],2:['Left'],3:['Right']},groups:tiny.groups.slice(0,2)};
 assert.equal(createEngine(star).randomMatchup(()=>0.999).par,2);
});

test('random games choose 2, 3, or 4 shots first and never exceed four',()=>{
 const players=Object.fromEntries(Array.from({length:7},(_,i)=>[i+1,[`Player ${i+1}`]]));
 const groups=Array.from({length:6},(_,i)=>[`Team ${i}`,20202021,[i+1,i+2]]);
 for(const [rng,shots] of [[0,2],[0.4,3],[0.999,4]]){
  const engine=createEngine({players,groups}),pair=engine.randomMatchup(()=>rng);
  assert.equal(pair.par,shots);assert.equal(engine.shortest(pair.start,pair.end).length-1,shots);
 }
 // Two eligible endpoints can only connect in five shots: do not return them.
 assert.equal(createEngine({players,groups}).randomMatchup(()=>0.4,[1,6]),null);
});
test('random games find a requested length beyond the first start and fall back when unavailable',()=>{
 const players={1:['Center'],2:['Left'],3:['Right'],4:['Far'],5:['Farther']};
 const groups=[['A',20202021,[1,2]],['B',20202021,[1,3]],['C',20202021,[3,4]],['D',20202021,[4,5]]];
 // Center has no four-shot endpoint; another start does.
 const engine=createEngine({players,groups});assert.equal(engine.randomMatchup(()=>0.999).par,4);
 const star=createEngine({players:{1:['Center'],2:['Left'],3:['Right']},groups:groups.slice(0,2)});
 for(let i=0;i<3;i++)assert.equal(star.randomMatchup(()=>0.999).par,2);
});
