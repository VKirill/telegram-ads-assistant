// Injected function is self-contained. Never submits, clicks status or accepts terms.
export function formBridge(command, ad) {
 if(command==='prepare' && ad?.target && ad.target.type!=='channels')throw Error('Адаптер этого target ещё не проверен; запись запрещена');

 if(location.origin!=='https://ads.telegram.org')throw Error('Открыт другой сайт');
 const visible=e=>!!(e.getClientRects().length)&&!e.disabled;
 const fields=[...document.querySelectorAll('input:not([type=hidden]),textarea')].filter(visible);
 const label=e=>{
  const labels=[...(e.labels||[])].map(l=>l.textContent).join(' ');
  return [labels,e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.parentElement?.previousElementSibling?.textContent].filter(Boolean).join(' ').trim();
 };
 if(command==='inspect')return {path:location.pathname,fields:fields.map(e=>({tag:e.tagName,type:e.type,label:label(e).slice(0,180)})),mediaVisible:[...document.querySelectorAll('video,img')].filter(visible).length};
 if(location.pathname!=='/account/ad/new')throw Error('Заполнение разрешено только в форме нового объявления. Существующие записи не изменяются.');
 if(command!=='prepare')throw Error('Неизвестная команда');
 if(ad.externalId)throw Error('У объявления уже есть внешний ID');
 const selected=document.querySelector('input[name="target_type"]:checked')?.value;
 if(selected!=='channels')throw Error('Подготовка полей пока проверена только для Channels; переключите направление вручную');
 if(!document.querySelector('input[name="active"][value="0"]:checked'))throw Error('Выберите On Hold перед подготовкой формы');
 const contracts=[['title',/Ad title/i],['text',/Ad text/i],['url',/URL you want to promote/i],['cpm',/CPM in Gram/i],['budget',/Initial budget in Gram/i]];
 const bindings=contracts.map(([key,rx])=>{const matches=fields.filter(e=>rx.test(label(e)));if(matches.length!==1)throw Error(`Форма изменилась: ${key}, найдено ${matches.length}. Ничего не заполнено.`);return {key,e:matches[0]};});
 // Resolve every field before first write. Roll back local form values on synchronous failure.
 const before=bindings.map(({e})=>e.value);
 try{for(const {key,e} of bindings){const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,String(ad[key]));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}}
 catch(err){bindings.forEach(({e},i)=>{e.value=before[i];e.dispatchEvent(new Event('input',{bubbles:true}));});throw err;}
 return {state:'prepared',fields:bindings.map(({key,e})=>({key,match:e.value===String(ad[key])})),remaining:['Проверить отображаемую валюту и надбавку за медиа','Добавить и сверить каналы','Загрузить медиа и дождаться сохранения','Проверить On Hold','Сохранение выполняется вручную после возобновления рекламы']};
}
