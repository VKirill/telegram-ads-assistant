import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareReload,restoreAfterReload,validReloadSender} from '../src/reload.js';
test('reload stores recovery before acknowledgment; restores only own dashboard',async()=>{
 const saved={},calls=[],url='chrome-extension://abc/index.html';
 const api={runtime:{id:'abc',getURL:()=>url,getManifest:()=>({version:'0.2.0'})},storage:{local:{set:async x=>Object.assign(saved,x),get:async()=>saved}},tabs:{getCurrent:async()=>({id:4}),get:async()=>({id:4,url:'https://ads.telegram.org/account'}),create:async x=>calls.push(['create',x]),update:async()=>{throw Error('must not touch Ads')}}};
 const result=await prepareReload(api,'owner','job');assert.equal(saved.reloadPending.requestId,'job');assert.equal(result.state,'reload_requested');
 await restoreAfterReload(api);assert.equal(calls[0][1].url,url);assert.equal(calls[0][1].active,false);
 assert.equal(validReloadSender(api,{id:'abc',url}),true);
 assert.equal(validReloadSender(api,{id:'abc',url:'https://ads.telegram.org'}),false);
});
test('no marker means no restart loop',async()=>{await restoreAfterReload({storage:{local:{get:async()=>({})}}});});
