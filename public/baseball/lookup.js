import {createEngine} from './core.js';
import {allDecades} from './challenges.js';
import {createSnake} from './snake.js';
import {minimumMoves} from './modes.js';

export function lookupConnection(data,{start,end,style='shortest',decades=allDecades}){
 if(!data.players[start]||!data.players[end]||start===end)return {path:null,message:'Choose two different MLB players.'};
 if(style==='shortest'){
  const engine=createEngine(data),players=engine.shortest(start,end);
  return {path:players?{players,links:players.slice(1).map((id,i)=>engine.evidence(players[i],id)[0].slice(0,2))}:null,proven:true,moves:players?minimumMoves(players.length-1):null};
 }
 if(!['career','road'].includes(style))throw Error('Unknown lookup style');
 const game=createSnake(data,decades,style);
 return game.longest(game.context(start,end));
}
