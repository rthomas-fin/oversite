/* Completion notices store only acknowledgement IDs on this browser. */
const updatesDialog=document.createElement('dialog');updatesDialog.className='editor-dialog';document.body.append(updatesDialog);
let updateSeen=new Set(),updateEmail='',updateShown=new Set();
function latestDocumentRows(){const latest=new Map();for(const x of S.intake||[])if(x.driveFileId&&x.status!=='Archived'&&(!latest.has(x.driveFileId)||x.sourceModified>latest.get(x.driveFileId)))latest.set(x.driveFileId,x.sourceModified);return (S.intake||[]).filter(x=>x.status!=='Archived'&&(!x.driveFileId||x.sourceModified===latest.get(x.driveFileId)));}
function documentUpdates(){
 const groups=new Map();for(const x of latestDocumentRows().filter(x=>x.processingVersion===2)){const key=x.driveFileId||x.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}
 const records=[...groups.values()].map(rows=>{const x=rows[0],statuses=[...new Set(rows.map(r=>r.status))].join(', ');return {key:'source|'+(x.driveFileId||x.id)+'|'+x.sourceModified+'|'+statuses,title:x.filename,status:statuses,note:[...new Set(rows.map(r=>r.note))].join(' '),url:x.sourceUrl,time:x.processedAt,amount:rows.reduce((s,r)=>s+(r.amount||0),0),invoice:rows.length>1?rows.length+' invoice records':x.invoice};});
 const latestDrafts=new Map();for(const x of typeof creditDraftItems==='undefined'?[]:creditDraftItems){const key=x.sourceId||x.id;if(!latestDrafts.has(key)||x.modified>latestDrafts.get(key).modified)latestDrafts.set(key,x);}
 const drafts=[...latestDrafts.values()].map(x=>({key:'draft|'+x.id+'|'+x.modified,title:x.name,status:x.remaining?'Draft needs '+x.remaining+' answers':'Form draft ready',note:'Saved in Credit apps. Unsigned draft.',url:x.url,download:x.downloadUrl,time:x.modified}));
 return records.concat(drafts).sort((a,b)=>String(b.time).localeCompare(String(a.time)));
}
function readUpdateSeen(){if(updateEmail===CLOUD.email)return;updateEmail=CLOUD.email;try{updateSeen=new Set(JSON.parse(localStorage.getItem('oversite-document-seen:'+CLOUD.email)||'[]'));}catch{updateSeen=new Set();}}
function paintDocumentUpdates(){
 if(!CLOUD.ready)return;readUpdateSeen();let button=document.getElementById('document-updates-button');
 if(!button){button=document.createElement('button');button.id='document-updates-button';button.className='btn';button.addEventListener('click',()=>showDocumentUpdates(false));cloudBar.after(button);}
 const count=documentUpdates().filter(x=>!updateSeen.has(x.key)).length;button.textContent=count?'Updates ('+count+')':'Updates';
 if(count&&!intakeBusy&&!document.querySelector('dialog[open]')&&!CLOUD.dirty&&!CLOUD.saving&&!document.activeElement?.matches('input,textarea,select')&&documentUpdates().some(x=>!updateSeen.has(x.key)&&!updateShown.has(x.key)))showDocumentUpdates(true);
}
function showDocumentUpdates(unreadOnly){
 const items=documentUpdates().filter(x=>!unreadOnly||!updateSeen.has(x.key));for(const x of items)updateShown.add(x.key);
 updatesDialog.innerHTML=`<div style="padding:24px;max-width:850px"><div class="panel-head"><h2>Document updates</h2><button class="btn" data-updates-close>Close</button></div>${items.map(x=>`<div class="notice"><b>${esc(x.title)}</b><p>${esc(x.status)}${x.invoice?' · '+esc(x.invoice):''}${x.amount?' · '+money(x.amount):''}</p><p>${esc(x.note||'')}</p>${x.url?`<a class="btn" href="${esc(x.url)}" target="_blank" rel="noopener">Open saved file ↗</a>`:''}${x.download?` <a class="btn" href="${esc(x.download)}" target="_blank" rel="noopener">Download ↓</a>`:''}</div>`).join('')||'<p>No document updates yet.</p>'}<p><button class="btn primary" data-updates-read>Mark these updates read</button></p></div>`;
 updatesDialog.querySelector('[data-updates-close]').onclick=()=>updatesDialog.close();
 updatesDialog.querySelector('[data-updates-read]').onclick=()=>{for(const x of items)updateSeen.add(x.key);try{localStorage.setItem('oversite-document-seen:'+CLOUD.email,JSON.stringify([...updateSeen].slice(-3000)));}catch{}updatesDialog.close();paintDocumentUpdates();};
 if(!updatesDialog.open)updatesDialog.showModal();
}
const receiveBeforeUpdates=receiveCloud;receiveCloud=function(r){receiveBeforeUpdates(r);setTimeout(paintDocumentUpdates,0);};
const queueBeforeUpdates=reviewQueueIntake;
reviewQueueIntake=function(){const box=document.createElement('div');box.innerHTML=queueBeforeUpdates();const current=new Set(latestDocumentRows().map(x=>x.id));for(const row of box.querySelectorAll('tbody tr')){const id=row.querySelector('[data-intake="details"],[data-intake="archive"]')?.dataset.id,x=S.intake.find(x=>x.id===id);if(!x)continue;if(!intakeShowArchived&&!current.has(x.id)){row.remove();continue;}
 if(['payment-reference','statement','email'].includes(x.documentType)){
  for(const b of row.querySelectorAll('[data-burn="review-file"],[data-form="prepare"]'))b.remove();
  row.children[2].insertAdjacentHTML('beforeend',`<span class="mini">${esc(x.referenceType||x.documentType)}${x.bank?' · '+esc(x.bank):''}${x.accountLast4?' · account ending '+esc(x.accountLast4):''}</span>`);
 }
 if(x.status==='Reconciled'||x.status==='Saved reference')row.lastElementChild.insertAdjacentHTML('afterbegin',`<span class="mini">${esc(x.note)}</span>`);
 if(x.status!=='Posted'&&x.status!=='Reconciled'&&x.driveFileId)row.lastElementChild.insertAdjacentHTML('beforeend',`<button class="btn small" data-intake="retry" data-id="${esc(x.driveFileId)}">Process again</button>`);
}return box.innerHTML;};
setInterval(()=>{if(document.visibilityState==='visible')paintDocumentUpdates();},5000);
paintDocumentUpdates();render();
