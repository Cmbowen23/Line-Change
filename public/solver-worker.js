import {createSnake,randomSnake} from './snake.js';
import {createEngine} from './core.js';
let data;
self.onmessage=event=>{
 const {id,type,...request}=event.data;
 try{
  if(type==='init'){data=request.data;return}
  if(type==='random'){
   const result=request.style==='shortest'?createEngine(data,request.decades).randomMatchup(Math.random,request.pool,2,4,request.position):randomSnake(data,request.decades,request.style,request.pool);
   self.postMessage({id,result});return;
  }
  const game=createSnake(data,request.decades,request.style),c=game.context(request.start,request.end,request.route,request.links);
  self.postMessage({id,result:type==='finish'?game.finish(c,{maxStates:Infinity}):game.longest(c,{seedPath:request.seedPath})});
 }catch(error){self.postMessage({id,error:error.message})}
};
