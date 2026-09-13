import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {downloadMedia,classifyAddress} from '../server/download.js';
import {resolveMediaSource} from '../server/media.js';
test('URL downloader follows bounded redirects, caches by hash and rejects HTML/oversize',async()=>{
 const bytes=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(16)]);
 const dir=await mkdtemp(join(tmpdir(),'tg-download-'));
 const server=createServer((req,res)=>{
 assert.equal(req.headers.cookie,undefined);assert.equal(req.headers.authorization,undefined);
 if(req.url==='/redirect'){res.writeHead(302,{Location:'/video'});res.end();return;}
 if(req.url==='/html'){res.end('<html>Login</html>');return;}
 if(req.url==='/big'){res.writeHead(200,{'Content-Length':20971521});res.end();return;}
 if(req.url==='/private'){res.writeHead(302,{Location:'http://169.254.169.254/latest/meta-data'});res.end();return;}
 if(req.url==='/loop'){res.writeHead(302,{Location:'/loop'});res.end();return;}
 if(req.url==='/slow'){return;}
 res.end(bytes);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
 const first=await downloadMedia(base+'/redirect',{cacheDir:dir});
 const second=await downloadMedia(base+'/video',{cacheDir:dir});
 assert.equal(first.path,second.path);assert.deepEqual(await readFile(first.path),bytes);assert.equal((await readdir(dir)).length,1);
 await assert.rejects(downloadMedia(base+'/html',{cacheDir:dir}),/did not return/);
 await assert.rejects(downloadMedia(base+'/big',{cacheDir:dir}),/limit/);
 await assert.rejects(downloadMedia(base+'/private',{cacheDir:dir}),/not allowed/);
 await assert.rejects(downloadMedia(base+'/loop',{cacheDir:dir}),/redirects/);
 await assert.rejects(downloadMedia(base+'/slow',{cacheDir:dir,timeoutMs:50}),/timeout/);
 assert.equal((await readdir(dir)).length,1);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
test('URL credentials, file scheme and conflicting source rejected',async()=>{
 await assert.rejects(downloadMedia('file:///etc/passwd'),/HTTP/);
 await assert.rejects(downloadMedia('https://user:password@example.com/video'),/credentials/);
 await assert.rejects(resolveMediaSource({path:'/tmp/a',url:'https://example.com/a'}),/exactly one/);
 assert.equal(classifyAddress('127.0.0.1'),'loopback');
 assert.equal(classifyAddress('::ffff:127.0.0.1'),'loopback');
 assert.notEqual(classifyAddress('10.0.0.1'),'unicast');
});
