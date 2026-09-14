// Syntax only. Telegram decides whether the selected account accepts the destination.
export function destinationKind(value){
 try{
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password) return null;
 if(u.hostname==='t.me'){
  if(u.port||u.hash)return null;
  const plain=/^\/[A-Za-z0-9_]{5,32}$/.test(u.pathname);
  if(plain&&!u.search)return 'telegram';
  if(plain&&[...u.searchParams.keys()].length===1&&u.searchParams.has('start')&&/^[-\w]{1,64}$/.test(u.searchParams.get('start')))return 'bot_start';
  if(!u.search&&/^\/[A-Za-z0-9_]{5,32}\/\d+$/.test(u.pathname))return 'post';
  if(!u.search&&/^\/(?:\+|joinchat\/)[A-Za-z0-9_-]+$/.test(u.pathname))return 'invite';
  return null;
 }
 if(!u.hostname.includes('.')||/^\d+(\.\d+){3}$/.test(u.hostname)||u.hostname.includes(':')||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local'))return null;
 return 'website';
 }catch{return null;}
}
export function destinationErrors(value,targetType){
 const kind=destinationKind(value);
 if(!kind)return ['Нужна HTTPS-ссылка сайта или поддерживаемая ссылка t.me без credentials'];
 if(targetType==='search'&&kind!=='telegram')return ['Search: нужна простая ссылка t.me без start-параметра'];
 return [];
}
export function validateCurrency(expected,actual){
 if(!['TON','EUR','XTR'].includes(expected))return 'Укажите валюту TON, EUR или XTR (Stars)';
 if(!['TON','EUR','XTR'].includes(actual))return 'Валюта выбранного кабинета не определена; проверьте кабинет';
 return expected===actual?null:`Валюта пакета ${expected} не совпадает с кабинетом ${actual}; автоматической конвертации нет`;
}
