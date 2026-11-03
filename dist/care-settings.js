import {BODY_GENE_FIELDS,BODY_GENE_DEFAULTS,bodyGeneValues,effectiveSubsteps} from './physiology-settings.js';
export const INITIAL_CARRY_FRACTION=.5;
export const CARE_GENE_FIELDS=Object.freeze({...BODY_GENE_FIELDS,tCarry:Object.freeze({label:'Ношение ребёнка после рождения',unit:'Т',value:BODY_GENE_DEFAULTS.tAdult*INITIAL_CARRY_FRACTION,min:0,max:Infinity,exclusiveMin:true})});
export const CARE_GENE_KEYS=Object.freeze(Object.keys(CARE_GENE_FIELDS));
export function careGeneValues(input={}){
 const {tCarry,...body}=input,g=bodyGeneValues(body),time=tCarry??g.tAdult*INITIAL_CARRY_FRACTION;
 if(tCarry===null)throw new Error('Неверный срок ношения.');effectiveSubsteps(time);return {...g,tCarry:time};
}
