import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {webcrypto} from 'node:crypto';
import {cabinetOperation} from '../src/cabinet.js';
import {validateOperation} from '../src/operations.js';
function page(path,body){
 const dom=new JSDOM(body,{url:'https://ads.telegram.org'+path,runScripts:'outside-only'});
 Object.defineProperty(dom.window,'crypto',{value:webcrypto});
 dom.window.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}];};
 return dom;
}
test('CPM edit stages exact value but never submits',async()=>{
 const dom=page('/account/ad/148','<input name="cpm" value="0.20"><button>Save Changes</button>');
 let clicks=0;dom.window.document.querySelector('button').onclick=()=>clicks++;
 try{
 const fn=dom.window.eval('('+cabinetOperation.toString()+')');
 const r=await fn('prepare_edit',{adId:'148',patch:{cpm:0.3}});
 assert.equal(r.fields.cpm,'0.3');assert.equal(r.saved,false);assert.equal(clicks,0);
 const blocked=await fn('commit_edit',{adId:'148',expectedFingerprint:r.fingerprint});
 assert.match(blocked.error,/paused/);assert.equal(clicks,0);
 const stale=await fn('commit_edit',{adId:'148',expectedFingerprint:'wrong',allowWrite:true});
 assert.match(stale.error,/changed/);assert.equal(clicks,0);
 }finally{dom.window.close();}
});
test('budget add and withdrawal stay distinct and unsaved',async()=>{
 for(const direction of ['add','withdraw']){
 const dom=page('/account/ad/148/budget','<input name="amount"><input name="decr_amount">');
 try{
 const r=await dom.window.eval('('+cabinetOperation.toString()+')')('prepare_budget',{adId:'148',direction,amount:1.23});
 assert.equal(r.saved,false);assert.equal(r.fields[direction==='add'?'amount':'decr_amount'],'1.23');
 assert.equal(r.fields[direction==='add'?'decr_amount':'amount'],'');
 }finally{dom.window.close();}
 }
});
test('wrong entity refuses editing',async()=>{
 const dom=page('/account/ad/149','<input name="cpm" value=".2">');try{
 const r=await dom.window.eval('('+cabinetOperation.toString()+')')('prepare_edit',{adId:'148',patch:{cpm:.3}});
 assert.match(r.error,/identity/);assert.equal(dom.window.document.querySelector('input').value,'.2');
 }finally{dom.window.close();}
});
test('target changes rejected and monetary amounts bounded',()=>{
 assert.ok(validateOperation('prepare_edit',{adId:'148',patch:{target:{type:'search'}}}).length);
 for(const amount of [-1,NaN,Infinity,0,.001])assert.ok(validateOperation('prepare_budget',{adId:'148',direction:'add',amount}).length);
 assert.deepEqual(validateOperation('prepare_budget',{adId:'148',direction:'add',amount:1}),[]);
});
test('all four target modes produce unsaved drafts with selected tokens',async()=>{
 for(const [type,key,value]of [['search','search_queries','portrait'],['bots','bots','ExampleBot'],['channels','channels','examplechannel'],['users','countries','Germany']]){
 const html=['title','promote_url','cpm','budget'].map(n=>'<input name="'+n+'">').join('')+'<textarea name="text"></textarea>'+
 ['search','bots','users','channels'].map(t=>'<input type="radio" name="target_type" value="'+t+'">').join('')+
 '<input type="radio" name="active" value="0" checked>'+
 '<div class="select" data-name="'+key+'"><div contenteditable="true"></div><div class="items-list"><div class="search-item selected" data-i="0" data-val="'+value+'">'+value+'</div></div></div>';
 const dom=page('/account/ad/new',html);try{
 const w=dom.window.document.querySelector('.select'),editor=w.querySelector('[contenteditable]');
 const add=()=>{const item=dom.window.document.createElement('div');item.className='selected-item';item.textContent=value;item.setAttribute('data-val',value);w.append(item);};
 editor.addEventListener('keydown',e=>{if(e.key==='Enter')add();});w.querySelector('[data-val]').onclick=add;
 const target={type,[{search:'queries',bots:'bots',channels:'channels',users:'countries'}[type]]:[value]};
 const r=await dom.window.eval('('+cabinetOperation.toString()+')')('prepare_ad',{ad:{title:'QA',url:'https://t.me/ExampleBot?start=qa',text:'Text',budget:1,cpm:.2,target}});
 assert.equal(r.error,undefined,type+': '+r.error);assert.equal(r.published,false);assert.equal(r.fields.active,'0');assert.equal(r.targets[key].length,1);
 }finally{dom.window.close();}
 }
});
test('readback verification refuses mismatched entity/CPM and ambiguous money outcome',async()=>{
 const {verifySaved}=await import('../src/verification.js');
 assert.equal(verifySaved({kind:'edit',adId:'148',expected:{cpm:.3},after:{path:'/account/ad/148',fields:{cpm:'.20'}}}).verified,false);
 assert.equal(verifySaved({kind:'edit',adId:'148',expected:{cpm:.3},after:{path:'/account/ad/148',fields:{cpm:'.30'}}}).verified,true);
 assert.equal(verifySaved({kind:'budget',expected:{amount:1},before:{},after:{}}).verified,false);
});

