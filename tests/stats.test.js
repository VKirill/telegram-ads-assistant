import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readAccountSnapshot} from '../src/stats.js';
function run(html,url='https://ads.telegram.org/account'){
 const dom=new JSDOM(html,{url,runScripts:'outside-only'});
 try{return JSON.parse(JSON.stringify(dom.window.eval('('+readAccountSnapshot.toString()+')()')));}finally{dom.window.close();}
}
const head=['Ad title','Views','Clicks','Spent','Budget','Status','CPM','CTR'];
const fixture='<table><thead><tr>'+head.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody><tr>'+[
 '<a href="/account/ad/148">Test</a>','0','0','<span class="currency-ton">💎</span>0.00','💎1.00','On Hold','💎0.20','–'
].map(x=>'<td>'+x+'</td>').join('')+'</tr></tbody></table>';
test('actual title case headers, zero versus missing, period remains explicit',()=>{
 const r=run(fixture);assert.equal(r.available,true);assert.equal(r.rows[0].id,'148');assert.equal(r.rows[0].spent,0);assert.equal(r.rows[0].ctr,null);assert.equal(r.currency,'TON');assert.equal(r.period.from,null);
});
test('schema changes and wrong origin produce explicit errors rather than null',()=>{
 for(const [html,url] of [[fixture.replace('<th>Views</th>','<th>Other</th>')], [fixture,'https://example.com/account']]){
 const r=run(html,url);assert.equal(r.available,false);assert.ok(r.error);
 }
});
