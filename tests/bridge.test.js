import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridge} from '../server/bridge.js';
test('bridge rejects foreign origin/unauthenticated calls and serializes reload with jobs',async()=>{
 const token='a'.repeat(64),extensionId='b'.repeat(32);
 const server=createBridge({token,extensionId,timeoutMs:500});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 async function call(path,body,origin,auth=token){
 const response=await fetch(url+path,{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
 return {status:response.status,body:await response.json()};
 }
 try{
 assert.equal((await call('/poll',{},'https://evil.example')).status,403);
 assert.equal((await call('/poll',{},undefined,'wrong')).status,401);
 const origin='chrome-extension://'+extensionId;
 await call('/poll',{clientId:'owner',version:'0.2.1'},origin);
 const request=call('/command',{command:'reload_extension'});
 let job;
 for(let i=0;i<20&&!job;i++){job=(await call('/poll',{clientId:'owner'},origin)).body.job;if(!job)await new Promise(r=>setTimeout(r,10));}
 assert.ok(job);
 assert.equal((await call('/command',{command:'read_account'})).status,409);
 assert.equal((await call('/result',{clientId:'intruder',id:job.id,result:{}},origin)).status,409);
 await call('/result',{clientId:'owner',id:job.id,result:{state:'reload_requested'}},origin);
 assert.equal((await request).body.state,'reload_requested');
 assert.equal((await call('/command',{command:'create_ad'})).status,400);
 assert.equal((await call('/command',{command:'commit_edit',args:{adId:'148'}})).status,400);
 const commit=call('/command',{command:'commit_edit',args:{adId:'148',operationId:'test-operation',expectedFingerprint:'fixture'}});
 let writeJob;
 for(let i=0;i<20&&!writeJob;i++){writeJob=(await call('/poll',{clientId:'owner'},origin)).body.job;if(!writeJob)await new Promise(r=>setTimeout(r,10));}
 assert.equal(writeJob.command,'commit_edit');assert.equal(writeJob.args.allowWrite,true);
 await call('/result',{clientId:'owner',id:writeJob.id,result:{state:'fixture_only'}},origin);
 assert.equal((await commit).body.state,'fixture_only');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
