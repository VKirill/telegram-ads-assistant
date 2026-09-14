// Runs in MAIN world; reads only a fixed allowlist of advertised validation limits.
export function readCabinetConstraints(){
 if(location.origin!=='https://ads.telegram.org')return {error:'wrong_origin'};
 const state=typeof Aj!=='undefined'?Aj.state:null;
 const keys=['textMaxLength','channelItemsLimit','botItemsLimit','searchQueryItemsLimit','mediaPhotoSizeLimit','mediaVideoSizeLimit'];
 const limits={};for(const key of keys)if(Number.isFinite(Number(state?.[key]))&&Number(state[key])>0)limits[key]=Number(state[key]);
 // ownerCurrency is a public currency HTML label, never an auth field.
 const currencyLabel=String(state?.ownerCurrency??'');
 const currency= /currency-star|⭐|\bXTR\b|\bStars\b/i.test(currencyLabel)?'XTR':/currency-ton|toncoin|\bTON\b/i.test(currencyLabel)?'TON':/currency-euro|€|\bEUR\b/i.test(currencyLabel)?'EUR':document.querySelector('.currency-star, .currency-stars')?'XTR':document.querySelector('.currency-ton')?'TON':document.querySelector('.currency-euro')?'EUR':null;
 const accountId=state?.ownerId!=null&&/^\d+$/.test(String(state.ownerId))?String(state.ownerId):null;
 const fields={};for(const e of document.querySelectorAll('input[name],textarea[name]')){
 const rules={};for(const key of ['min','max','maxlength','data-min','data-max','step']){const value=e.getAttribute(key);if(value!==null&&value!==''&&Number.isFinite(Number(value)))rules[key]=Number(value);}
 if(Object.keys(rules).length)fields[e.name]=rules;
 }
 return {source:'live_cabinet',observedAt:new Date().toISOString(),path:location.pathname,accountId,currency,destinationSupport:'server_validation_required',geographySupport:'verify_selected_countries_in_native_form',limits,fields,serverRules:'not_exposed'};
}
