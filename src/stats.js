// Self-contained, read-only. Header-based mapping tolerates hidden/reordered columns.
export function readAccountSnapshot(){
 try{
 if(location.origin!=='https://ads.telegram.org'||location.pathname!=='/account')throw Error('Откройте список объявлений /account');
 const tables=[...document.querySelectorAll('table')].filter(t=>[...t.querySelectorAll('th')].some(h=>h.textContent.trim().replace(/\s+/g,' ').toUpperCase()==='AD TITLE'));
 if(tables.length!==1)throw Error('Таблица кабинета не найдена однозначно');
 const table=tables[0],heads=[...table.querySelectorAll('th')].map(h=>h.textContent.trim().replace(/\s+/g,' ').toUpperCase());
 for(const h of ['AD TITLE','VIEWS','CLICKS','SPENT','BUDGET','STATUS'])if(heads.filter(x=>x===h).length!==1)throw Error('Неизвестная схема: '+h);
 const num=s=>{const clean=s.replace(/[💎€⭐️%\s,]/gu,'');return /^\d+(\.\d+)?$/.test(clean)?Number(clean):null;};
 const rows=[];
 for(const tr of table.querySelectorAll('tbody tr')){
 const cells=[...tr.querySelectorAll(':scope > td')];if(!cells.length)continue;
 const first=cells[heads.indexOf('AD TITLE')],a=first?.querySelector('a[href^="/account/ad/"]');
 const id=a?.getAttribute('href')?.match(/^\/account\/ad\/(\d+)$/)?.[1];if(!id)throw Error('Не удалось прочитать ID строки');
 const raw={};heads.forEach((h,i)=>{if(h)raw[h]=(cells[i]?.querySelector('a')?.textContent??cells[i]?.textContent??'').trim();});
 rows.push({id,title:a.textContent.trim(),views:num(raw.VIEWS),clicks:num(raw.CLICKS),actions:num(raw.ACTIONS??''),spent:num(raw.SPENT),budget:num(raw.BUDGET),cpm:num(raw.CPM??''),ctr:num(raw.CTR??''),target:raw.TARGET,status:raw.STATUS,raw});
 }
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Повторные ID');
 const currency=table.querySelector('.currency-star, .currency-stars')?'XTR':table.querySelector('.currency-ton')?'TON':table.querySelector('.currency-euro')?'EUR':null;
 const search=document.querySelector('input[type="search"]');
 return {available:true,asOf:new Date().toISOString(),source:'telegram_ads_dom',sourceUrl:location.origin+location.pathname,accountId:null,accountIdentity:'selected_tab_only',currency,period:{kind:'account_table',from:null,to:null},coverage:'loaded_rows_only',filter:search?.value??null,rows};
 }catch(e){return {available:false,error:e.message};}
}
