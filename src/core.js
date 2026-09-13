import {validateDetails,textLength} from './validation.js';
import {validateTarget,targetOf} from './targeting.js';
export function validatePackage(p,constraints) {
 const details=validateDetails(p,constraints);
 const errors=details.map(x=>x.field+": "+x.message);
 if(!p || p.version!==1) return ['Требуется version: 1'];
 if(typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id))errors.push('Некорректный ID пакета');
 if(p.currency!=='TON')errors.push('Укажите currency: TON');
 if(!Number.isFinite(p.totalBudget)||p.totalBudget<=0)errors.push('Некорректный общий лимит');
 if(!Array.isArray(p.ads)||p.ads.length<1||p.ads.length>100)return [...errors,'Пакет должен содержать 1–100 объявлений'];
 const ids=new Set(), external=new Set();let sum=0;
 for(const [i,a] of p.ads.entries()) {
  const e=m=>errors.push(`Строка ${i+1}: ${m}`);
  if(!a||typeof a!=='object'){e('нет объекта объявления');continue;}
  if(typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(a.id)||ids.has(a.id))e('ID отсутствует/повторяется');ids.add(a.id);
  if(typeof a.title!=='string'||!a.title.trim()||a.title.length>128)e('некорректный заголовок');
  if(targetOf(a)?.type!=='search'&&(typeof a.text!=='string'||!a.text.trim()||textLength(a.text)>160||/[\r\n]/.test(a.text)))e('текст: 1–160 символов, одна строка');
  try{const u=new URL(a.url);const search=targetOf(a)?.type==='search';if(u.origin!=='https://t.me'||u.username||u.password||u.hash||!/^\/[A-Za-z0-9_]+$/.test(u.pathname)||(search?!!u.search:(!/^[-\w]{1,64}$/.test(u.searchParams.get('start')||'')||[...u.searchParams.keys()].some(k=>k!=='start'))))throw 0;}catch{e(targetOf(a)?.type==='search'?'Search: нужна ссылка t.me без start-параметра':'нужна HTTPS-ссылка t.me с корректной start-меткой');}
  if(!Number.isFinite(a.budget)||a.budget<=0||a.budget>p.totalBudget)e('некорректный бюджет');else sum+=Math.round(a.budget*1e9);
  if(!Number.isFinite(a.cpm)||a.cpm<=0||Math.abs(a.cpm*100-Math.round(a.cpm*100))>1e-7)e('некорректный CPM');
  if(a.status!=='on_hold')e('в этой версии разрешён только on_hold');
  for(const problem of validateTarget(a))e(problem);
  if(a.externalId!=null){if(!/^\d+$/.test(String(a.externalId))||external.has(String(a.externalId)))e('неверный/повторный внешний ID');external.add(String(a.externalId));}
  if(a.media&&(['search','bots'].includes(targetOf(a)?.type)||targetOf(a)?.placement==='video_banner'))e('Медиа недоступно для выбранного направления');
  if(a.media!=null&&(typeof a.media!=='string'||!/^[^/\\]+\.(mp4|jpg|jpeg|png)$/i.test(a.media)))e('media должен быть именем файла');
 }
 if(sum>Math.round(p.totalBudget*1e9))errors.push('Сумма бюджетов превышает лимит пакета');
 return errors;
}
export function plan(p,receipts={}){return p.ads.map(a=>({id:a.id,title:a.title,budget:a.budget,action:a.externalId?'existing':receipts[a.id]?.state==='prepared'?'verify_before_repeat':'prepare',externalId:a.externalId??null}));}
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
