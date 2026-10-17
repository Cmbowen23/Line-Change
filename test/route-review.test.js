import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,reviewDailyRoute} from '../public/core.js';
const players=Object.fromEntries([1,2,3,4,5,8].map(id=>[id,['Player '+id,'C']]));
const groups=[[1,2],[2,3],[3,8],[2,4],[4,5],[5,8]].map((pair,i)=>['T'+i,20202021,pair]);
const engine=createEngine({players,groups});
test('review finds the first detour in selection order when building from both ends',()=>{
 const route=[1,2,4,5,8],history=['start','end','start'];
 const review=reviewDailyRoute(engine,route,history);
 assert.equal(review.optimal,2);assert.equal(review.recorded,true);assert.equal(review.firstDetour,1);
 assert.deepEqual(review.steps.map(step=>[step.from,step.player,step.onShortest]),[[1,2,true],[8,5,false],[2,4,false]]);
 assert.equal(review.steps[1].after.shots,3);assert.deepEqual(review.steps[1].before.route,[1,2,3,8]);
 assert.equal(new Set(review.steps[1].before.route).size,4);assert.deepEqual(route,[1,2,4,5,8]);assert.deepEqual(history,['start','end','start']);
});
test('optimal routes have no detours and older attempts use an explicit route-order fallback',()=>{
 const optimal=reviewDailyRoute(engine,[1,2,3,8],['end','start']);assert.equal(optimal.firstDetour,-1);assert.ok(optimal.steps.every(step=>step.onShortest));
 const old=reviewDailyRoute(engine,[1,2,4,5,8]);assert.equal(old.recorded,false);assert.equal(old.firstDetour,1);
 const direct=reviewDailyRoute(engine,[1,2],[]);assert.equal(direct.optimal,1);assert.equal(direct.firstDetour,-1);
});
