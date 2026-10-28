/* Private form preparation: verified profile -> questions -> saved Drive draft. */
let creditFormSession=null,creditDraftItems=[],creditDraftProblem='',creditDraftLoaded=false,creditDraftLoading=null;
function formBytes64(bytes){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);}
function creditSourceName(name){return String(name||'').replace(/ - (?:draft|customer signed)(\.(?:docx|pdf))$/i,'$1').toLowerCase();}
function savedCreditCopies(){
 const copies=new Map(creditDraftItems.map(f=>[f.id,f]));
 for(const r of CLOUD.docs||[]){
  if(r[1]!=='Credit apps'||! / - customer signed\.(?:docx|pdf)$/i.test(r[2]))continue;
  const name=creditSourceName(r[2]),sources=new Set();
  for(const f of creditDraftItems)if(f.sourceId&&creditSourceName(f.name)===name)sources.add(f.sourceId);
  for(const f of S.intake||[])if(f.bucket==='Credit apps'&&f.driveFileId&&String(f.filename||'').toLowerCase()===name)sources.add(f.driveFileId);
  copies.set(r[0],{id:r[0],name:r[2],url:r[4],downloadUrl:'https://drive.google.com/uc?id='+encodeURIComponent(r[0])+'&export=download',modified:r[3],sourceId:sources.size===1?[...sources][0]:null,customerSigned:true,remaining:0});
 }
 return [...copies.values()];
}
function creditDraftLinks(file){return `<a class="btn" href="${esc(file.webViewLink||file.url)}" target="_blank" rel="noopener">${file.customerSigned?'Open signed copy':'Open saved draft'} ↗</a>${file.webContentLink||file.downloadUrl?` <a class="btn primary" href="${esc(file.webContentLink||file.downloadUrl)}" target="_blank" rel="noopener">${file.customerSigned?'Download signed copy':'Download draft'} ↓</a>`:''}`;}
async function loadCreditDrafts(){
 if(creditDraftLoading)return creditDraftLoading;
 creditDraftLoading=(async()=>{try{const r=await rpcCloud('getCreditDrafts');creditDraftItems=r.items||[];creditDraftProblem='';}catch(e){creditDraftProblem=e.message;}finally{creditDraftLoaded=true;creditDraftLoading=null;}if(!document.querySelector('dialog[open]'))render();document.dispatchEvent(new Event('oversite-form-drafts-updated'));})();
 return creditDraftLoading;
}
function savedCreditDrafts(){
 const latest=new Map(),earlier=[];for(const f of savedCreditCopies().sort((a,b)=>String(b.modified).localeCompare(String(a.modified)))){const key=f.sourceId||f.id;if(latest.has(key))earlier.push(f);else latest.set(key,f);}
 const row=(f,old=false)=>`<p><b>${esc(f.name)}</b><span class="mini">${old?'Earlier copy · ':''}${f.customerSigned?'Customer-signed copy':(f.remaining?f.remaining+' unanswered fields':'Filled draft saved')+' · Unsigned'} · ${esc(f.modified?new Date(f.modified).toLocaleString():'')}</span>${creditDraftLinks(f)}</p>`;
 return `<section class="panel section-gap"><div class="panel-head"><div><h2>Saved forms</h2><p class="sub">The latest saved copy for each form is shown first. Customer-signed copies are labeled separately from unsigned drafts.</p></div><button class="btn" data-form="refresh">Refresh drafts</button></div><div class="panel-body">${creditDraftProblem?`<p class="notice">${esc(creditDraftProblem)}</p>`:''}${!creditDraftLoaded?'Checking saved drafts…':latest.size?[...latest.values()].map(f=>row(f)).join(''):'No saved draft found. Use Fill original form to prepare a Word .docx or fillable PDF.'}${earlier.length?`<details><summary>Earlier copies (${earlier.length})</summary>${earlier.map(f=>row(f,true)).join('')}</details>`:''}</div></section>`;
}
const inboxBeforeForms=driveInboxCloud;
driveInboxCloud=function(bucket){const holder=document.createElement('div');holder.innerHTML=inboxBeforeForms(bucket);for(const row of holder.querySelectorAll('tbody tr')){const action=row.querySelector('[data-cloud="read-doc"]'),copy=action&&savedCreditCopies().find(f=>f.id===action.dataset.id);if(copy){row.children[2].textContent=copy.customerSigned?'Customer-signed copy':'Saved form draft';action.remove();}}return holder.innerHTML;};
const filesWithIntake=filesScreenV3,creditWithIntake=creditScreenV3,queueWithIntake=reviewQueueIntake;
filesScreenV3=function(){return filesWithIntake()+savedCreditDrafts();};
creditScreenV3=function(){return creditWithIntake()+savedCreditDrafts();};
reviewQueueIntake=function(){const holder=document.createElement('div');holder.innerHTML=queueWithIntake();for(const row of holder.querySelectorAll('tbody tr')){const id=row.querySelector('[data-intake="details"]')?.dataset.id,x=S.intake.find(r=>r.id===id);if(x?.bucket==='Credit apps'&&x.driveFileId&&/\.(?:docx|pdf)$/i.test(x.filename)){for(const action of row.querySelectorAll('[data-intake="details"],[data-intake="fill-pdf"],[data-burn="review-file"]'))action.remove();row.lastElementChild.insertAdjacentHTML('afterbegin',`<button class="btn small primary" data-form="prepare" data-id="${esc(x.driveFileId)}">Fill original form</button>`);}}return holder.innerHTML;};
profileFields.push(['entityDescription','Registered entity description (for example: Texas limited liability company)'],['formationState','State of formation'],['noticeDetails','Legal notice address, contact name and email'],['ceoName','CEO name'],['ceoEmail','CEO email'],['defaultEffectiveDate','Effective date for new forms'],['signatoryName','Authorized representative — printed name'],['signatoryTitle','Authorized representative — title'],['signatureDriveUrl','Saved signature image — private Google Drive link']);
async function openCreditForm(id){
 await intakeReady();toast('Reading the form and matching saved company details…');
 const source=await rpcCloud('getCreditForm',id),bytes=Uint8Array.from(atob(source.data),c=>c.charCodeAt(0));
 const session={source,answers:{},fields:[],word:null,pdf:null,saved:null,busy:false};
 if(/\.docx$/i.test(source.name)){
  session.word=OverSiteWordForms.open(bytes);session.fields=session.word.fields.filter(f=>!f.manual);
 }else{
  session.pdf=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false});const form=session.pdf.getForm();
  if(form.hasXFA()||form.getFields().some(f=>f instanceof PDFLib.PDFSignature&&f.acroField.dict.get(PDFLib.PDFName.of('V'))))throw Error('XFA or signed PDFs need manual completion. Use an unsigned fillable original.');
  session.fields=form.getFields().filter(f=>f instanceof PDFLib.PDFTextField&&!OverSiteWordForms.isManual(f.getName())).map((f,i)=>({id:'pdf-'+i,label:f.getName(),context:f.getName(),profileKey:OverSiteWordForms.profileKey(f.getName()),existing:f.getText()||'',pdfField:f}));
 }
 for(const field of session.fields){const known=field.profileKey?S.companyProfile?.[field.profileKey]:'';session.answers[field.id]=(field.replaceFromProfile?known||field.existing:field.existing||known)||'';if(!session.answers[field.id]&&/^effective\s*date$/i.test(field.label)&&S.companyProfile?.defaultEffectiveDate==='current'){const now=new Date();session.answers[field.id]=now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}}
 session.initialAnswers={...session.answers};
 creditFormSession=session;
 if(intakeDialog.open)intakeDialog.close();
 if(!session.fields.length){intakeModal('Form needs manual completion',`<p>No supported blank text fields were found. The original is stored in Credit apps. Flat/scanned PDFs need a fillable version.</p><a class="btn" href="https://drive.google.com/file/d/${encodeURIComponent(id)}/view" target="_blank" rel="noopener">Open original ↗</a>`);return;}
 showCreditQuestions();
 // Save fully answered forms immediately. Unknown answers are never invented.
 if(session.fields.every(f=>session.answers[f.id].trim()))await savePreparedCredit();
}
preparePdf=async function(id){return openCreditForm(id);};
function showCreditQuestions(){
 const s=creditFormSession,missing=s.fields.filter(f=>!s.answers[f.id].trim());
 intakeModal('Fill original form — '+s.source.name,`<p>${missing.length?'Please answer '+missing.length+' missing field'+(missing.length===1?'':'s')+'. Saved company details have been filled where the labels match.':'The detected text fields have answers. Verify them before using the draft.'}</p><p class="mini">Answers go into the original document format. Company answers you enter are remembered for future forms when you save. Identified customer names use your saved legal business name; contract terms stay unchanged.</p>${s.saved?`<div class="notice">${missing.length?'Incomplete draft':'Draft'} saved in Credit apps. ${creditDraftLinks(s.saved)}</div>`:''}<div class="form-grid">${s.fields.map(f=>`<label class="field">${esc(f.label)}${s.answers[f.id]?'':' · answer needed'}<span class="mini">${esc(f.context)}</span>${f.multiline?`<textarea data-form-answer="${esc(f.id)}" maxlength="1500" rows="4">${esc(s.answers[f.id])}</textarea>`:`<input data-form-answer="${esc(f.id)}" maxlength="1500" value="${esc(s.answers[f.id])}">`}</label>`).join('')}</div><p><button class="btn primary" data-form="save">Fill document and save download link</button></p><p class="mini">${s.word?.manual.length?'Signature or ambiguous signing areas also remain for manual completion. ':''}You may save an incomplete draft. Nothing is signed or submitted.</p>`);
}
async function savePreparedCredit(){
 const s=creditFormSession;if(!s||s.busy)return;
 await intakeReady();s.busy=true;
 const button=intakeDialog.querySelector('[data-form="save"]');if(button){button.disabled=true;button.textContent='Saving draft to Credit apps…';}
 try{
  for(const input of intakeDialog.querySelectorAll('[data-form-answer]'))s.answers[input.dataset.formAnswer]=input.value.trim();
  let bytes;if(s.word)bytes=OverSiteWordForms.fill(s.word,s.answers);else{for(const field of s.fields)if(s.answers[field.id])field.pdfField.setText(s.answers[field.id]);bytes=await s.pdf.save();}
  const remaining=s.fields.filter(f=>!s.answers[f.id]).length;
  s.saved=await rpcCloud('saveCreditDraft',{sourceId:s.source.id,modified:s.source.modified,data:formBytes64(bytes),remaining});
  const verified=Object.fromEntries(s.fields.filter(f=>f.profileKey&&!f.existing&&s.answers[f.id]&&s.answers[f.id]!==s.initialAnswers[f.id]).map(f=>[f.profileKey,s.answers[f.id]]));
  if(Object.entries(verified).some(([key,value])=>S.companyProfile?.[key]!==value)){S.companyProfile={...S.companyProfile,...verified};save('Remembered verified company answers from form');await saveCloud();}
  await loadCreditDrafts();await documentChangedCloud();intakeDialog.close();showCreditQuestions();toast('Draft saved in Credit apps. The download link is ready.');
 }finally{s.busy=false;if(button){button.disabled=false;button.textContent='Fill document and save download link';}}
}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-form]');if(!t)return;try{if(t.dataset.form==='prepare')await openCreditForm(t.dataset.id);if(t.dataset.form==='save')await savePreparedCredit();if(t.dataset.form==='refresh')await loadCreditDrafts();}catch(error){toast(error.message);}});
document.addEventListener('input',e=>{if(e.target.dataset.formAnswer&&creditFormSession)creditFormSession.answers[e.target.dataset.formAnswer]=e.target.value;});
document.addEventListener('oversite-auth-ready',()=>loadCreditDrafts());
loadCreditDrafts();
