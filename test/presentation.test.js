import test from 'node:test';import assert from 'node:assert/strict';import {connectionSentence} from '../public/presentation.js';
test('route explanation uses plain player names, team, and season',()=>{assert.equal(connectionSentence({fromName:'Claude Giroux',toName:'Derick Brassard',index:0,lastIndex:2,teamName:'Ottawa Senators',season:'2022–23'}),'Claude Giroux played with Derick Brassard on the Ottawa Senators during 2022–23.');assert.equal(connectionSentence({fromName:'Derick Brassard',toName:'Connor McDavid',index:1,lastIndex:2,teamName:'Edmonton Oilers',season:'2021–22'}),'Derick Brassard played with Connor McDavid on the Edmonton Oilers during 2021–22.')});

test('long route layout stays continuous without repeating players',async()=>{
 const {routePosition}=await import('../public/presentation.js');
 const positions=Array.from({length:11},(_,i)=>routePosition(i));
 assert.equal(new Set(positions.map(p=>`${p.row}:${p.column}`)).size,positions.length);
 for(let i=1;i<positions.length;i++){
  const a=positions[i-1],b=positions[i];
  assert.equal(Math.abs(a.row-b.row)+Math.abs(a.column-b.column),2);
  assert.ok(a.row===b.row||a.column===b.column);
 }
 assert.ok(positions.at(-1).row>positions[0].row);
});
