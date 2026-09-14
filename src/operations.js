import {destinationErrors} from './destinations.js';
export const operations={
 read_constraints:{write:false},read_draft:{write:false},read_ad:{write:false},prepare_schedule:{write:false},clone_ad:{write:false},export_csv:{write:false},read_budget:{write:false},read_statistics:{write:false},
 prepare_ad:{write:false},upload_media:{write:false},prepare_edit:{write:false},prepare_budget:{write:false},
 commit_ad:{write:true},commit_edit:{write:true},commit_budget:{write:true},delete_ad:{write:true}
};
export function validateOperation(command,args){
 const errors=[];if(!operations[command])return ['Unknown operation'];
 if(command!=='read_constraints'&&command!=='read_draft'&&command!=='prepare_ad'&&command!=='upload_media'&&command!=='commit_ad'&&!/^\d+$/.test(String(args.adId??'')))errors.push('adId must be numeric');
 if(args.month!=null&&!/^(20[0-9]{2})(0[1-9]|1[0-2])$/.test(args.month))errors.push('Invalid month YYYYMM');
 if(args.currency!=null&&!['TON','EUR','XTR'].includes(args.currency))errors.push('currency must be TON, EUR or XTR');
 if(command==='prepare_ad'&&!args.ad)errors.push('ad required');
 if(command==='prepare_edit'){
 const patch=args.patch||{},allowed=['title','text','url','cpm','dailyBudget','viewsPerUser','status','picture','startDate','startTime','endDate','endTime','websiteName'];
 if(patch.url!=null)errors.push(...destinationErrors(patch.url));
 if(patch.websiteName!=null&&(typeof patch.websiteName!=='string'||!patch.websiteName.trim()||patch.websiteName.length>128))errors.push('Invalid websiteName');
 if(!Object.keys(patch).length||Object.keys(patch).some(k=>!allowed.includes(k)))errors.push('Invalid patch. Target is immutable; create a new ad.');
 for(const key of ['cpm','dailyBudget'])if(patch[key]!=null&&(!Number.isFinite(patch[key])||patch[key]<0||(key==='cpm'&&patch[key]===0)))errors.push('Invalid '+key);
 if(patch.status&&!['active','on_hold'].includes(patch.status))errors.push('Invalid status');
 if(patch.viewsPerUser!=null&&![1,2,3,4].includes(patch.viewsPerUser))errors.push('Invalid viewsPerUser');
 }
 if(command==='prepare_schedule'){
 if(!Array.isArray(args.hours)||args.hours.length!==7||args.hours.some(day=>!Array.isArray(day)||day.some(h=>!Number.isInteger(h)||h<0||h>23)||new Set(day).size!==day.length))errors.push('hours: seven arrays of unique 0..23 hour indices');
 if(!Number.isInteger(args.timezoneSeconds)||args.timezoneSeconds<-43200||args.timezoneSeconds>50400)errors.push('Explicit timezoneSeconds required');
 }
 if(command==='prepare_budget'&&(!['add','withdraw'].includes(args.direction)||!Number.isFinite(args.amount)||args.amount<=0||Math.abs(args.amount*100-Math.round(args.amount*100))>1e-7))errors.push('Positive amount with two decimal places and add/withdraw direction required');
 if(operations[command].write&&(!/^[a-zA-Z0-9_-]{8,100}$/.test(args.operationId??'')||!args.expectedFingerprint))errors.push('operationId and expectedFingerprint required');
 return errors;
}
