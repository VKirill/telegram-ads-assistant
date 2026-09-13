import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Service} from '../server/service.js';
import {validatePackage} from '../src/core.js';
const fixture=JSON.parse(await readFile(new URL('../fixtures/example.json',import.meta.url)));
test('all four target plans validate; Users never means personal user IDs',()=>{
 for(const [type,key,value] of [['search','queries','фотосессия'],['bots','bots','ExampleBot'],['users','countries','Germany'],['channels','channels','examplechannel']]){
 const p=structuredClone(fixture);for(const a of p.ads){delete a.channels;if(['search','bots'].includes(type))delete a.media;a.target={type,[key]:[value]};if(type==='search')a.url='https://t.me/ExampleBot';}assert.deepEqual(validatePackage(p),[]);
 }
});
test('local staging idempotent; different content with same ID rejected; missing stats not zero',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tg-assistant-'));try{
 const s=new Service(dir);await s.call('stage_package',{package:fixture});await s.call('stage_package',{package:fixture});
 assert.equal((await s.call('list_packages')).length,1);
 const changed=structuredClone(fixture);changed.ads[0].title='Changed';
 await assert.rejects(s.call('stage_package',{package:changed}),/ID/);
 assert.equal((await s.call('get_statistics',{})).rows,null);
 assert.equal((await s.call('capabilities')).publishingEnabled,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
