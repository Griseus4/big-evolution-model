/** Чистые проверки следа наблюдателя; не запускают игровые стратегии. */
import {ResidentTrail,attachResidentTrail,TRAIL_MOVES} from './resident-trail.js';
const assert=(v,m)=>{if(!v)throw new Error(m);};
export const TRAIL_CHECKS=[
 {id:'trail-start',label:'След: запись начинается с выбора и только для выбранного',run(){
  const trail=new ResidentTrail(),world={},a={id:1,x:3,y:4};trail.moved(a);assert(!trail.points.length,'Записана жизнь до выбора');
  trail.select(world,a);trail.moved({id:2,x:9,y:9});assert(trail.points.length===1,'Записана другая особь');
  a.x++;trail.moved(a);assert(trail.points.length===2&&trail.points[0].x===3,'Потерян старт');
 }},
 {id:'trail-limit',label:'След: максимум 20 перемещений между любыми кадрами',run(){
  const trail=new ResidentTrail(),a={id:1,x:0,y:0};trail.select({},a);
  for(let x=1;x<=100;x++){a.x=x;trail.moved(a);}
  assert(trail.points.length===TRAIL_MOVES+1&&trail.points[0].x===80&&trail.points.at(-1).x===100,'Неверный хвост');
 }},
 {id:'trail-wait-death',label:'След: ожидание, повторный выбор и смерть не стирают путь',run(){
  const trail=new ResidentTrail(),world={},a={id:1,x:0,y:0,alive:true};trail.select(world,a);a.x=1;trail.moved(a);
  for(let i=0;i<30;i++)trail.moved(a);trail.select(world,a);a.alive=false;
  assert(trail.points.length===2,'След стёрт без перемещения');
 }},
 {id:'trail-switch',label:'След: другая особь и новый мир начинают новый маршрут',run(){
  const trail=new ResidentTrail(),world={},a={id:1,x:0,y:0};trail.select(world,a);a.x=1;trail.moved(a);
  trail.select(world,{id:2,x:5,y:5});assert(trail.points.length===1&&trail.points[0].x===5,'Склеены разные жизни');
  trail.select({},a);assert(trail.points.length===1&&trail.id===1,'Новый мир сохранил маршрут');
 }},
 {id:'trail-hook',label:'След: подключение сохраняет исполнение движения',run(){
  const trail=new ResidentTrail(),a={id:1,x:0,y:0},world={count:0,moveAgent(agent,destination){this.count++;Object.assign(agent,destination);}};
  trail.select(world,a);attachResidentTrail(world,trail);world.moveAgent(a,{x:1,y:0});world.moveAgent(a,{x:2,y:0});
  assert(world.count===2&&a.x===2&&trail.points.length===3,'Изменено движение/потеряны события');
 }},
];
