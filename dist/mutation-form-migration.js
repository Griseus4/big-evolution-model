/** Только настройки формы: общий старый профиль явно копируется в две
 * стартовые пары. Геномы, живые миры и результаты здесь не преобразуются. */
export function splitMutationForm(value){
 if(!value||typeof value!=='object')return {value,changed:false};
 const copy=structuredClone(value);let changed=false;
 function flat(fields){if(!fields)return;for(const group of ['context','attention'])for(const tail of ['', '.rate','.strength']){
  const key=tail?'initialMutation.'+group+tail:'mutationEnabled.'+group;
  if(!Object.hasOwn(fields,key))continue;
  for(const kind of ['Weights','Structure']){const next=tail?'initialMutation.'+group+kind+tail:'mutationEnabled.'+group+kind;if(!Object.hasOwn(fields,next))fields[next]=fields[key];}
  delete fields[key];changed=true;
 }}
 flat(copy.fields);
 if(copy.common){
  flat(copy.common);
  for(const name of ['mutationEnabled','initialMutation'])for(const group of ['context','attention']){
   const fields=copy.common[name];if(!fields||!Object.hasOwn(fields,group))continue;
   for(const kind of ['Weights','Structure'])fields[group+kind]??=structuredClone(fields[group]);
   delete fields[group];changed=true;
  }
 }
 return {value:copy,changed};
}
