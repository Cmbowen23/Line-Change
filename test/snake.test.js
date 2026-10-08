import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSnake,randomSnake} from '../public/snake.js';
import {snakeScore,matchesPosition,playersFromEras,minimumShots,shortestShots,shotLabel} from '../public/modes.js';
import {createEngine} from '../public/core.js';
import {challengeURL,parseChallenge,allDecades} from '../public/challenges.js';
import {difficultyPool} from '../public/presentation.js';
const tiny={players:{1:['Start','C'],2:['Bridge','D'],3:['Next','G'],4:['End','C'],5:['Trap','D'],6:['Other','R']},groups:[['A',20102011,[1,2,5]],['B',20122013,[2,3]],['A',20132014,[3,4]],['C',20112012,[2,3]],['D',20142015,[5,6]]]};
test('Open Ice permits backward seasons but prevents reused players and team-seasons anywhere',()=>{
 const game=createSnake(tiny,[2010],'open'),c=game.context(1,4,[1,2,3],[['A',20102011],['B',20122013]]);
 assert.equal(game.canAdd(c,2).allowed,false);
 assert.equal(game.canAdd(c,4).allowed,true);
 assert.equal(game.localConnections(c,5).length,0);
 const backwards=game.context(1,4,[1,2],[['B',20122013]]);
 assert.equal(game.canAdd(backwards,3,['C',20112012]).allowed,true);
 const reuse=game.context(1,6,[1,2,3],[['A',20102011],['B',20122013]]);
 assert.equal(game.localConnections(reuse,5).length,0);
});
test('Road Trip allows arbitrary years but cannot repeat a team in another season',()=>{
 const game=createSnake(tiny,[2010],'road'),c=game.context(1,4,[1,2,3],[['A',20102011],['B',20122013]]);
 assert.equal(game.canAdd(c,4).allowed,false);
 assert.equal(game.finish(c).path,null);
 const open=createSnake(tiny,[2010],'open');assert.ok(open.finish(open.context(1,4,[1,2,3],c.links)).path);
});
test('Career Run uses rookie and final seasons, strictly increases years, and allows losing moves',()=>{
 const game=createSnake(tiny,[2010],'career'),initial=game.context(1,4);
 assert.deepEqual(initial.bounds,{first:20102011,last:20132014});
 const path=game.finish(initial).path;assert.ok(path);assert.ok(game.validPath(initial,path));
 assert.equal(path.links[0][1],20102011);assert.equal(path.links.at(-1)[1],20132014);
 assert.equal(game.canAdd(initial,5).allowed,true);
 const trapped=game.context(1,4,[1,5],[['A',20102011]]);assert.equal(game.finish(trapped).path,null);assert.equal(game.finish(trapped).exhausted,true);
 const current=game.context(1,4,[1,2],[['A',20102011]]);assert.equal(game.canAdd(current,3,['C',20112012]).allowed,true);
 assert.equal(game.canAdd(game.context(1,4,[1,2,3],[['A',20102011],['B',20122013]]),5).allowed,false);
 const sameYear={players:tiny.players,groups:[['A',20102011,[1,2]],['B',20102011,[2,3]],['C',20132014,[3,4]]]};
 assert.equal(createSnake(sameYear,[2010],'career').finish(createSnake(sameYear,[2010],'career').context(1,4)).path,null);
});
test('Career Run rejects an early destination link and excluded endpoint decades',()=>{
 const graph={players:tiny.players,groups:[['A',20092010,[1,2]],['B',20102011,[2,4]],['C',20112012,[2,4]]]};
 const game=createSnake(graph,[2000,2010],'career'),c=game.context(1,4,[1,2],[['A',20092010]]);
 assert.equal(game.canAdd(c,4,['B',20102011]).allowed,false);assert.equal(game.canAdd(c,4,['C',20112012]).allowed,true);
 const filtered=createSnake(graph,[2010],'career');assert.equal(filtered.finish(filtered.context(1,4)).path,null);
});
test('Snake scoring counts seasons or teams instead of claiming shortest-shot par',()=>{
 assert.deepEqual(snakeScore('open',[['A',20102011],['A',20132014]]),{value:2,unit:'shots'});
 assert.deepEqual(snakeScore('career',[['A',20102011],['B',20132014]]),{value:2,unit:'seasons',span:4});
 assert.deepEqual(snakeScore('road',[['A',20102011],['B',20132014]]),{value:2,unit:'teams'});
});
test('longest answers exceed shortest answers, preserve prefixes, and carry valid evidence',()=>{
 const graph={players:{1:['A'],2:['B'],3:['C'],4:['D'],5:['E']},groups:[['A',20202021,[1,2]],['B',20212022,[2,3]],['C',20222023,[3,4]],['D',20232024,[4,5]],['E',20202021,[1,5]]]};
 for(const style of ['open','career','road']){
  const game=createSnake(graph,[2020],style),c=game.context(1,5),result=game.longest(c);
  assert.ok(result.path);assert.deepEqual(result.path.players,[1,2,3,4,5]);assert.equal(result.proven,true);assert.ok(game.validPath(c,result.path));
  const prefix=game.context(1,5,[1,2],[['A',20202021]]),rest=game.longest(prefix);assert.deepEqual(rest.path.players,[2,3,4,5]);assert.ok(game.validPath(prefix,rest.path));
 }
 const game=createSnake(graph,[2020],'open'),bounded=game.longest(game.context(1,5),{maxNodes:0});assert.equal(bounded.proven,false);assert.ok(bounded.path);
});
test('position restrictions apply to bridges, permit arbitrary endpoints, and constrain every shortest answer',()=>{
 const graph={players:{1:['A','C'],2:['Defense','D'],3:['Goalie','G'],4:['End','L'],5:['Forward','RW']},groups:[['A',20202021,[1,2,3,5]],['B',20202021,[2,4]],['C',20202021,[3,4]],['D',20202021,[5,4]]]};
 for(const [position,bridge] of [['defense',2],['goalie',3],['forward',5]]){
  const engine=createEngine(graph,[2020],{position,start:1,end:4});assert.deepEqual(engine.shortest(1,4),[1,bridge,4]);assert.deepEqual([...engine.allShortest(1,4).routes()],[[1,bridge,4]]);
  const pair=createEngine(graph,[2020]).randomMatchup(()=>.4,[1,4],2,4,position);assert.ok(pair);assert.equal(pair.par,createEngine(graph,[2020],{position,start:pair.start,end:pair.end}).shortest(pair.start,pair.end).length-1);
 }
 assert.equal(matchesPosition(['Someone','C/LW'],'forward'),true);assert.equal(matchesPosition(['Someone','D'],'goalie'),false);
});
test('share links preserve all Snake styles and position restrictions and support legacy links',()=>{
 for(const style of ['open','career','road','longest'])assert.equal(parseChallenge(challengeURL('https://example.com/',1,4,[2010],style),tiny).style,style);
 for(const position of ['defense','goalie','forward'])assert.equal(parseChallenge(challengeURL('https://example.com/',1,4,[2010],'shortest',position),tiny).position,position);
 assert.throws(()=>parseChallenge('https://example.com/?start=1&end=4&decades=2010&position=center',tiny));
});
const real=JSON.parse(readFileSync(new URL('../public/data/hockey.json',import.meta.url)));real.dailySchedule=JSON.parse(readFileSync(new URL('../public/data/daily-puzzles.json',import.meta.url)));real.playerDepth=JSON.parse(readFileSync(new URL('../public/data/player-depth.json',import.meta.url)));
test('real random Snake games respect endpoint familiarity, selected decades, and mode rules',()=>{
 let seed=12;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),pool=difficultyPool(real,'easy');
 for(const style of ['open','career','road']){
  const pair=randomSnake(real,allDecades,style,pool,rng);assert.ok(pair,style);assert.ok(pool.includes(pair.start));assert.ok(pool.includes(pair.end));
  const game=createSnake(real,allDecades,style),c=game.context(pair.start,pair.end),path=game.finish(c).path;assert.ok(game.validPath(c,path),style);assert.equal(pair.par,path.links.length);
 }
});
test('core position matchups report truthful teammate-connection distances',()=>{
 let seed=84;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),base=createEngine(real,[2020]);
 for(const position of ['defense','goalie','forward']){
  const pair=base.randomMatchup(rng,difficultyPool(real,'easy'),2,4,position);assert.ok(pair,position);
  const engine=createEngine(real,[2020],{position,start:pair.start,end:pair.end}),path=engine.shortest(pair.start,pair.end);assert.equal(path.length-1,pair.par);assert.ok(pair.par>=2&&pair.par<=4);assert.ok(path.slice(1,-1).every(id=>matchesPosition(real.players[id],position)));
 }
});

