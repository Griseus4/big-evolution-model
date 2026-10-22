/** Выражения наблюдателя. Собственный небольшой разбор вместо eval: только
 * числа, поля, арифметика, сравнения и явно перечисленные функции. */
const blocked=new Set(['__proto__','prototype','constructor']);
const precedence={'||':1,'&&':2,'==':3,'!=':3,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
export function numericField(row,path){
 let value=row;for(const key of path.split('.')){if(blocked.has(key)||!value||!Object.hasOwn(value,key))return null;value=value[key];}
 return typeof value==='boolean'?Number(value):typeof value==='number'&&Number.isFinite(value)?value:null;
}
export function compileExpression(source){
 if(typeof source!=='string'||!source.trim()||source.length>600)throw new Error('Выражение должно содержать от 1 до 600 символов.');
 const tokens=[];let offset=0;
 while(offset<source.length){const rest=source.slice(offset),space=/^\s+/.exec(rest);if(space){offset+=space[0].length;continue;}
  const match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*|^(?:&&|\|\||<=|>=|==|!=|[()+\-*/%,!<>])/.exec(rest);
  if(!match)throw new Error(`Неизвестный символ в выражении: ${rest.slice(0,16)}`);tokens.push(match[0]);offset+=match[0].length;
 }
 let at=0,depth=0;const fields=new Set(),births=new Set();
 function primary(){
  if(++depth>40)throw new Error('Слишком вложенное выражение.');let node;const token=tokens[at++];
  if(['!','-','+'].includes(token))node=['unary',token,primary()];
  else if(token==='('){node=expression(0);if(tokens[at++]!==')')throw new Error('Не закрыта скобка.');}
  else if(token!==undefined&&/^(?:\d|\.)/.test(token)){const n=Number(token);if(!Number.isFinite(n))throw new Error('Число должно быть конечным.');node=['number',n];}
  else if(token&&/^[A-Za-z_]/.test(token)){
   if(token.split('.').some(k=>blocked.has(k)))throw new Error('Недопустимое имя поля.');
   if(tokens[at]==='('){at++;const args=[];if(tokens[at]!==')'){do{args.push(expression(0));if(tokens[at]!==',')break;at++;}while(true);}if(tokens[at++]!==')')throw new Error('Не закрыт вызов функции.');
    const arity={abs:1,min:2,max:2,missing:1,birthAge:1};if(arity[token]!==args.length)throw new Error('Допустимы abs(x), min(x,y), max(x,y), missing(x), birthAge(N).');
    if(token==='birthAge'){const dynamic=args[0][0]==='field'&&args[0][1]==='N';if(!dynamic&&(args[0][0]!=='number'||!Number.isSafeInteger(args[0][1])||args[0][1]<1||args[0][1]>1000))throw new Error('Номер ребёнка — целое число от 1 до 1000 или N для оси номера ребёнка.');births.add(dynamic?0:args[0][1]);}node=['call',token,args];
   }else if(token==='true'||token==='false')node=['number',Number(token==='true')];
   else{fields.add(token);node=['field',token];}
  }else throw new Error('Ожидается число, поле или скобка.');depth--;return node;
 }
 function expression(min){let left=primary();while(precedence[tokens[at]]>=min){const op=tokens[at++];left=['binary',op,left,expression(precedence[op]+1)];}return left;}
 const tree=expression(0);if(at!==tokens.length)throw new Error('Лишние части выражения.');
 function evaluate(n,get,birth){
  if(n[0]==='number')return n[1];if(n[0]==='field')return get(n[1]);
  if(n[0]==='unary'){const a=evaluate(n[2],get,birth);return a===null?null:n[1]==='!'?Number(!a):n[1]==='-'?-a:a;}
  if(n[0]==='call'){if(n[1]==='birthAge')return birth(evaluate(n[2][0],get,birth));const a=n[2].map(v=>evaluate(v,get,birth));if(n[1]==='missing')return Number(a[0]===null);if(a.includes(null))return null;return n[1]==='abs'?Math.abs(a[0]):n[1]==='min'?Math.min(...a):Math.max(...a);}
  const op=n[1],a=evaluate(n[2],get,birth);if(op==='&&'&&a===0)return 0;if(op==='||'&&a!==null&&a!==0)return 1;
  const b=evaluate(n[3],get,birth);if(a===null||b===null)return null;
  switch(op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return b===0?null:a/b;case '%':return b===0?null:a%b;case '<':return Number(a<b);case '<=':return Number(a<=b);case '>':return Number(a>b);case '>=':return Number(a>=b);case '==':return Number(a===b);case '!=':return Number(a!==b);case '&&':return Number(Boolean(a&&b));case '||':return Number(Boolean(a||b));}
 }
 return {fields:[...fields],births:[...births],evaluate(get,birth=()=>null){const value=evaluate(tree,get,birth);return Number.isFinite(value)?value:null;}};
}
