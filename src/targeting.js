export const targetTypes=['search','bots','users','channels'];
export function targetOf(ad){return ad.target??{type:'channels',channels:ad.channels};}
export function validateTarget(ad){
 const t=targetOf(ad),e=[];if(!t||!targetTypes.includes(t.type))return ['Неизвестный тип target'];
 if(ad.target&&ad.channels)e.push('Используйте target либо legacy channels');
 const keys={search:['queries'],bots:['bots'],channels:['channels','languages','topics','excludeChannels','excludeTopics'],users:['countries','locations','languages','topics','channels','excludeChannels','excludeTopics','placement','device','allTopics','onlyPolitics','excludePolitics']}[t.type];
 if(Object.keys(t).some(k=>k!=='type'&&!keys.includes(k)))e.push('Неподдерживаемые параметры target');
 for(const key of keys.filter(k=>!['placement','device','allTopics','onlyPolitics','excludePolitics'].includes(k))){
 const values=t[key];if(values==null)continue;
 if(!Array.isArray(values)||values.length>100||values.some(x=>typeof x!=='string'||!x.trim()||x.length>200)){e.push('Некорректный список '+key);continue;}
 if(new Set(values.map(x=>x.toLowerCase().trim())).size!==values.length)e.push('Повторные значения '+key);
 if(['bots','channels','excludeChannels'].includes(key)&&values.some(x=>!/^\w{5,32}$/.test(x)))e.push('Нужны username без @');
 }
 for(const [include,exclude] of [['channels','excludeChannels'],['topics','excludeTopics']]){if(Array.isArray(t[include])&&Array.isArray(t[exclude])){const excluded=new Set(t[exclude].filter(x=>typeof x==='string').map(x=>x.toLowerCase().trim()));if(t[include].some(x=>typeof x==='string'&&excluded.has(x.toLowerCase().trim())))e.push('Конфликт включения и исключения: '+include);}}
 if(t.type==='search'&&!t.queries?.length)e.push('Нужны поисковые запросы');
 if(t.type==='bots'&&!t.bots?.length)e.push('Нужны боты');
 if(t.type==='channels'&&!t.channels?.length&&!t.topics?.length&&!t.languages?.length)e.push('Нужны каналы, темы или языки');
 if(t.type==='users'&&!t.countries?.length)e.push('Для Users нужны страны');
 if(t.device&&!['all','ios','android','mobile','desktop'].includes(t.device))e.push('Неизвестное устройство');
 for(const k of ['allTopics','onlyPolitics','excludePolitics'])if(t[k]!=null&&typeof t[k]!=='boolean')e.push('Нужен boolean '+k);
 if(t.onlyPolitics&&t.excludePolitics)e.push('Конфликт фильтров Politics');
 if(t.placement&&!['channel_post','video_banner'].includes(t.placement))e.push('Неизвестное placement');
 return e;
}
