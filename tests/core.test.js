import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {validatePackage,plan} from '../src/core.js';
const sample=()=>JSON.parse(fs.readFileSync(new URL('../fixtures/example.json',import.meta.url)));
test('valid bounded package',()=>assert.deepEqual(validatePackage(sample()),[]));
test('blocks overspend',()=>{const p=sample();p.totalBudget=1;assert.match(validatePackage(p).join(),/превышает/);});
test('blocks duplicate IDs, case-insensitive channels and external IDs',()=>{const p=sample();p.ads[1].id=p.ads[0].id;p.ads[0].channels=['Example','example'];p.ads.forEach(a=>a.externalId=148);assert.ok(validatePackage(p).length>=3);});
test('rejects unsafe destinations and long payloads',()=>{for(const url of ['javascript:alert(1)','https://evil.test/?start=ok','https://t.me/ExampleBot?start='+ 'a'.repeat(65)]){const p=sample();p.ads[0].url=url;assert.ok(validatePackage(p).length);}});
test('blocks activation and malformed numbers',()=>{const p=sample();p.ads[0].status='active';p.ads[0].budget=Infinity;assert.ok(validatePackage(p).some(e=>e.includes('бюджет')));assert.ok(validatePackage(p).some(e=>e.includes('on_hold')));});
test('existing and prepared ads not eligible for blind repeat',()=>{const p=sample();p.ads[0].externalId=148;assert.deepEqual(plan(p,{'demo-b':{state:'prepared'}}).map(x=>x.action),['existing','verify_before_repeat']);});
test('Search accepts plain bot URL and rejects start parameters',()=>{const p=sample();for(const a of p.ads){delete a.channels;delete a.media;a.target={type:'search',queries:['фото']};a.url='https://t.me/ExampleBot';}assert.deepEqual(validatePackage(p),[]);p.ads[0].url+='?start=test';assert.ok(validatePackage(p).length);});