test('Open Ice applies team and season limits globally and requires a different team every shot',()=>{
 const graph={players:tiny.players,groups:[['A',20132014,[3,4]],['B',20132014,[3,4]],['C',20102011,[3,4]]]};const game=createSnake(graph,[2010],'open');
 assert.equal(game.canAdd(game.context(1,4,[1,2,3],[['B',20102011],['A',20112012]]),4,['A',20132014]).allowed,false);
 assert.equal(game.canAdd(game.context(1,4,[1,2,3],[['A',20102011],['B',20122013],['A',20112012],['C',20122013]]),4,['A',20132014]).allowed,false);
 assert.equal(game.canAdd(game.context(1,4,[1,2,3],[['D',20102011],['E',20112012],['F',20102011],['G',20102011]]),4,['C',20102011]).allowed,false);
 const c=game.context(1,4,[1,2,3],[['A',20102011],['B',20122013]]);assert.equal(game.canAdd(c,4,['A',20132014]).allowed,true);
});
test('Open Ice finish and longest searches reject illegal team changes and distinguish bounded searches from dead ends',()=>{
 const graph={players:tiny.players,groups:[['A',20102011,[1,2]],['A',20112012,[2,4]],['B',20122013,[2,3]],['C',20132014,[3,4]]]};const game=createSnake(graph,[2010],'open'),c=game.context(1,4);
 const finish=game.finish(c);assert.ok(game.validPath(c,finish.path));assert.deepEqual(finish.path.players,[1,2,3,4]);assert.equal(game.finish(c,{maxStates:0}).exhausted,false);
 const result=game.longest(c);assert.ok(game.validPath(c,result.path));assert.deepEqual(result.path.players,[1,2,3,4]);
 const trap=createSnake({...graph,groups:graph.groups.slice(0,2)},[2010],'open');assert.deepEqual(trap.finish(trap.context(1,4)),{path:null,exhausted:true});assert.equal(trap.canAdd(trap.context(1,4),2).allowed,true);
});
test('Open Ice search keeps distinct histories when paths converge on the same player',()=>{
 const graph={players:tiny.players,groups:[['A',20102011,[1,2]],['B',20112012,[2,3]],['C',20102011,[1,5]],['D',20112012,[5,3]],['B',20122013,[3,4]]]};const game=createSnake(graph,[2010],'open'),c=game.context(1,4);
 const result=game.finish(c);assert.ok(game.validPath(c,result.path));assert.deepEqual(result.path.players,[1,5,3,4]);
});

