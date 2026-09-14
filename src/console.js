import {readCabinetConstraints} from './constraints.js';
import {validateCurrency} from './destinations.js';
import {validatePackage} from './core.js';
import {cabinetOperation} from './cabinet.js';
import {readAccountSnapshot} from './stats.js';
import {validateOperation} from './operations.js';
const q=id=>document.getElementById(id);
let last=null,busy=false;
function show(value){
 q('cabinet-output').textContent=JSON.stringify(value,null,2);
 q('cabinet-status').textContent=value?.error?value.error:value?.rows?'Объявлений: '+value.rows.length+' · '+(value.asOf?new Date(value.asOf).toLocaleTimeString():''):value?.state??'Данные получены';
 if(!Array.isArray(value?.rows))return;
 const holder=q('cabinet-table');holder.replaceChildren();
 const table=document.createElement('table'),head=document.createElement('thead'),hr=document.createElement('tr');
 for(const label of ['Объявление','Показы','Клики','CPM','Бюджет','Расход','Статус']){const th=document.createElement('th');th.textContent=label;hr.append(th);}head.append(hr);table.append(head);
 const body=document.createElement('tbody');
 for(const row of value.rows){
 const tr=document.createElement('tr');tr.dataset.adId=row.id;
 const values=[row.title,row.views,row.clicks,row.cpm,row.budget,row.spent,row.status];
 values.forEach((v,i)=>{const td=document.createElement('td');if(i===0){const b=document.createElement('button');b.className='row-link';b.textContent=v;b.onclick=()=>pick();td.append(b);}else td.textContent=v??'—';tr.append(td);});
 function pick(){q('ad-id').value=row.id;body.querySelectorAll('tr').forEach(r=>r.classList.remove('selected'));tr.classList.add('selected');}
 tr.onclick=pick;body.append(tr);
 }
 table.append(body);holder.append(table);
}
async function execute(command,args){
 if(busy)throw Error('Дождитесь текущей операции');busy=true;
 try{
 if(command==='prepare_ad'){const ad=args.ad;const errors=validatePackage({version:1,id:'ui',currency:args.currency??'TON',totalBudget:ad?.budget,ads:[ad]});if(errors.length)throw Error(errors.join('; '));}
 if(command!=='read_account'){const e=validateOperation(command,args);if(e.length)throw Error(e.join('; '));}
 const path=command==='read_account'?'/account':command==='prepare_ad'||(!args.adId)?'/account/ad/new':'/account/ad/'+args.adId+(['read_budget','prepare_budget'].includes(command)?'/budget':['read_statistics','export_csv'].includes(command)?'/stats':'');
 let {consoleTab}=await chrome.storage.local.get('consoleTab'),tab;
 try{if(consoleTab)tab=await chrome.tabs.get(consoleTab);}catch{}
 if(!tab){tab=await chrome.tabs.create({url:'https://ads.telegram.org'+path+(['read_statistics','export_csv'].includes(command)&&args.month?'?month='+args.month:''),active:false});await chrome.storage.local.set({consoleTab:tab.id});}
 else if(new URL(tab.url).pathname!==path)await chrome.tabs.update(tab.id,{url:'https://ads.telegram.org'+path+(['read_statistics','export_csv'].includes(command)&&args.month?'?month='+args.month:'')});
 for(let i=0;i<100;i++){const t=await chrome.tabs.get(tab.id);if(t.status==='complete')break;await new Promise(r=>setTimeout(r,100));}
 if(command==='read_account'){await chrome.tabs.reload(tab.id);for(let i=0;i<100;i++){const t=await chrome.tabs.get(tab.id);if(t.status==='complete')break;await new Promise(r=>setTimeout(r,100));}}
 if(command==='prepare_ad'){const constraints=(await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:readCabinetConstraints}))[0]?.result;const currency=args.currency??constraints?.currency;const mismatch=validateCurrency(currency,constraints?.currency);if(mismatch)throw Error(mismatch);const errors=validatePackage({version:1,id:'ui',currency,totalBudget:args.ad.budget,ads:[args.ad]},constraints);if(errors.length)throw Error(errors.join('; '));}
 const fn=command==='read_account'?readAccountSnapshot:cabinetOperation;
 last=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:fn,args:command==='read_account'?[]:[command,args]}))[0]?.result;
 show(last??{error:'missing_result'});
 await chrome.storage.local.set({lastConsoleResult:last});
 }catch(e){show({error:e.message});}finally{busy=false;}
}
q('cabinet-read').onclick=()=>execute('read_account',{});
q('operation-run').onclick=()=>{
 const adId=q('ad-id').value.trim(),command=q('operation-kind').value;
 let payload;try{payload=JSON.parse(q('operation-json').value||'{}');}catch{show({error:'Некорректный JSON'});return;}
 execute(command,{...payload,adId});
};
q('cabinet-export').onclick=()=>{
 const blob=new Blob([JSON.stringify(last,null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='telegram-ads-snapshot.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
q('media-import').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 const max=file.type==='video/mp4'?20971520:5242880;if(file.size>max){show({error:'Файл превышает лимит'});return;}
 const bytes=new Uint8Array(await file.arrayBuffer());let base64='';for(let i=0;i<bytes.length;i+=32768)base64+=String.fromCharCode(...bytes.subarray(i,i+32768));
 await execute('upload_media',{adId:q('ad-id').value.trim()||undefined,asset:{name:file.name,mime:file.type,base64:btoa(base64)}});
};

q('media-url-load').onclick=async()=>{
 try{
 const url=q('media-url').value.trim();if(!url)throw Error('Укажите ссылку');
 const config=(await import('./local-config.js')).default;
 show({state:'downloading'});
 const response=await fetch('http://127.0.0.1:'+config.port+'/media/resolve',{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify({url})});
 const data=await response.json();if(!response.ok)throw Error(data.error);
 await execute('upload_media',{adId:q('ad-id').value.trim()||undefined,asset:data.asset});
 }catch(e){show({error:e.message});}
};

// Load the cabinet when the dashboard opens; table retains its own scroll.
execute('read_account',{});
