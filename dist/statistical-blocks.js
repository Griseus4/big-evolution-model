/** Независимый блок — исходный повтор со всеми выбранными вариантами. */
export function selectCompleteBlocks(input,design){
 if(!design)return {worlds:input.filter(w=>w.values.length),units:null,excluded:[]};
 const byRepeat=new Map();for(const w of input){if(!byRepeat.has(w.pairId))byRepeat.set(w.pairId,[]);byRepeat.get(w.pairId).push(w);}
 const units=[],excluded=[];for(const pairId of design.repeats){const candidates=byRepeat.get(pairId)??[],missing=design.variants.filter(id=>candidates.filter(w=>w.variantId===id&&w.values.length&&!w.incomplete).length!==1);
  if(missing.length)excluded.push({pairId,variants:missing});else units.push({pairId,members:candidates.filter(w=>design.variants.includes(w.variantId)&&w.values.length&&!w.incomplete)});
 }return {worlds:units.flatMap(u=>u.members),units,excluded};
}
export function collapsePairBlocks(input,design){
 if(!design)return input;const {units,excluded}=selectCompleteBlocks(input,design),byId=new Map(units.map(u=>[u.pairId,u]));
 return design.repeats.map(pairId=>{const unit=byId.get(pairId),members=unit?.members??[];return {id:'repeat:'+pairId,pairId,values:members.length?Float64Array.of(1):new Float64Array(),members,extinctions:members.reduce((n,w)=>n+(w.extinctions??0),0),reason:unit?null:'Неполный состав: '+excluded.find(e=>e.pairId===pairId)?.variants.join(', ')};});
}