test('commit checks terms automatically after explicit write authorization',async()=>{
 const dom=page('/account/ad/new','<input name="title"><input name="promote_url"><input name="cpm"><input name="budget"><textarea name="text"></textarea><input type="radio" name="target_type" value="channels" checked><input type="radio" name="active" value="0" checked><input type="checkbox" name="confirmed"><button>Create Ad</button>');
 try{let clicked=false;dom.window.document.querySelector('button').onclick=()=>{clicked=dom.window.document.querySelector('[name="confirmed"]').checked;};
 const fn=dom.window.eval('('+cabinetOperation.toString()+')');const draft=await fn('prepare_ad',{ad:{title:'QA',url:'https://t.me/ExampleBot?start=qa',text:'Test',budget:1,cpm:.2,target:{type:'channels'}}});
 const unrelated=dom.window.document.createElement('input');unrelated.name='gtrans';unrelated.value='translation';dom.window.document.body.append(unrelated);
 const r=await fn('commit_ad',{allowWrite:true,expectedFingerprint:draft.fingerprint,operationId:'fixture-terms'});assert.equal(r.error,undefined);assert.equal(clicked,true);assert.equal(r.state,'submitted_needs_verification');
 }finally{dom.window.close();}
});
test('website draft waits for native recognition, preserves UTM, fills website name without submitting',async()=>{
 const dom=page('/account/ad/new','<input name="title"><input name="promote_url"><input name="cpm"><input name="budget"><textarea name="text"></textarea><input type="radio" name="target_type" value="channels" checked><input type="radio" name="active" value="0" checked><div class="js-field-website_name-wrap" hidden><input name="website_name"></div><button>Create Ad</button>');
 try{let clicked=0;dom.window.document.querySelector('button').onclick=()=>clicked++;
 dom.window.document.querySelector('[name="promote_url"]').addEventListener('change',()=>setTimeout(()=>{dom.window.document.querySelector('.js-field-website_name-wrap').hidden=false;},30));
 const r=await dom.window.eval('('+cabinetOperation.toString()+')')('prepare_ad',{ad:{title:'Site',text:'Test',url:'https://example.com/landing?utm_source=tg',websiteName:'My site',cpm:.75,budget:2,target:{type:'channels'}}});
 assert.equal(r.error,undefined);assert.equal(r.fields.website_name,'My site');assert.equal(r.fields.promote_url,'https://example.com/landing?utm_source=tg');assert.equal(r.destinationVerification,'website_recognized_by_cabinet');assert.equal(clicked,0);assert.equal(r.published,false);
 }finally{dom.window.close();}
});
test('native rejection of website aborts preparation and cannot become a commit',async()=>{
 const dom=page('/account/ad/new','<input name="title"><input name="promote_url"><input name="cpm"><input name="budget"><textarea name="text"></textarea><input type="radio" name="target_type" value="channels" checked><input type="radio" name="active" value="0" checked><button>Create Ad</button>');
 try{let clicked=0;dom.window.document.querySelector('button').onclick=()=>clicked++;
 dom.window.document.querySelector('[name="promote_url"]').addEventListener('change',()=>{const e=dom.window.document.createElement('div');e.className='field-error';e.textContent='Website unavailable in this account';dom.window.document.body.append(e);});
 const fn=dom.window.eval('('+cabinetOperation.toString()+')');const r=await fn('prepare_ad',{ad:{title:'Site',text:'Test',url:'https://example.com',cpm:.75,budget:2,target:{type:'channels'}}});assert.match(r.error,/Website unavailable/);
 const draft=await fn('read_draft',{});const result=await fn('commit_ad',{allowWrite:true,expectedFingerprint:draft.fingerprint,operationId:'test-website'});assert.match(result.error,/not confirmed/);assert.equal(clicked,0);
 }finally{dom.window.close();}
});
