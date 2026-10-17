import {CognitionOwner} from './cognition-owner.js';
import {COGNITION_PROTOCOL} from './cognition-packet.js';
let owner=new CognitionOwner();
self.onmessage=({data:m})=>{
 if(m.protocol!==COGNITION_PROTOCOL)return;
 try{
  let value,transfer=[];
  if(m.type==='ready')value=null;
  else if(m.type==='register'){owner.register(m.payload.agents);value=null;}
  else if(m.type==='reset'){owner=new CognitionOwner();value=null;}
  else if(m.type==='evaluate'){const start=performance.now(),result=owner.evaluate(m.payload);value={input:m.payload.input,result,workMs:performance.now()-start};transfer=[value.input.buffer,result.buffer];}
  else if(m.type==='commit'){owner.commit(m.payload.selections,m.payload.result);value={selections:m.payload.selections};transfer=[value.selections.buffer];}
  else if(m.type==='snapshot')value=owner.snapshot(m.payload.ids);
  else throw new Error('Неизвестная команда вычислителя.');
  self.postMessage({protocol:COGNITION_PROTOCOL,id:m.id,value},transfer);
 }catch(error){self.postMessage({protocol:COGNITION_PROTOCOL,id:m.id,error:error.message});}
};
