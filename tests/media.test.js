import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{loadMedia}from'../server/media.js';
test('media rejects disguised and oversized files before browser upload',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tg-media-'));try{
 const path=join(dir,'a.png');await writeFile(path,'not png');await assert.rejects(loadMedia(path),/signature/);
 await writeFile(path,Buffer.alloc(5242881));await assert.rejects(loadMedia(path),/size limit/);
 const valid=Buffer.from([137,80,78,71,13,10,26,10,0]);await writeFile(path,valid);
 const r=await loadMedia(path);assert.equal(r.mime,'image/png');assert.equal(r.sha256.length,64);
 }finally{await rm(dir,{recursive:true,force:true});}
});
