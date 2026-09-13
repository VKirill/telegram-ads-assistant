chrome.action.onClicked.addListener(async tab => {
  // activeTab is granted only by this explicit user gesture.
  if (!tab.url?.startsWith('https://ads.telegram.org/')) return;
  await chrome.storage.session.set({targetTab:tab.id});
  await chrome.tabs.create({url:chrome.runtime.getURL('index.html')});
});

import {restoreAfterReload,validReloadSender} from './reload.js';
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.type!=='reload_extension'||!validReloadSender(chrome,sender))return;
 reply({accepted:true});
 chrome.runtime.reload();
});
chrome.runtime.onInstalled.addListener(()=>{restoreAfterReload(chrome).catch(console.error);});
