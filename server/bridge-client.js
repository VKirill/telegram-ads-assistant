import {readFile} from 'node:fs/promises';
const configUrl=new URL('../.local/bridge.json',import.meta.url);
export async function browserCall(command,args={}){
 let config;try{config=JSON.parse(await readFile(configUrl,'utf8'));}catch(e){if(e.code==='ENOENT')return {error:'bridge_not_started'};throw e;}
 try{const response=await fetch('http://127.0.0.1:'+config.port+(command==='extension_status'?'/health':'/command'),{method:command==='extension_status'?'GET':'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:command==='extension_status'?undefined:JSON.stringify({command,args}),signal:AbortSignal.timeout(95000)});return await response.json();}
 catch{return {error:'bridge_unavailable_or_timeout',retryMutations:false};}
}
