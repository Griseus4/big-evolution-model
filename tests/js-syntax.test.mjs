import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const helper=fileURLToPath(new URL('../tools/check-js-syntax.mjs',import.meta.url));
test('batch parser accepts module syntax without importing dependencies or running side effects',()=>{
 const dir=mkdtempSync(join(tmpdir(),'big-evolution-syntax-')),file=join(dir,'module.js');try{writeFileSync(file,"import missing from './does-not-exist.js';\nexport const url=import.meta.url;\nawait Promise.reject(new Error('MUST NOT EXECUTE'));\nthrow new Error('MUST NOT EXECUTE');");const r=spawnSync(process.execPath,['--experimental-vm-modules',helper],{input:JSON.stringify([file]),encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/1 modules parsed/);}finally{rmSync(file,{force:true});rmdirSync(dir);}
});
test('batch parser rejects invalid syntax with the original filename',()=>{
 const dir=mkdtempSync(join(tmpdir(),'big-evolution-syntax-')),file=join(dir,'broken.js');try{writeFileSync(file,'export const = 1;');const r=spawnSync(process.execPath,['--experimental-vm-modules',helper],{input:JSON.stringify([file]),encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/SyntaxError/);assert.ok(r.stderr.includes('broken.js'));}finally{rmSync(file,{force:true});rmdirSync(dir);}
});
