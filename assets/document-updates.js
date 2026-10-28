/* Completion notices store only acknowledgement IDs on this browser. */
const updatesDialog=document.createElement('dialog');updatesDialog.className='editor-dialog';document.body.append(updatesDialog);
let updateSeen=new Set(),updateEmail='',updateShown=new Set(),updatesUnreadOnly=false,updatesRenderedKey='';
function latestDocumentRows(){const latest=new Map();for(const x of S.intake||[])if(x.driveFileId&&x.status!=='Archived'&&(!latest.has(x.driveFileId)||x.sourceModified>latest.get(x.driveFileId)))latest.set(x.driveFileId,x.sourceModified);return (S.intake||[]).filter(x=>x.status!=='Archived'&&(!x.driveFileId||x.sourceModified===latest.get(x.driveFileId)));}
function documentUpdates(){
 const copies=typeof savedCreditCopies==='function'?savedCreditCopies():typeof creditDraftItems==='undefined'?[]:creditDraftItems,copyIds=new Set(copies.map(f=>f.id));
 const groups=new Map();for(const x of latestDocumentRows().filter(x=>x.processingVersion===2&&!copyIds.has(x.driveFileId))){const key=x.driveFileId||x.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}
 const latestDrafts=new Map();for(const x of copies){const key=x.sourceId||x.id;if(!latestDrafts.has(key)||x.modified>latestDrafts.get(key).modified)latestDrafts.set(key,x);}
 const draftResult=(f,source)=>{const changed=source?.sourceModified&&f.modified<source.sourceModified,needsReview=changed||f.remaining;return {key:'draft|'+f.id+'|'+f.modified+(source?'|'+source.sourceModified:''),title:source?.filename||f.name,status:changed?'Saved copy · original changed':f.customerSigned?'Customer-signed copy saved':f.remaining?'Draft needs '+f.remaining+' answers':'Filled draft saved',note:changed?'This copy predates the current original. Review the changed form before using it.':f.customerSigned?'Your customer signature is included in this saved copy. The supplier signature is separate.':f.remaining?'Some answers are still missing. Open the draft or answer the remaining questions.':'Saved profile details and answers have been filled into the detected fields. Review before use; signatures remain blank.',url:f.url,linkLabel:f.customerSigned?'Open signed copy ↗':needsReview?'Open draft ↗':'Open filled draft ↗',downloadLabel:f.customerSigned?'Download signed copy ↓':needsReview?'Download draft ↓':'Download filled draft ↓',download:f.downloadUrl,originalUrl:source?.sourceUrl,time:f.modified,prepareId:needsReview?f.sourceId:null};};
 const matched=new Set();
 const records=[...groups.values()].map(rows=>{const x=rows[0],draft=latestDrafts.get(x.driveFileId);if(draft){matched.add(x.driveFileId);return draftResult(draft,x);}
  const form=x.bucket==='Credit apps'&&/\.(docx|pdf)$/i.test(x.filename)&&(!x.documentType||x.documentType==='form'),problem=typeof creditDraftProblem!=='undefined'&&creditDraftProblem;
  const statuses=[...new Set(rows.map(r=>r.status))].join(', ');
  return {key:'source|'+(x.driveFileId||x.id)+'|'+x.sourceModified+'|'+statuses,title:x.filename,status:form?(problem?'Draft status unavailable':'Form not filled yet'):statuses,note:form?(problem?'Saved drafts could not be checked. Refresh drafts to try again.':'Only the original is saved. Fill the form using your company profile and answer any missing questions.'):[...new Set(rows.map(r=>r.note))].join(' '),url:x.sourceUrl,linkLabel:'Open original document ↗',time:x.processedAt,amount:rows.reduce((s,r)=>s+(r.amount||0),0),invoice:rows.length>1?rows.length+' invoice records':x.invoice,prepareId:form&&!problem?x.driveFileId:null};});
 const drafts=[...latestDrafts.entries()].filter(([key])=>!matched.has(key)).map(([,x])=>draftResult(x));
 return records.concat(drafts).sort((a,b)=>Number(!!(b.download||b.prepareId))-Number(!!(a.download||a.prepareId))||String(b.time).localeCompare(String(a.time)));
}
function readUpdateSeen(){if(updateEmail===CLOUD.email)return;updateEmail=CLOUD.email;try{updateSeen=new Set(JSON.parse(localStorage.getItem('oversite-document-seen:'+CLOUD.email)||'[]'));}catch{updateSeen=new Set();}}
function paintDocumentUpdates(){
 if(!CLOUD.ready)return;readUpdateSeen();let button=document.getElementById('document-updates-button');
 if(!button){button=document.createElement('button');button.id='document-updates-button';button.className='btn';button.addEventListener('click',()=>showDocumentUpdates(false));cloudBar.after(button);}
 const loading=typeof creditDraftLoaded!=='undefined'&&!creditDraftLoaded;button.disabled=loading;if(loading){button.textContent='Checking document results…';return;}
 if(updatesDialog.open&&documentUpdates().map(x=>x.key).join('\n')!==updatesRenderedKey)showDocumentUpdates(updatesUnreadOnly);
 const count=documentUpdates().filter(x=>!updateSeen.has(x.key)).length;button.textContent=count?'Updates ('+count+')':'Updates';
 if(count&&!intakeBusy&&!document.querySelector('dialog[open]')&&!CLOUD.dirty&&!CLOUD.saving&&!document.activeElement?.matches('input,textarea,select')&&documentUpdates().some(x=>!updateSeen.has(x.key)&&!updateShown.has(x.key)))showDocumentUpdates(true);
}
function showDocumentUpdates(unreadOnly){
 updatesUnreadOnly=unreadOnly;
 updatesRenderedKey=documentUpdates().map(x=>x.key).join('\n');
 const items=documentUpdates().filter(x=>!unreadOnly||!updateSeen.has(x.key));for(const x of items)updateShown.add(x.key);
 updatesDialog.innerHTML=`<div style="padding:24px;max-width:850px"><div class="panel-head"><h2>Document updates</h2><button class="btn" data-updates-close>Close</button></div><p>Filled form drafts have their own open and download buttons. Statements and payment references retain their original documents.</p>${typeof creditDraftProblem!=='undefined'&&creditDraftProblem?'<p class="notice">Saved form drafts could not be checked. <button class="btn" data-updates-refresh>Refresh drafts</button></p>':''}${items.map(x=>`<div class="notice"><b>${esc(x.title)}</b><p><strong>${esc(x.status)}</strong>${x.invoice?' · '+esc(x.invoice):''}${x.amount?' · '+money(x.amount):''}</p><p>${esc(x.note||'')}</p>${x.url?`<a class="btn ${x.download?'primary':''}" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.linkLabel)}</a>`:''}${x.download?` <a class="btn primary" href="${esc(x.download)}" target="_blank" rel="noopener">${esc(x.downloadLabel)}</a>`:''}${x.originalUrl?` <a class="btn" href="${esc(x.originalUrl)}" target="_blank" rel="noopener">Original upload ↗</a>`:''}${x.prepareId?` <button class="btn" data-updates-prepare="${esc(x.prepareId)}">Fill form / answer questions</button>`:''}</div>`).join('')||'<p>No document updates yet.</p>'}<p><button class="btn primary" data-updates-read>Mark these updates read</button></p></div>`;
 updatesDialog.querySelector('[data-updates-close]').onclick=()=>updatesDialog.close();
 const refresh=updatesDialog.querySelector('[data-updates-refresh]');if(refresh)refresh.onclick=()=>loadCreditDrafts();
 for(const button of updatesDialog.querySelectorAll('[data-updates-prepare]'))button.onclick=async()=>{updatesDialog.close();try{await openCreditForm(button.dataset.updatesPrepare);}catch(e){toast(e.message);}};
 updatesDialog.querySelector('[data-updates-read]').onclick=()=>{for(const x of items)updateSeen.add(x.key);try{localStorage.setItem('oversite-document-seen:'+CLOUD.email,JSON.stringify([...updateSeen].slice(-3000)));}catch{}updatesDialog.close();paintDocumentUpdates();};
 if(!updatesDialog.open)updatesDialog.showModal();
}
const receiveBeforeUpdates=receiveCloud;receiveCloud=function(r){receiveBeforeUpdates(r);setTimeout(paintDocumentUpdates,0);};
document.addEventListener('oversite-form-drafts-updated',()=>{if(updatesDialog.open)showDocumentUpdates(updatesUnreadOnly);paintDocumentUpdates();});
const queueBeforeUpdates=reviewQueueIntake;
reviewQueueIntake=function(){const box=document.createElement('div');box.innerHTML=queueBeforeUpdates();const current=new Set(latestDocumentRows().map(x=>x.id));for(const row of box.querySelectorAll('tbody tr')){const id=row.querySelector('[data-intake="details"],[data-intake="archive"]')?.dataset.id,x=S.intake.find(x=>x.id===id);if(!x)continue;if(!intakeShowArchived&&!current.has(x.id)){row.remove();continue;}
 if(['payment-reference','statement','email'].includes(x.documentType)){
  for(const b of row.querySelectorAll('[data-burn="review-file"],[data-form="prepare"]'))b.remove();
  if(x.documentType!=='statement')row.children[2].innerHTML=esc(x.party||'')+'<span class="mini">Saved document</span>';
  row.children[2].insertAdjacentHTML('beforeend',`<span class="mini">${esc(x.referenceType||x.documentType)}${x.bank?' · '+esc(x.bank):''}${x.accountLast4?' · account ending '+esc(x.accountLast4):''}</span>`);
 }
 const signedCopy=typeof savedCreditCopies==='function'&&savedCreditCopies().find(f=>f.customerSigned&&f.id===x.driveFileId);if(signedCopy){for(const b of row.querySelectorAll('[data-burn="review-file"],[data-form="prepare"],[data-intake="retry"]'))b.remove();row.children[2].textContent='Customer-signed copy';row.children[4].textContent='Customer-signed copy';row.lastElementChild.insertAdjacentHTML('afterbegin',creditDraftLinks(signedCopy));continue;}
 if(x.status==='Reconciled'||x.status==='Saved reference')row.lastElementChild.insertAdjacentHTML('afterbegin',`<span class="mini">${esc(x.note)}</span>`);
 if(x.status!=='Posted'&&x.status!=='Reconciled'&&x.driveFileId)row.lastElementChild.insertAdjacentHTML('beforeend',`<button class="btn small" data-intake="retry" data-id="${esc(x.driveFileId)}">Process again</button>`);
}const summary=box.querySelector('.panel-head .sub');if(summary)summary.textContent=box.querySelectorAll('tbody tr').length+' displayed records · '+S.intake.length+' including history · complete AR/AP invoices update the ledger; unclear items need review';return box.innerHTML;};
setInterval(()=>{if(document.visibilityState==='visible')paintDocumentUpdates();},5000);
paintDocumentUpdates();render();
