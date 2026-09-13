export const defaultConstraints={limits:{textMaxLength:160,channelItemsLimit:100,botItemsLimit:100,searchQueryItemsLimit:10,mediaPhotoSizeLimit:5242880,mediaVideoSizeLimit:20971520},source:'cabinet_snapshot_2026-09-14'};
export const textLength=text=>text.replace(/!\[(.*?)\]\(tg:\/\/emoji\?id=(\d+)\)/g,'$1').length;
export function validateDetails(p,constraints=defaultConstraints){
 const issues=[];const add=(field,code,message,actual,limit,source='application')=>issues.push({field,code,message,actual,limit,source});
 if(!p||typeof p!=='object'||Array.isArray(p))return [{field:'package',code:'type',message:'Передайте JSON-объект пакета',source:'application'}];
 if(!Array.isArray(p.ads))return [{field:'ads',code:'type',message:'ads должен быть массивом',source:'application'}];
 for(const [i,a]of p.ads.entries()){
 const base=`ads[${i}]`;if(!a||typeof a!=='object'||Array.isArray(a)){add(base,'type','Объявление должно быть объектом');continue;}
 const t=a.target??{type:'channels',channels:a.channels};
 if(t&&typeof t!=='object'){add(base+'.target','type','target должен быть объектом');continue;}
 for(const key of Object.keys(a))if(!['id','title','text','url','budget','cpm','status','target','channels','externalId','media','dailyBudget','viewsPerUser','picture'].includes(key))add(base+'.'+key,'unknown_field','Неизвестное поле: '+key);
 if(typeof a.text==='string'){
 const max=constraints.limits?.textMaxLength??160,n=textLength(a.text);
 if(n>max)add(base+'.text','max_length',`Текст: ${n} символов, допустимо ${max}`,n,max,constraints.source);
 if(/[\r\n]/.test(a.text))add(base+'.text','line_break','Уберите переносы строк');
 const links=[...a.text.matchAll(/(?:https?:\/\/[^\s]+|(?<!\w)@[A-Za-z0-9_]+|(?<![\w/])t\.me\/[^\s]+)/g)].map(x=>x[0]);
 if(links.length>1)add(base+'.text','multiple_links','В тексте допускается одна ссылка',links.length,1,'telegram_guidelines');
 for(const link of links){try{const u=new URL(link.startsWith('@')?'https://t.me/'+link.slice(1):link.startsWith('t.me/')?'https://'+link:link),dest=new URL(a.url);if(u.origin!=='https://t.me'||u.pathname.toLowerCase()!==dest.pathname.toLowerCase())add(base+'.text','link_destination','Ссылка в тексте должна вести туда же, куда URL объявления',undefined,undefined,'telegram_guidelines');}catch{add(base+'.text','link_format','Некорректная ссылка в тексте');}}
 }
 for(const key of ['budget','cpm','dailyBudget'])if(a[key]!=null&&(!Number.isFinite(a[key])||a[key]<(key==='dailyBudget'?0:.01)||Math.abs(a[key]*100-Math.round(a[key]*100))>1e-7))add(base+'.'+key,'money','Нужно число с точностью до двух знаков; бюджет и CPM положительные',a[key]);
 if(a.viewsPerUser!=null&&![1,2,3,4].includes(a.viewsPerUser))add(base+'.viewsPerUser','enum','Допустимы 1, 2, 3 или 4',a.viewsPerUser);
 if(a.picture!=null&&typeof a.picture!=='boolean')add(base+'.picture','type','picture должен быть true или false');
 for(const [key,value]of Object.entries(t??{})){
 if(['type','placement','device','allTopics','onlyPolitics','excludePolitics'].includes(key))continue;
 if(!Array.isArray(value)){add(base+'.target.'+key,'type','Ожидается массив строк');continue;}
 const name=key==='queries'?'searchQueryItemsLimit':key==='bots'?'botItemsLimit':['channels','excludeChannels'].includes(key)?'channelItemsLimit':null;
 const max=name?constraints.limits?.[name]:undefined;
 if(max!=null&&value.length>max)add(base+'.target.'+key,'max_items',`Выбрано ${value.length}; допустимо ${max}`,value.length,max,constraints.source);
 }
 }
 return issues;
}
