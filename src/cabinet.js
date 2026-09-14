// Runs only inside Telegram Ads. No arbitrary scripts, endpoints or selectors accepted.
export async function cabinetOperation(command,args){
 try{
 if(location.origin!=='https://ads.telegram.org')throw Error('Wrong origin');
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const visible=e=>!!e&&!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
 const one=selector=>{const all=[...document.querySelectorAll(selector)].filter(visible);if(all.length!==1)throw Error('Ambiguous/missing control: '+selector);return all[0];};
 const byName=name=>one('[name="'+name+'"]:not([type="hidden"])');
 const textClick=async text=>{const matches=[...document.querySelectorAll('button,a,.btn,.pr-link,.tab-label')].filter(e=>visible(e)&&e.textContent.trim().toLowerCase()===text.toLowerCase());if(matches.length!==1)throw Error('Ambiguous action: '+text);matches[0].click();await sleep(200);};
 const wait=async(fn,ms=8000)=>{const until=Date.now()+ms;while(Date.now()<until){const value=fn();if(value)return value;await sleep(100);}throw Error('Timed out; outcome requires inspection');};
 const set=(e,value)=>{for(const [attr,compare]of [['data-min',(a,b)=>a<b],['min',(a,b)=>a<b],['data-max',(a,b)=>a>b],['max',(a,b)=>a>b]]){const raw=e.getAttribute(attr);if(raw!==null&&raw!==''&&Number.isFinite(Number(raw))&&compare(Number(value),Number(raw)))throw Error(e.name+': '+value+' нарушает '+attr+'='+raw);}const max=e.getAttribute('maxlength');if(max!==null&&Number(max)>=0&&String(value).length>Number(max))throw Error(e.name+': превышен maxlength='+max);const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,String(value??''));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.dispatchEvent(new Event('blur',{bubbles:true}));};
 const radio=async(name,value)=>{const e=document.querySelector('input[name="'+name+'"][value="'+value+'"]');if(!e)throw Error('Radio unavailable: '+name);if(!e.checked){e.click();await sleep(250);}if(!e.checked)throw Error('Radio not selected');};
 const checkbox=(name,value)=>{const e=document.querySelector('input[type="checkbox"][name="'+name+'"]');if(!e)throw Error('Checkbox missing '+name);if(e.checked!==value)e.click();};
 const isWebsite=value=>{try{return new URL(value).hostname!=='t.me';}catch{return false;}};
 const websiteConfirmed=()=>visible(document.querySelector('.js-field-website_name-wrap'));
 const confirmWebsite=async(value,name)=>{
 if(!isWebsite(value))return;
 await wait(()=>{const errors=messages();if(errors.length)throw Error(errors.join('; '));return websiteConfirmed();});
 if(name!=null)set(byName('website_name'),name);
 };
 const messages=()=>[...document.querySelectorAll('.field-error,.pr-field-error,.form-error,.error-message,.pr-form-control-msg.no-hint .pr-form-control-msg-text')].filter(visible).map(e=>e.textContent.trim()).filter(Boolean);
 const fingerprint=async obj=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(obj))))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const snapshot=()=>{
 const fields={};for(const e of document.querySelectorAll('input[name]:not([type=hidden]):not([type=file]),textarea[name]')){
 if(!['title','text','promote_url','cpm','budget','daily_budget','picture','active','views_per_user','use_schedule','ad_activate_date','ad_activate_time','ad_deactivate_date','ad_deactivate_time','target_type','placement','exclude_politic','intersect_topics','only_politic','website_name','amount','decr_amount','schedule_tz','schedule_tz_custom','schedule'].includes(e.name))continue;
 if(e.type==='radio'){if(e.checked)fields[e.name]=e.value;}else if(e.type==='checkbox')fields[e.name]=e.checked;else fields[e.name]=e.value;
 }
 const targets={};for(const e of document.querySelectorAll('.select[data-name]'))targets[e.dataset.name]=[...e.querySelectorAll('.selected-item')].map(x=>({label:x.textContent.trim(),key:x.getAttribute('data-val')??null}));
 const media=document.querySelector('[name="media"]');
 return {path:location.pathname,fields,targets,mediaSaved:!!media?.value,cpmSurcharge:document.querySelector('.js-cpm-extra')?.textContent.trim()??null,mediaLoading:!!document.querySelector('.js-ad-media-wrap.file-loading'),destinationVerification:isWebsite(fields.promote_url)?(websiteConfirmed()?'website_recognized_by_cabinet':'website_not_confirmed'):'server_validation_required',errors:messages()};
 };
 const result=async()=>{const data=snapshot();return {...data,fingerprint:await fingerprint({snapshot:data,mediaHandle:document.querySelector('[name="media"]')?.value??''})};};
 const requireAd=()=>{if(location.pathname!=='/account/ad/'+args.adId&&location.pathname!=='/account/ad/'+args.adId+'/budget'&&location.pathname!=='/account/ad/'+args.adId+'/stats')throw Error('Ad identity mismatch');};
 if(command==='read_draft'){if(location.pathname!=='/account/ad/new')throw Error('New form required');return {state:'draft_inspected',...(await result())};}
 if(command==='clone_ad'){
 requireAd();if(location.pathname!=='/account/ad/'+args.adId)throw Error('Info form required');
 one('.js-clone-ad-btn').click();
 return {state:'clone_requested_needs_inspection',sourceAdId:args.adId,published:false};
 }
 if(command==='export_csv'){
 requireAd();const link=[...document.querySelectorAll('a[href]')].find(a=>{const u=new URL(a.href);return u.origin===location.origin&&u.pathname.startsWith('/reports/account/')&&u.pathname.endsWith('/ad/'+args.adId);});
 if(!link)throw Error('CSV link not available');
 const response=await fetch(link.href,{credentials:'same-origin'});if(!response.ok)throw Error('CSV HTTP '+response.status);
 const csv=await response.text();if(csv.length>2000000||/^\s*</.test(csv))throw Error('Unexpected CSV response');
 return {csv,adId:args.adId,month:new URL(link.href).searchParams.get('month'),asOf:new Date().toISOString()};
 }
 if(['read_ad','read_budget','read_statistics'].includes(command)){
 requireAd();const data=await result();
 const tables=[...document.querySelectorAll('table')].map(t=>[...t.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>c.textContent.trim())));
 return {...data,tables,asOf:new Date().toISOString(),period:{kind:'displayed_in_cabinet',month:new URL(location.href).searchParams.get('month'),timezone:'UTC'},chartsExtracted:false,summary:document.body.innerText.slice(0,20000)};
 }
 // Widget values are chosen through the real site dropdown; never force hidden backing values.
 async function choose(name,values){
 const wrap=one('.select[data-name="'+name+'"]'),editor=wrap.querySelector('[contenteditable="true"]');
 if(!editor)throw Error('Selector locked: '+name);
 const current=()=>[...wrap.querySelectorAll('.selected-item')];
 if(current().length)throw Error('Target '+name+' already contains items; use a clean draft');
 for(const value of values){
 editor.focus();editor.textContent=value;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));editor.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:value.slice(-1)}));
 if(['search_queries','channels','exclude_channels','user_channels','exclude_user_channels','bots'].includes(name)){
 await sleep(250);editor.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',keyCode:13,which:13}));
 }else{
 const selected=await wait(()=>[...wrap.querySelectorAll('.items-list .search-item.selected')].find(e=>e.textContent.trim().toLowerCase()===value.toLowerCase()));
 if(selected)editor.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',keyCode:13,which:13}));
 }
 await wait(()=>{const errors=messages();if(errors.length)throw Error(errors.join('; '));return current().length===values.indexOf(value)+1;});
 editor.textContent='';editor.dispatchEvent(new Event('input',{bubbles:true}));
 }
 }
 if(command==='prepare_ad'){
 if(location.pathname!=='/account/ad/new')throw Error('New ad form required');
 const ad=args.ad,t=ad.target??{type:'channels',channels:ad.channels};
 const existing=byName('title').value;if(existing.trim())throw Error('Nonempty draft: inspect before replacing');
 await radio('target_type',t.type);await radio('active','0');
 const fields={title:ad.title,promote_url:ad.url,cpm:ad.cpm,budget:ad.budget};
 if(t.type!=='search')fields.text=ad.text;
 if(ad.dailyBudget!=null)fields.daily_budget=ad.dailyBudget;
 // Validate all scalar controls before changing any scalar.
 const entries=Object.entries(fields).map(([n,v])=>({e:byName(n),v}));for(const {e,v}of entries)set(e,v);
 await confirmWebsite(ad.url,ad.websiteName);
 if(ad.viewsPerUser)await radio('views_per_user',String(ad.viewsPerUser));
 if(ad.picture!=null)checkbox('picture',ad.picture);
 if(t.type==='users'&&t.placement)await radio('placement',t.placement);
 if(t.type==='users'){
 if(t.device){const el=one('[data-name="device"]');el.click();const option=el.parentElement.querySelector('.input-dropdown-item[data-value="'+(t.device==='all'?'':t.device)+'"]');if(!option)throw Error('Device unavailable');option.click();}
 for(const [key,name]of [['allTopics','intersect_topics'],['onlyPolitics','only_politic'],['excludePolitics','exclude_politic']])if(t[key]!=null)checkbox(name,t[key]);
 }

 const maps={channels:{channels:'channels',languages:'langs',topics:'topics',excludeChannels:'exclude_channels',excludeTopics:'exclude_topics'},users:{countries:'countries',locations:'locations',languages:'user_langs',topics:'user_topics',channels:'user_channels',excludeChannels:'exclude_user_channels',excludeTopics:'exclude_user_topics'},bots:{bots:'bots'},search:{queries:'search_queries'}};
 for(const [key,field]of Object.entries(maps[t.type]))if(t[key]?.length)await choose(field,t[key]);
 await sleep(500);return {state:'draft_prepared',...(await result()),published:false};
 }
 if(command==='prepare_edit'){
 requireAd();if(location.pathname!=='/account/ad/'+args.adId)throw Error('Info form required');
 const map={title:'title',text:'text',url:'promote_url',cpm:'cpm',dailyBudget:'daily_budget',startDate:'ad_activate_date',startTime:'ad_activate_time',endDate:'ad_deactivate_date',endTime:'ad_deactivate_time'};
 const entries=Object.entries(args.patch).filter(([k])=>map[k]).map(([k,v])=>({e:byName(map[k]),v}));
 for(const {e,v}of entries)set(e,v);
 if(args.patch.url!=null||args.patch.websiteName!=null)await confirmWebsite(args.patch.url??byName('promote_url').value,args.patch.websiteName);
 if(args.patch.status)await radio('active',args.patch.status==='active'?'1':'0');
 if(args.patch.viewsPerUser)await radio('views_per_user',String(args.patch.viewsPerUser));
 if(args.patch.picture!=null)checkbox('picture',args.patch.picture);
 await sleep(350);return {state:'edit_prepared',...(await result()),saved:false};
 }
 if(command==='prepare_schedule'){
 requireAd();
 const trigger=document.querySelector('.js-open-schedule');
 if(trigger&&visible(trigger))trigger.click();else checkbox('use_schedule',true);
 const table=await wait(()=>[...document.querySelectorAll('.js-schedule-table')].find(visible));
 const popup=table.closest('.popup-container');if(!popup)throw Error('Schedule popup unavailable');
 const tz=popup.querySelector('[data-name="schedule_tz"]');
 if(!tz)throw Error('Timezone selector unavailable');
 const custom=popup.querySelector('input[name="schedule_tz_custom"][value="1"]');if(custom&&!custom.checked)custom.click();
 tz.click();const option=[...tz.parentElement.querySelectorAll('[data-value]')].find(e=>e!==tz&&e.getAttribute('data-value')===String(args.timezoneSeconds));if(!option)throw Error('Requested timezone unavailable');option.click();
 const rows=[...table.querySelectorAll('tr')];if(rows.length!==7||rows.some(r=>r.querySelectorAll('td').length!==24))throw Error('Schedule grid schema changed');
 for(let day=0;day<7;day++)for(let hour=0;hour<24;hour++){
 const cell=rows[day].querySelectorAll('td')[hour],want=args.hours[day].includes(hour);
 if(cell.classList.contains('selected')!==want){
 cell.scrollIntoView({block:'nearest',inline:'nearest'});const rect=cell.getBoundingClientRect(),opts={bubbles:true,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2};
 cell.dispatchEvent(new MouseEvent('mousedown',opts));document.dispatchEvent(new MouseEvent('mouseup',opts));
 if(cell.classList.contains('selected')!==want)throw Error('Schedule cell did not change');
 }
 }
 const save=popup.querySelector('.submit-form-btn');if(!save)throw Error('Schedule save button missing');save.click();
 await sleep(200);return {state:'schedule_prepared',hours:args.hours,timezoneSeconds:args.timezoneSeconds,...(await result()),saved:false};
 }
 if(command==='prepare_budget'){
 requireAd();if(!location.pathname.endsWith('/budget'))throw Error('Budget page required');
 const name=args.direction==='withdraw'?'decr_amount':'amount';
 if(![...document.querySelectorAll('[name="'+name+'"]')].some(visible))await textClick(args.direction==='withdraw'?'decrease budget':'increase budget');
 set(byName(name),args.amount.toFixed(2));
 return {state:'budget_prepared',direction:args.direction,amount:args.amount,...(await result()),saved:false};
 }
 if(command==='upload_media'){
 if(!/^\/account\/ad\/(new|\d+)$/.test(location.pathname))throw Error('Ad form required');
 const type=document.querySelector('[name="target_type"]:checked')?.value;
 if(type==='search'||type==='bots')throw Error('Media is unavailable for this target');
 const {name,mime,base64}=args.asset;
 const bytes=Uint8Array.from(atob(base64),x=>x.charCodeAt(0));
 const limit=mime==='video/mp4'?20971520:5242880;
 if(!['video/mp4','image/png','image/jpeg'].includes(mime)||bytes.length>limit)throw Error('Unsupported media or size limit');
 const previousMedia=document.querySelector('[name="media"]')?.value??'';
 const blob=new Blob([bytes],{type:mime}),previewUrl=URL.createObjectURL(blob);
 let metadata;
 try{metadata=await new Promise((resolve,reject)=>{const video=mime==='video/mp4',el=document.createElement(video?'video':'img');const timer=setTimeout(()=>{el.removeAttribute('src');reject(Error('media.decode: не удалось прочитать файл за 15 секунд'));},15000);const done=(error)=>{clearTimeout(timer);if(error)return reject(Error('media.decode: файл повреждён или формат не поддерживается Chrome'));const width=video?el.videoWidth:el.naturalWidth,height=video?el.videoHeight:el.naturalHeight,duration=video?el.duration:null;if(!width||!height||(video&&(!Number.isFinite(duration)||duration<=0)))return reject(Error('media.metadata: неверное разрешение или длительность'));resolve({width,height,duration,aspectRatio:width/height,validation:'chrome_decode',telegramAcceptance:'server_required'});};el.onerror=()=>done(true);if(video){el.preload='metadata';el.onloadedmetadata=()=>done(false);}else el.onload=()=>done(false);el.src=previewUrl;});}finally{URL.revokeObjectURL(previewUrl);}
 const container=one('.js-add-media-btn');
 const input=document.createElement('input');input.type='file';input.className='file-upload hide';container.append(input);
 const transfer=new DataTransfer();transfer.items.add(new File([bytes],name,{type:mime}));input.files=transfer.files;
 input.dispatchEvent(new Event('change',{bubbles:true}));
 await wait(()=>!!document.querySelector('[name="media"]')?.value&&document.querySelector('[name="media"]').value!==previousMedia&&!document.querySelector('.js-ad-media-wrap.file-loading'),60000);
 return {state:'media_uploaded',metadata,bytes:bytes.length,...(await result()),published:false};
 }
 if(['commit_ad','commit_edit','commit_budget','delete_ad'].includes(command)){
 if(args.allowWrite!==true)throw Error('Publishing and financial operations are paused');
 const data=await result();if(data.fingerprint!==args.expectedFingerprint)throw Error('Form changed since preview; re-read required');
 if(data.destinationVerification==='website_not_confirmed')throw Error('Website destination not confirmed by cabinet');
 if(data.errors.length||data.mediaLoading)throw Error('Form has errors or media is pending');
 if(command==='delete_ad'){requireAd();one('.delete-ad-btn').click();return {state:'awaiting_native_delete_confirmation',adId:args.adId,deleted:false};}
 if(command==='commit_ad'){
 if(location.pathname!=='/account/ad/new')throw Error('New form required');
 checkbox('confirmed',true);
 if(!document.querySelector('[name="confirmed"]:checked'))throw Error('Telegram terms checkbox did not accept the click');
 await textClick('Create Ad');
 }else if(command==='commit_edit'){requireAd();await textClick('Save Changes');}
 else{requireAd();await textClick(args.direction==='withdraw'?'Withdraw from budget':'Add to budget');}
 // Never call this a verified write: caller must re-read the saved entity.
 await sleep(1000);return {state:'submitted_needs_verification',path:location.pathname,errors:messages(),operationId:args.operationId};
 }
 throw Error('Unsupported cabinet operation');
 }catch(e){return {error:e.message,outcome:'inspect_before_retry'};}
}
