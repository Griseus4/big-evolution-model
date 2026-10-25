import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('real laboratory navigation switches every section without pausing; play is outside tabpanels',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.equal([...html.matchAll(/id="play"/g)].length,1);assert.ok(html.indexOf('id="play"')<html.indexOf('<main'));
 class Element{
  constructor(){this.listeners={};this.children=[];}
  addEventListener(k,v){this.listeners[k]=v;}
  setAttribute(k,v){this[k]=v;}
  replaceChildren(...nodes){this.children=nodes;}
  focus(){this.focused=true;}
 }
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));let pauses=0,refreshes=0,runRefreshes=0;const changes=[];
 const context=vm.createContext({document:{getElementById:id=>{assert.ok(elements.has(id),id);return elements.get(id);}},navigator:{hardwareConcurrency:4},
  DEFAULT_SEEDS:[42],installGenomeAnalysis(){},installHistoryUI:()=>({refresh(){refreshes++;},reset(){},activity(){}}),installFoodControls(){},
  installBenchmarkUI:()=>({isActive:()=>false,refresh(){}}),fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})}),window:{addEventListener(){}},
  installExperimentUI:()=>({isActive:()=>false,refresh(){runRefreshes++;},getSimulation:()=>null,comparisons:()=>null,report:()=>null}),
  location:{href:'http://localhost/'},URL,pauser:()=>pauses++,changed:name=>changes.push(name)});
 const source=readFileSync(new URL('../dist/lab-tabs.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('import.meta.url',"'http://localhost/lab-tabs.js'").replace(/^export /gm,'');
 vm.runInContext(source+"\nvar ui=installLabTabs({getSimulation:()=>null,pauseWorld:pauser,onTabChange:changed});",context);
 for(const name of ['history','tests','analysis','about','world']){elements.get('tab-'+name).listeners.click();assert.equal(context.ui.currentTab(),name);assert.equal(elements.get('panel-'+name).hidden,false);}
 assert.equal(pauses,0);assert.deepEqual(changes,['history','tests','analysis','about','world']);
 const beforeRuns=runRefreshes;elements.get('test-tab-runs').listeners.click();assert.equal(runRefreshes,beforeRuns+1);
 const before=refreshes;context.ui.refresh();assert.equal(refreshes,before);
 elements.get('tab-world').listeners.keydown({key:'ArrowRight',preventDefault(){}});context.ui.refresh();assert.equal(refreshes,before+2);assert.equal(pauses,0);
});