test('random shortest endpoints come from selected eras but minimum shots are verified across all years',()=>{
 const data={players:{1:['Start','C'],2:['Old bridge','D'],3:['End','C'],4:['Era teammate','R'],5:['Other era teammate','R']},groups:[['A',20102011,[1,4]],['B',20102011,[3,5]],['C',19901991,[1,2]],['D',19801981,[2,3]]]};
 const pool=playersFromEras(data,[2010],[1,2,3]);assert.deepEqual(pool,[1,3]);assert.equal(createEngine(data,[2010]).randomMatchup(()=>.4,pool,2,4,'defense'),null);
 const game=createEngine(data,allDecades),pair=game.randomMatchup(()=>.4,pool,2,4,'defense');assert.ok(pair);assert.equal(pair.par,2);assert.ok(pool.includes(pair.start)&&pool.includes(pair.end));assert.deepEqual(createEngine(data,allDecades,{position:'defense',start:pair.start,end:pair.end}).shortest(pair.start,pair.end).slice(1,-1),[2]);
});

test('the generation worker uses era-filtered endpoints with unrestricted Shortest Chain connection years',()=>{
 const data={players:{1:['Start','C'],2:['Old bridge','D'],3:['End','C'],4:['Era teammate','R'],5:['Other era teammate','R'],6:['Second old bridge','D']},groups:[['A',20102011,[1,4]],['B',20102011,[3,5]],['C',19901991,[1,2]],['D',19801981,[2,6]],['E',19811982,[6,3]]]};
 const messages=[],self={postMessage:message=>messages.push(message)},randomMath=Object.create(Math);randomMath.random=()=>.4;
 const source=readFileSync(new URL('../public/solver-worker.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 new Function('createEngine','createSnake','randomSnake','allDecades','playersFromEras','minimumShots','self','Math',source)(createEngine,createSnake,randomSnake,allDecades,playersFromEras,minimumShots,self,randomMath);
 self.onmessage({data:{type:'init',data}});self.onmessage({data:{id:1,type:'random',style:'shortest',decades:[2010],pool:[1,2,3],position:'defense'}});
 const pair=messages[0].result;assert.ok(pair);assert.equal(pair.par,2);assert.equal(minimumShots(createEngine(data,allDecades,{position:'defense',start:pair.start,end:pair.end}).shortest(pair.start,pair.end).length-1),pair.par);assert.ok([1,3].includes(pair.start)&&[1,3].includes(pair.end));
 self.onmessage({data:{id:2,type:'random',style:'open',decades:[2010],pool:[1,3]}});assert.equal(messages[1].result,null);
});

test('shot scoring charges additions rather than the automatic destination connection',()=>{
 assert.equal(shortestShots([1],4),0);assert.equal(shortestShots([1,2],4),1);assert.equal(shortestShots([1,2,4],4),1);assert.equal(shortestShots([1,2,3,4],4),2);assert.equal(shortestShots([1,4],4),1);
 assert.equal(minimumShots(2),1);assert.equal(minimumShots(3),2);assert.equal(shotLabel(1),'1 shot');assert.equal(shotLabel(2),'2 shots');
});

test('real random Shortest Chain games require one to four player additions under each position rule',()=>{
 let seed=47;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32),pool=playersFromEras(real,[2000,2010,2020],difficultyPool(real,'easy'));
 for(const position of ['any','defense','goalie','forward']){
  const pair=createEngine(real,allDecades).randomMatchup(rng,pool,2,5,position);assert.ok(pair,position);
  const path=createEngine(real,allDecades,{position,start:pair.start,end:pair.end}).shortest(pair.start,pair.end),shots=minimumShots(pair.par);
  assert.equal(shortestShots(path,pair.end),shots);assert.ok(shots>=1&&shots<=4,position);assert.equal(path.length-2,shots);
 }
});

test('the generation worker includes matchups solved by a single player addition',()=>{
 const data={players:{1:['Start','C'],2:['Bridge','D'],3:['End','C']},groups:[['A',20102011,[1,2]],['B',20112012,[2,3]]]};
 const messages=[],self={postMessage:message=>messages.push(message)},randomMath=Object.create(Math);randomMath.random=()=>.4;
 const source=readFileSync(new URL('../public/solver-worker.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 new Function('createEngine','createSnake','randomSnake','allDecades','playersFromEras','minimumShots','self','Math',source)(createEngine,createSnake,randomSnake,allDecades,playersFromEras,minimumShots,self,randomMath);
 self.onmessage({data:{type:'init',data}});self.onmessage({data:{id:1,type:'random',style:'shortest',decades:[2010],pool:[1,3],position:'defense'}});
 const pair=messages[0].result;assert.ok(pair);assert.equal(pair.par,1);assert.ok([1,3].includes(pair.start)&&[1,3].includes(pair.end));
});
