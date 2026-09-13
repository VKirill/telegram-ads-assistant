// Injectable Chrome facade makes ordering testable without a live browser.
export async function prepareReload(api,clientId,requestId){
 const tab=await api.tabs.getCurrent();
 if(!tab?.id)throw Error('Reload requires extension dashboard');
 const marker={clientId,requestId,tabId:tab.id,requestedAt:new Date().toISOString(),previousVersion:api.runtime.getManifest().version};
 await api.storage.local.set({reloadPending:marker});
 return {state:'reload_requested',requestId,previousVersion:marker.previousVersion};
}
export async function restoreAfterReload(api){
 const {reloadPending}=await api.storage.local.get('reloadPending');
 if(!reloadPending)return;
 // Only the extension dashboard can be navigated. Never navigate an Ads tab.
 const url=api.runtime.getURL('index.html');
 let tab;try{tab=await api.tabs.get(reloadPending.tabId);}catch{}
 if(tab?.url?.split('?')[0]===url)await api.tabs.update(tab.id,{url});
 else await api.tabs.create({url,active:false});
}
export function validReloadSender(api,sender){
 return sender.id===api.runtime.id && sender.url===api.runtime.getURL('index.html');
}
