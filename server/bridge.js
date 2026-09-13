import {resolveMediaSource} from './media.js';
import {operations,validateOperation} from '../src/operations.js';
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
export function createBridge({token,extensionId,timeoutMs=90000}){
 let pending=null,lastSeen=null,owner=null,extensionInfo=null;
 const same=x=>typeof x==='string'&&Buffer.byteLength(x)===Buffer.byteLength(token)&&timingSafeEqual(Buffer.from(x),Buffer.from(token));
 const finish=(result)=>{if(pending){clearTimeout(pending.timer);pending.resolve(result);pending=null;}};
 const server=createServer(async(req,res)=>{
 const origin=req.headers.origin;
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(origin===('chrome-extension://'+extensionId)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, GET, OPTIONS'}:{})});res.end(JSON.stringify(value));};
 if(req.headers.host!==`127.0.0.1:${server.address().port}` || (origin&&origin!=='chrome-extension://'+extensionId)){send(403,{error:'origin_denied'});return;}
 if(req.method==='OPTIONS'){send(204,{});return;}
 if(!same(req.headers.authorization?.replace(/^Bearer /,''))){send(401,{error:'unauthorized'});return;}
 try{
 let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32e6)throw Error('body_too_large');}
 const data=body?JSON.parse(body):{};
 if(req.url==='/media/resolve'&&req.method==='POST'){
 if(!origin)throw Error('extension_origin_required');
 if(typeof data.url!=='string')throw Error('URL required');
 const resolved=await resolveMediaSource({url:data.url});send(200,resolved);return;
 }
 if(req.url==='/health'&&req.method==='GET'){send(200,{connected:!!lastSeen&&Date.now()-lastSeen<10000,busy:!!pending,extension:extensionInfo});return;}
 if(req.url==='/poll'&&req.method==='POST'){
 if(!origin)throw Error('extension_origin_required');
 if(typeof data.clientId!=='string'||data.clientId.length>80)throw Error('client_id_required');
 if(owner&&owner!==data.clientId&&lastSeen&&Date.now()-lastSeen<10000){send(409,{error:'another_extension_window_connected'});return;}
 owner=data.clientId;lastSeen=Date.now();extensionInfo={version:typeof data.version==='string'?data.version:null,reloadReceipt:data.reloadReceipt??null};
 if(pending&&!pending.delivered){pending.delivered=true;send(200,{job:{id:pending.id,command:pending.command,args:pending.args}});}else send(200,{job:null});return;
 }
 if(req.url==='/result'&&req.method==='POST'){
 if(!origin||data.clientId!==owner||!pending||data.id!==pending.id||!pending.delivered){send(409,{error:'stale_result'});return;}
 finish(data.result);send(200,{ok:true});return;
 }
 if(req.url==='/command'&&req.method==='POST'){
 if(origin){send(403,{error:'mcp_only'});return;}
 if(!operations[data.command]&&!['read_account','inspect_form','prepare_form','reload_extension'].includes(data.command)){send(400,{error:'command_disabled'});return;}
 if(operations[data.command]){
 const errors=validateOperation(data.command,data.args??{});if(errors.length){send(400,{error:errors.join('; ')});return;}
 data.args={...data.args,allowWrite:operations[data.command].write===true};
 }
 if(!lastSeen||Date.now()-lastSeen>10000){send(409,{error:'extension_disconnected'});return;}
 if(pending){send(409,{error:'busy'});return;}
 const result=await new Promise(resolve=>{
 pending={id:randomBytes(16).toString('hex'),command:data.command,args:data.args??{},resolve,delivered:false};
 pending.timer=setTimeout(()=>finish({error:'timeout_outcome_unknown_do_not_retry_mutations'}),timeoutMs);
 });send(200,result);return;
 }
 send(404,{error:'not_found'});
 }catch(e){send(400,{error:e.message});}
 });
 server.on('close',()=>finish({error:'bridge_closed'}));
 return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../',import.meta.url)),dir=join(root,'.local');await mkdir(dir,{recursive:true,mode:0o700});
 let config;try{config=JSON.parse(await readFile(join(dir,'bridge.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;config={token:randomBytes(32).toString('hex'),port:18791};}
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 const {createHash}=await import('node:crypto');
 config.extensionId=[...createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest().subarray(0,16)].map(b=>(b>>4).toString(16)+(b&15).toString(16)).join('').replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 await writeFile(join(dir,'bridge.json'),JSON.stringify(config),{mode:0o600});
 // Local pairing credential stays in the locally installed extension, never in release archives.
 await writeFile(join(root,'src/local-config.js'),'export default '+JSON.stringify(config)+';\n',{mode:0o600});
 const server=createBridge(config);server.listen(config.port,'127.0.0.1',()=>console.error('Telegram Ads bridge listening on loopback port '+config.port));
}
