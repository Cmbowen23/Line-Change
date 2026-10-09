import {createSnake,randomSnake} from './snake.js';
import {createEngine} from './core.js';
import {allDecades} from './challenges.js';
import {playersFromEras,minimumShots} from './modes.js';
import {lookupConnection} from './lookup.js';
let data;
self.onmessage=event=>{
 const {id,type,...request}=event.data;
 try{
  if(type==='init'){data=request.data;return}
  if(type==='lookup'){self.postMessage({id,result:lookupConnection(data,request)});return}
  if(type==='random'){
   const result=request.style==='shortest'?createEngine(data,allDecades).randomMatchup(Math.random,playersFromEras(data,request.decades,request.pool),2,5,request.position):randomSnake(data,request.decades,request.style,request.pool);
   if(result&&request.style==='shortest')result.par=minimumShots(result.par);
   self.postMessage({id,result});return;
  }
  const game=createSnake(data,request.decades,request.style),c=game.context(request.start,request.end,request.route,request.links);
  self.postMessage({id,result:type==='finish'?game.finish(c,{maxStates:Infinity}):game.longest(c,{seedPath:request.seedPath})});
 }catch(error){self.postMessage({id,error:error.message})}
};
