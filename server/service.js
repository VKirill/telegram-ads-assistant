import {validateDetails} from '../src/validation.js';
import {validatePackage,plan,digest} from '../src/core.js';
import {targetTypes} from '../src/targeting.js';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
export class Service {
 constructor(directory){this.directory=directory;}
 async read(){try{return JSON.parse(await readFile(join(this.directory,'state.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {packages:{}};throw e;}}
 async save(state){await mkdir(this.directory,{recursive:true,mode:0o700});const tmp=join(this.directory,'state.tmp');await writeFile(tmp,JSON.stringify(state,null,2),{mode:0o600});await rename(tmp,join(this.directory,'state.json'));}
 async call(name,args={}){
 if(name==='capabilities')return {targets:targetTypes,currencies:['TON','EUR','XTR'],destinations:{website:'requires_native_confirmation',telegram:'requires_server_validation',search:'plain_telegram_only'},publishingEnabled:true,liveBrowserConnected:'use_extension_status',statistics:'read_account_live; read_statistics_displayed_only',targetAdapters:{channels:'implemented_pending_live_acceptance',search:'implemented_pending_live_acceptance',bots:'implemented_pending_live_acceptance',users:'implemented_pending_live_acceptance'}};
 if(name==='validate_package'){const errors=validatePackage(args.package);return {valid:!errors.length,errors,issues:validateDetails(args.package),serverValidationRequired:true};}
 if(name==='stage_package'){
 const errors=validatePackage(args.package);if(errors.length)throw Error(errors.join('; '));
 const hash=await digest(args.package),state=await this.read(),previous=state.packages[args.package.id];
 if(previous&&previous.hash!==hash)throw Error('Package ID уже занят другой версией; используйте новый ID');
 state.packages[args.package.id]={hash,package:args.package,stagedAt:previous?.stagedAt??new Date().toISOString()};
 await this.save(state);return {id:args.package.id,hash,state:'local_only',plan:plan(args.package)};
 }
 if(name==='list_packages')return Object.values((await this.read()).packages).map(x=>({id:x.package.id,hash:x.hash,ads:x.package.ads.length,stagedAt:x.stagedAt}));
 if(name==='get_package')return (await this.read()).packages[args.id]??{error:'not_found'};
 if(name==='get_statistics')return {available:false,reason:'browser_bridge_not_connected',rows:null,asOf:null,accountId:args.accountId,period:{from:args.from,to:args.to}};
 throw Error('Unknown tool');
 }
}
