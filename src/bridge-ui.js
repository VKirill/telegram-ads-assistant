import {readCabinetConstraints} from './constraints.js';
import {cabinetOperation} from './cabinet.js';
import {operations,validateOperation} from './operations.js';
import {prepareReload} from './reload.js';
import {formBridge} from './adapter.js';
import {readAccountSnapshot} from './stats.js';
import {validatePackage} from './core.js';
let running=false,config,clientId=crypto.randomUUID();
const state=document.getElementById('bridge-state');
async function api(path,body){const r=await fetch('http://127.0.0.1:'+config.port+path,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error);return result;}
async function tabFor(kind){
 const tabs=await chrome.tabs.query({url:'https://ads.telegram.org/*'});
 const owned=(await chrome.storage.local.get('operationTab')).operationTab;
 const matches=tabs.filter(t=>new URL(t.url).pathname===(kind==='account'?'/account':'/account/ad/new'));
 if(kind==='account'&&matches.some(t=>t.id===owned))return owned;
 if(matches.length===0&&kind==='account')return (await chrome.tabs.create({url:'https://ads.telegram.org/account',active:false})).id;
 if(matches.length!==1)throw Error('Нужна ровно одна вкладка '+(kind==='account'?'/account':'нового объявления'));
 return matches[0].id;
}
async function run(job){
 if(operations[job.command]){
 const errors=validateOperation(job.command,job.args);if(errors.length)throw Error(errors.join('; '));
 if(job.command==='prepare_ad'){
 const ad=job.args.ad,validation=validatePackage({version:1,id:'validation',currency:'TON',totalBudget:ad.budget,ads:[ad]});
 if(validation.length)throw Error(validation.join('; '));
 }
 const stored=await chrome.storage.local.get('operationTab');
 let tab;try{if(stored.operationTab)tab=await chrome.tabs.get(stored.operationTab);}catch{}
 const path=job.command==='prepare_ad'||(!job.args.adId)?'/account/ad/new':'/account/ad/'+job.args.adId+(['read_budget','prepare_budget','commit_budget'].includes(job.command)?'/budget':['read_statistics','export_csv'].includes(job.command)?'/stats':'');
 if(!tab||!tab.url?.startsWith('https://ads.telegram.org/')){
 tab=await chrome.tabs.create({url:'https://ads.telegram.org'+path+(['read_statistics','export_csv'].includes(job.command)&&job.args.month?'?month='+job.args.month:''),active:false});
 await chrome.storage.local.set({operationTab:tab.id});
 }else if(new URL(tab.url).pathname!==path){
 if(['commit_ad','commit_edit','commit_budget','upload_media'].includes(job.command))throw Error('Prepared tab no longer matches; inspect first');
 await chrome.tabs.update(tab.id,{url:'https://ads.telegram.org'+path+(['read_statistics','export_csv'].includes(job.command)&&job.args.month?'?month='+job.args.month:'')});
 }
 for(let i=0;i<50;i++){tab=await chrome.tabs.get(tab.id);if(tab.status==='complete')break;await new Promise(r=>setTimeout(r,100));}
 if(job.command==='prepare_ad'){const constraints=(await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:readCabinetConstraints}))[0]?.result;const ad=job.args.ad;const errors=validatePackage({version:1,id:'validation',currency:'TON',totalBudget:ad.budget,ads:[ad]},constraints);if(errors.length)return {error:errors.join('; '),errors,constraints};}
 if(job.command==='read_constraints')return (await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:readCabinetConstraints}))[0]?.result;
 if(operations[job.command].write){
 const key='op-'+job.args.operationId;if((await chrome.storage.local.get(key))[key])throw Error('Operation already attempted; re-read instead of retry');
 await chrome.storage.local.set({[key]:{state:'attempting',time:new Date().toISOString()}});
 }
 const out=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:cabinetOperation,args:[job.command,job.args]}))[0]?.result;
 if(out==null)throw Error('No result from cabinet adapter');
 return out;
 }

 if(job.command==='reload_extension')return prepareReload(chrome,clientId,job.id);
 if(job.command==='read_account'){
 const tabId=await tabFor('account');return (await chrome.scripting.executeScript({target:{tabId},func:readAccountSnapshot}))[0].result;
 }
 if(job.command==='inspect_form'){
 const tabId=await tabFor('form');return (await chrome.scripting.executeScript({target:{tabId},func:formBridge,args:['inspect',null]}))[0].result;
 }
 if(job.command==='prepare_form'){
 const p=job.args.package,errors=validatePackage(p);if(errors.length)throw Error(errors.join('; '));
 const ad=p.ads.find(a=>a.id===job.args.adId);if(!ad)throw Error('Объявление не найдено');
 const key='mcp-prepared-'+p.id+'-'+ad.id;
 if((await chrome.storage.local.get(key))[key])throw Error('Попытка уже записана. Сначала сверка формы, автоматического повтора нет');
 const tabId=await tabFor('form');
 await chrome.storage.local.set({[key]:{state:'attempting',at:new Date().toISOString()}});
 return (await chrome.scripting.executeScript({target:{tabId},func:formBridge,args:['prepare',ad]}))[0].result;
 }
 throw Error('Команда запрещена');
}
document.getElementById('bridge-connect').onclick=async()=>{
 if(running){running=false;await chrome.storage.local.set({bridgeAutoConnect:false});state.textContent='Отключено';return;}
 try{config=(await import('./local-config.js')).default;await chrome.storage.local.set({bridgeAutoConnect:true});running=true;state.textContent='Соединение…';
 while(running){
 let response;try{response=await api('/poll',{clientId,version:chrome.runtime.getManifest().version,reloadReceipt:(await chrome.storage.local.get('reloadReceipt')).reloadReceipt??null});}catch(e){state.textContent='Переподключение MCP: '+e.message;await new Promise(r=>setTimeout(r,2000));continue;}const {job}=response;state.textContent='MCP подключён';
 if(job){let result;try{result=await run(job);}catch(e){result={error:e.message};}await api('/result',{clientId,id:job.id,result});document.getElementById('bridge-result').textContent=JSON.stringify(result,null,2);if(job.command==='reload_extension'&&!result.error){running=false;await chrome.runtime.sendMessage({type:'reload_extension'});return;}}
 await new Promise(r=>setTimeout(r,1000));
 }
 }catch(e){running=false;state.textContent='MCP: '+e.message;}
};

if(typeof chrome!=='undefined'&&chrome.storage){
 const {reloadPending,bridgeAutoConnect}=await chrome.storage.local.get(['reloadPending','bridgeAutoConnect']);
 if(reloadPending){clientId=reloadPending.clientId;await chrome.storage.local.set({reloadReceipt:{requestId:reloadPending.requestId,version:chrome.runtime.getManifest().version,bootedAt:new Date().toISOString()}});await chrome.storage.local.remove('reloadPending');document.getElementById('bridge-connect').click();}
 else if(bridgeAutoConnect!==false)document.getElementById('bridge-connect').click();
}
