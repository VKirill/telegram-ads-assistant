import http from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ipaddr from 'ipaddr.js';
const CACHE=fileURLToPath(new URL('../.local/media-cache/',import.meta.url));
const MAX=20971520;
export function classifyAddress(address){
 let ip=ipaddr.parse(address);if(ip.kind()==='ipv6'&&ip.isIPv4MappedAddress())ip=ip.toIPv4Address();
 return ip.range();
}
function parse(raw){
 const u=new URL(raw);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash)throw Error('Use an HTTP(S) URL without credentials or fragment');
 return u;
}
const host=u=>u.hostname.replace(/^\[|\]$/g,'');
const local=h=>h==='localhost'||(isIP(h)&&classifyAddress(h)==='loopback');
async function destination(u,allowLoopback){
 const h=host(u),addresses=isIP(h)?[{address:h,family:isIP(h)}]:await lookup(h,{all:true});
 if(!addresses.length||addresses.some(a=>classifyAddress(a.address)!=='unicast'&&!(allowLoopback&&local(h)&&classifyAddress(a.address)==='loopback')))throw Error('This network destination is not allowed');
 return addresses[0];
}
async function request(u,allowLoopback,deadline){
 const address=await destination(u,allowLoopback);
 return new Promise((resolve,reject)=>{
 let settled=false;const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
 const request=(u.protocol==='https:'?https:http).get(u,{
 agent:false,
 lookup:(_hostname,opts,cb)=>opts.all?cb(null,[address]):cb(null,address.address,address.family),
 headers:{Accept:'video/mp4,image/png,image/jpeg,application/octet-stream','Accept-Encoding':'identity'}
 },res=>{
 if([301,302,303,307,308].includes(res.statusCode)){
 const redirect=res.headers.location;res.destroy();return redirect?done(null,{redirect:new URL(redirect,u)}):done(Error('Redirect without location'));
 }
 if(res.statusCode!==200){res.destroy();done(Error('Media download HTTP '+res.statusCode));return;}
 if(Number(res.headers['content-length'])>MAX){res.destroy();done(Error('Media exceeds 20 MB download limit'));return;}
 const chunks=[];let size=0;
 res.on('data',chunk=>{size+=chunk.length;if(size>MAX){res.destroy();done(Error('Media exceeds 20 MB download limit'));return;}chunks.push(chunk);});
 res.on('end',()=>done(null,{bytes:Buffer.concat(chunks)}));
 res.on('error',e=>done(e));
 res.on('aborted',()=>done(Error('Media download interrupted')));
 });
 const timer=setTimeout(()=>request.destroy(Error('Media download timeout')),Math.max(1,deadline-Date.now()));
 request.on('error',e=>done(e));
 });
}
export async function downloadMedia(raw,{cacheDir=CACHE,timeoutMs=30000}={}){
 const initial=parse(raw),allowLoopback=local(host(initial)),deadline=Date.now()+timeoutMs;
 let u=initial,response;
 for(let redirects=0;redirects<=4;redirects++){
 if(Date.now()>=deadline)throw Error('Media download timeout');
 response=await request(parse(u.href),allowLoopback,deadline);
 if(!response.redirect)break;
 if(redirects===4)throw Error('Too many media redirects');u=response.redirect;
 }
 const bytes=response.bytes;
 const ext=bytes.subarray(4,8).toString()==='ftyp'?'.mp4':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'.png':bytes[0]===255&&bytes[1]===216?'.jpg':null;
 if(!ext)throw Error('URL did not return MP4, PNG or JPEG (HTML/login pages are not media)');
 if(ext!=='.mp4'&&bytes.length>5242880)throw Error('Image exceeds 5 MB cabinet limit');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 await mkdir(cacheDir,{recursive:true,mode:0o700});
 const entries=(await readdir(cacheDir)).filter(n=>/^[a-f0-9]{64}\.(mp4|png|jpg)$/.test(n));
 const sizes=await Promise.all(entries.map(n=>stat(join(cacheDir,n)).then(s=>s.size)));
 const name=sha256+ext;
 if(!entries.includes(name)&&sizes.reduce((a,b)=>a+b,0)+bytes.length>200*1024*1024)throw Error('Local media cache is full (200 MB)');
 const path=join(cacheDir,name);
 try{await writeFile(path,bytes,{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 return {path,sha256,bytes:bytes.length,sourceOrigin:initial.origin,downloadedAt:new Date().toISOString()};
}
