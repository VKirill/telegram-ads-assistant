// Runs in MAIN world; reads only a fixed allowlist of advertised validation limits.
export function readCabinetConstraints(){
 if(location.origin!=='https://ads.telegram.org')return {error:'wrong_origin'};
 const state=typeof Aj!=='undefined'?Aj.state:null;
 const keys=['textMaxLength','channelItemsLimit','botItemsLimit','searchQueryItemsLimit','mediaPhotoSizeLimit','mediaVideoSizeLimit'];
 const limits={};for(const key of keys)if(Number.isFinite(Number(state?.[key]))&&Number(state[key])>0)limits[key]=Number(state[key]);
 const fields={};for(const e of document.querySelectorAll('input[name],textarea[name]')){
 const rules={};for(const key of ['min','max','maxlength','data-min','data-max','step']){const value=e.getAttribute(key);if(value!==null&&value!==''&&Number.isFinite(Number(value)))rules[key]=Number(value);}
 if(Object.keys(rules).length)fields[e.name]=rules;
 }
 return {source:'live_cabinet',observedAt:new Date().toISOString(),path:location.pathname,limits,fields,serverRules:'not_exposed'};
}
