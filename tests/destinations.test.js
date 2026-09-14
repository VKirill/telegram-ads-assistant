import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {destinationKind,destinationErrors,validateCurrency} from '../src/destinations.js';
import {validatePackage} from '../src/core.js';
import {readCabinetConstraints} from '../src/constraints.js';
import {validateOperation} from '../src/operations.js';
const sample=url=>({version:1,id:'website-test',currency:'EUR',totalBudget:2,ads:[{id:'a',title:'A',text:'Сервис для фотографий.',url,budget:2,cpm:.75,status:'on_hold',target:{type:'channels',channels:['examplechannel']}}]});
test('website URL and UTM remain unchanged; EUR and TON are syntax-valid pending server check',()=>{
 for(const currency of ['EUR','TON','XTR']){
 const p=sample('https://example.com/landing?utm_source=telegram_ads&utm_content=a#price');p.currency=currency;p.ads[0].websiteName='Название сервиса';
 assert.deepEqual(validatePackage(p),[]);assert.equal(destinationKind(p.ads[0].url),'website');assert.match(p.ads[0].url,/utm_source=telegram_ads/);
 }
});
test('channel, post, invite and optional bot start no longer forced into bot-only funnel',()=>{
 for(const url of ['https://t.me/ExampleChannel','https://t.me/ExampleChannel/42','https://t.me/+ExampleInvite','https://t.me/joinchat/ExampleInvite','https://t.me/ExampleBot?start=test_a'])assert.deepEqual(validatePackage(sample(url)),[],url);
 for(const url of ['https://t.me/ExampleBot?start=x&start=y','https://t.me/ExampleBot?utm_source=x','https://t.me/ExampleBot?start='+ 'x'.repeat(65)])assert.ok(validatePackage(sample(url)).length,url);
});
test('malformed and unsafe schemes/credentials remain rejected',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://u:p@example.com','https://127.0.0.1','https://[::1]','https://localhost','https://x.local','https://t.me/ExampleBot#x'])assert.ok(destinationErrors(url).length,url);
 assert.ok(validateOperation('prepare_edit',{adId:'1',patch:{url:'javascript:alert(1)'}}).length);
});
test('search only accepts plain Telegram destination, not website/post/start',()=>{
 for(const url of ['https://example.com','https://t.me/ExampleChannel/42','https://t.me/ExampleBot?start=x'])assert.ok(destinationErrors(url,'search').length);
 assert.deepEqual(destinationErrors('https://t.me/ExampleChannel','search'),[]);
});
test('no currency conversion or unknown account guessing',()=>{
 assert.equal(validateCurrency('EUR','EUR'),null);
 assert.match(validateCurrency('EUR','TON'),/не совпадает/);
 assert.match(validateCurrency('TON',null),/не определена/);
 const p=sample('https://example.com');p.currency='RUB';assert.ok(validatePackage(p).length);
});
test('text URL must match destination origin and path',()=>{
 const p=sample('https://example.com/landing?utm_source=tg');p.ads[0].text='Сервис: https://example.com/landing';assert.deepEqual(validatePackage(p),[]);
 p.ads[0].text='Сервис: https://other.com/landing';assert.ok(validatePackage(p).length);
 p.ads[0].text='Сервис: https://example.com/other';assert.ok(validatePackage(p).length);
});
test('live constraints extract only currency/account allowlist and no secrets',()=>{
 for(const [label,currency] of [['<span class="currency-euro">€</span>','EUR'],['<span class="currency-ton">TON</span>','TON'],['<span class="currency-star">⭐️</span>','XTR'],['',null]]){
 const dom=new JSDOM('',{url:'https://ads.telegram.org/account/ad/new',runScripts:'outside-only'});
 try{dom.window.Aj={state:{ownerId:42,ownerCurrency:label,token:'do-not-return',textMaxLength:160}};const r=dom.window.eval('('+readCabinetConstraints.toString()+')()');assert.equal(r.currency,currency);assert.equal(r.accountId,'42');assert.ok(!JSON.stringify(r).includes('do-not-return'));}finally{dom.window.close();}
 }
});
