const tabs=[...document.querySelectorAll('[data-tab]')];
function select(name){
 tabs.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));
 document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);
}
tabs.forEach(b=>b.onclick=()=>select(b.dataset.tab));
document.getElementById('operation-kind').addEventListener('change',e=>{
 const preparing=e.target.value.startsWith('prepare_');
 document.getElementById('operation-options').open=preparing;
 document.getElementById('operation-run').textContent=preparing?'Подготовить':'Прочитать';
});
