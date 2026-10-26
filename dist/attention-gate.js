import {INPUT_SCALES} from './brain-input-scales.js';
import {dagForward} from './dag-network.js';
import {EVOLUTION_RULES} from './brain-evolution-rules.js';
import {SUBSTEPS} from './action-timing.js';
import {attentionCharge,ATTENTION_PREPARATION as PREP} from './brain-cost.js';
/** Наследуемая сеть17→4→1. Буферы принадлежат особи, выхода/обучения в мир
 * нет: положительный результат только запрашивает основной выбор. */
import {GATE_OFFSET,GATE_PARAMETERS,GATE_INPUTS,GATE_HIDDEN,GATE_HIDDEN_BIAS,GATE_OUTPUT_WEIGHTS,GATE_OUTPUT_BIAS} from './temporal-layout.js';
import {ACTIVITY_COUNT} from './activity-perception.js';
import {densitySignal} from './neighbour-perception.js';
const work=new WeakMap();
const dagWork=new WeakMap();
const ATTENTION_WIDTH=5+ACTIVITY_COUNT;
export function createGate(genes,offset=GATE_OFFSET){return Float64Array.from(genes.slice(offset,offset+GATE_PARAMETERS));}
export function rememberAttention(a,cells){
 let s=a.brain.attention;if(!s)s=a.brain.attention=new Float64Array(7*ATTENTION_WIDTH);a.brain.attentionCount=cells.length;
 for(let i=0;i<cells.length;i++){const c=cells[i],j=i*ATTENTION_WIDTH;s[j]=c.q;s[j+1]=c.r;s[j+2]=c.food;s[j+3]=Number(c.isFoodSource);s[j+4]=c.neighbours;for(let k=0;k<ACTIVITY_COUNT;k++)s[j+5+k]=c.activities?.[k]??0;}
}
export function attentionRequest(a,cells,inventoryCapacity,stomachCapacity,subtick=0){
 let w=work.get(a.brain);if(!w){w=new Float64Array(a.brain.dual?18:GATE_INPUTS);work.set(a.brain,w);}w.fill(0);
 const p=a.process,g=a.brain.gateBase;w[0]=a.energy/INPUT_SCALES.energy;w[1]=a.health/INPUT_SCALES.health;w[2]=a.inventory/inventoryCapacity;w[3]=a.stomach/stomachCapacity;
 const action=p?.action??8,op=action<6?0:action-5;if(op<4)w[4+op]=1;else if(op===5)w[8]=1;
 w[9]=p?p.elapsed/p.duration:0;let own=null,target=null,total=0,preparation=PREP.base;
 const s=a.brain.attention;for(let i=0;i<cells.length;i++){const c=cells[i],j=i*ATTENTION_WIDTH;if(c.q===a.brain.position.q&&c.r===a.brain.position.r)own=c;if(c.q===(p?.localDestination??a.brain.position).q&&c.r===(p?.localDestination??a.brain.position).r)target=c;total+=c.neighbours;preparation+=PREP.perCell;
  const same=s&&i<a.brain.attentionCount&&s[j]===c.q&&s[j+1]===c.r;
  if(!same||s[j+2]!==c.food||s[j+3]!==Number(c.isFoodSource))w[14]=1;if(!same||s[j+4]!==c.neighbours)w[15]=1;
  if(!w[16])for(let k=0;k<ACTIVITY_COUNT;k++){preparation+=PREP.activityComparison;if(!same||s[j+5+k]!== (c.activities?.[k]??0)){w[16]=1;break;}}}
 w[10]=(own?.food??0)/INPUT_SCALES.food;w[11]=(target?.food??0)/INPUT_SCALES.food;w[12]=densitySignal(own?.neighbours??0);w[13]=densitySignal(total);
 if(a.brain.dual){
  const elapsed=Math.max(0,subtick-a.brain.lastDecisionSubtick)/SUBSTEPS;
  w[17]=1/(1+elapsed/EVOLUTION_RULES.timerScaleT);
  a.brain.gateCharge=attentionCharge(a.brain,preparation+PREP.final);
  // Буфер не является личным опытом и полностью перезаписывается.
  let values=dagWork.get(a.brain);if(!values){values=new Float64Array(a.brain.attentionStructure.inputs+a.brain.attentionStructure.hidden+1);dagWork.set(a.brain,values);}
  return dagForward(a.brain.attentionStructure,g,w,values).output[0]>0;
 }
 let output=g[GATE_OUTPUT_BIAS];for(let h=0;h<GATE_HIDDEN;h++){let z=g[GATE_HIDDEN_BIAS+h];for(let i=0;i<GATE_INPUTS;i++)z+=g[h*GATE_INPUTS+i]*w[i];output+=g[GATE_OUTPUT_WEIGHTS+h]*Math.tanh(z);}return output>0;
}
