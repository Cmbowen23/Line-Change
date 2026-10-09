import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupConnection} from '../public/lookup.js';
import {createSnake} from '../public/snake.js';
const data={players:{1:['Start','C',19901991,19901991],2:['Bridge','D',19901991,20002001],3:['Next','R',20002001,20102011],4:['End','G',20102011,20102011]},groups:[['A',19901991,[1,2]],['B',20002001,[2,3]],['C',20102011,[3,4]]],teams:{A:'A',B:'B',C:'C'}};
test('Shortest lookup uses all years and unrestricted positions, with verified season evidence',()=>{
 const answer=lookupConnection(data,{start:1,end:4,decades:[2020]});
 assert.deepEqual(answer.path.players,[1,2,3,4]);assert.deepEqual(answer.path.links,[['A',19901991],['B',20002001],['C',20102011]]);assert.equal(answer.shots,2);assert.equal(answer.proven,true);
});
test('Chronological and team lookups return legal complete routes and truthful maxima',()=>{
 for(const style of ['career','road']){const answer=lookupConnection(data,{start:1,end:4,style});const game=createSnake(data,[1990,2000,2010],style);assert.ok(game.validPath(game.context(1,4),answer.path));assert.equal(answer.path.links.length,3);assert.equal(answer.proven,true)}
 assert.equal(lookupConnection(data,{start:4,end:1,style:'career'}).path,null);
 assert.equal(lookupConnection(data,{start:1,end:4,style:'road',decades:[2020]}).path,null);
});
test('Lookup rejects missing and identical players',()=>{
 assert.equal(lookupConnection(data,{start:1,end:1}).path,null);assert.equal(lookupConnection(data,{start:1,end:99}).path,null);
});
