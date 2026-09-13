// Pure post-write checks. A click/200 response never counts as verification.
export function verifySaved({kind,adId,expected,before,after}){
 if(!after||after.error)return {verified:false,reason:'readback_unavailable'};
 if(kind==='create'||kind==='edit'){
 const actualId=after.path?.match(/^\/account\/ad\/(\d+)$/)?.[1];
 if(!actualId||(adId&&actualId!==String(adId)))return {verified:false,reason:'entity_mismatch'};
 const map={title:'title',text:'text',url:'promote_url',cpm:'cpm',dailyBudget:'daily_budget',viewsPerUser:'views_per_user'};
 for(const [key,value] of Object.entries(expected)){
 if(key==='status'){if(after.fields?.active!==(value==='active'?'1':'0'))return {verified:false,reason:'status_mismatch'};continue;}
 const name=map[key];if(!name)continue;
 const actual=after.fields?.[name];
 if(['cpm','dailyBudget','viewsPerUser'].includes(key)?Number(actual)!==value:String(actual)!==String(value))return {verified:false,reason:'field_mismatch',field:key};
 }
 return {verified:true,adId:actualId};
 }
 if(kind==='budget'){
 // A concurrent campaign spend invalidates simple arithmetic. Require a new matching history entry.
 if(!before?.transactionIds||!after.transactionIds||!expected.transactionId)return {verified:false,reason:'transaction_evidence_required'};
 return {verified:!before.transactionIds.includes(expected.transactionId)&&after.transactionIds.includes(expected.transactionId)};
 }
 return {verified:false,reason:'unsupported_verification'};
}
