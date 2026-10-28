/* Private form preparation: verified profile -> questions -> saved Drive draft. */
let creditFormSession=null,creditDraftItems=[],creditDraftProblem='';
function formBytes64(bytes){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);}
function creditDraftLinks(file){return `<a class="btn" href="${esc(file.webViewLink||file.url)}" target="_blank" rel="noopener">Open saved draft ↗</a>${file.webContentLink||file.downloadUrl?` <a class="btn primary" href="${esc(file.webContentLink||file.downloadUrl)}" target="_blank" rel="noopener">Download draft ↓</a>`:''}`;}
async function loadCreditDrafts(){try{const r=await rpcCloud('getCreditDrafts');creditDraftItems=r.items||[];creditDraftProblem='';}catch(e){creditDraftProblem=e.message;}if(!document.querySelector('dialog[open]'))render();}
function savedCreditDrafts(){return `<section class="panel section-gap"><div class="panel-head"><div><h2>Saved form drafts</h2><p class="sub">Stored beside the originals in Credit apps. Originals are unchanged.</p></div><button class="btn" data-form="refresh">Refresh drafts</button></div><div class="panel-body">${creditDraftProblem?`<p class="notice">${esc(creditDraftProblem)}</p>`:''}${creditDraftItems.length?creditDraftItems.slice().sort((a,b)=>String(b.modified).localeCompare(String(a.modified))).map(f=>`<p><b>${esc(f.name)}</b><span class="mini">${f.remaining?f.remaining+' unanswered fields · ':''}Unsigned draft · ${esc(String(f.modified||'').slice(0,10))}</span>${creditDraftLinks(f)}</p>`).join(''):'Upload a Word .docx or fillable PDF to Credit apps to prepare a draft.'}</div></section>`;}
const filesWithIntake=filesScreenV3,creditWithIntake=creditScreenV3,queueWithIntake=reviewQueueIntake;
filesScreenV3=function(){return filesWithIntake()+savedCreditDrafts();};
creditScreenV3=function(){return creditWithIntake()+savedCreditDrafts();};
reviewQueueIntake=function(){const holder=document.createElement('div');holder.innerHTML=queueWithIntake();for(const row of holder.querySelectorAll('tbody tr')){const id=row.querySelector('[data-intake="details"]')?.dataset.id,x=S.intake.find(r=>r.id===id);if(x?.bucket==='Credit apps'&&x.driveFileId&&/\.docx$/i.test(x.filename))row.lastElementChild.insertAdjacentHTML('beforeend',`<button class="btn small" data-form="prepare" data-id="${esc(x.driveFileId)}">Prepare form draft</button>`);}return holder.innerHTML;};
profileFields.push(['entityDescription','Registered entity description (for example: a Texas limited liability company)'],['signatoryName','Authorized representative — printed name'],['signatoryTitle','Authorized representative — title']);
async function openCreditForm(id){
 await intakeReady();toast('Reading the form and matching saved company details…');
 const source=await rpcCloud('getCreditForm',id),bytes=Uint8Array.from(atob(source.data),c=>c.charCodeAt(0));
 const session={source,answers:{},fields:[],word:null,pdf:null,saved:null,busy:false};
 if(/\.docx$/i.test(source.name)){
  session.word=OverSiteWordForms.open(bytes);session.fields=session.word.fields.filter(f=>!f.manual);
 }else{
  session.pdf=await PDFLib.PDFDocument.load(bytes);const form=session.pdf.getForm();
  if(form.hasXFA()||form.getFields().some(f=>f instanceof PDFLib.PDFSignature&&f.acroField.dict.get(PDFLib.PDFName.of('V'))))throw Error('XFA or signed PDFs need manual completion. Use an unsigned fillable original.');
  session.fields=form.getFields().filter(f=>f instanceof PDFLib.PDFTextField&&!OverSiteWordForms.isManual(f.getName())).map((f,i)=>({id:'pdf-'+i,label:f.getName(),context:f.getName(),profileKey:OverSiteWordForms.profileKey(f.getName()),existing:f.getText()||'',pdfField:f}));
 }
 for(const field of session.fields)session.answers[field.id]=field.existing||(field.profileKey?S.companyProfile?.[field.profileKey]:'')||'';
 creditFormSession=session;
 if(intakeDialog.open)intakeDialog.close();
 if(!session.fields.length){intakeModal('Form needs manual completion',`<p>No supported blank text fields were found. The original is stored in Credit apps and its extracted text is available for review. Flat/scanned PDFs need a fillable version.</p><a class="btn" href="https://drive.google.com/file/d/${encodeURIComponent(id)}/view" target="_blank" rel="noopener">Open original ↗</a>`);return;}
 showCreditQuestions();
 // Save fully answered forms immediately. Unknown answers are never invented.
 if(session.fields.every(f=>session.answers[f.id].trim()))await savePreparedCredit();
}
preparePdf=async function(id){return openCreditForm(id);};
function showCreditQuestions(){
 const s=creditFormSession,missing=s.fields.filter(f=>!s.answers[f.id].trim());
 intakeModal('Prepare form — '+s.source.name,`<p>${missing.length?'Please answer '+missing.length+' missing field'+(missing.length===1?'':'s')+'. Saved company details have been filled where the labels match.':'All detected fields have answers. Verify them before using the draft.'}</p><p class="mini">Existing wording and filled values are preserved. Signature, consent and ambiguous signing lines stay unchanged.</p>${s.saved?`<div class="notice">Draft saved in Credit apps. ${creditDraftLinks(s.saved)}</div>`:''}<div class="form-grid">${s.fields.map(f=>`<label class="field">${esc(f.label)}${s.answers[f.id]?'':' · answer needed'}<span class="mini">${esc(f.context)}</span><input data-form-answer="${esc(f.id)}" maxlength="1500" value="${esc(s.answers[f.id])}"></label>`).join('')}</div><p><button class="btn primary" data-form="save">Save answers and create download link</button></p><p class="mini">You may save an incomplete draft and return to the original to finish it. No agreement is signed or submitted.</p>`);
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
  await loadCreditDrafts();await documentChangedCloud();intakeDialog.close();showCreditQuestions();toast('Draft saved in Credit apps. The download link is ready.');
 }finally{s.busy=false;if(button){button.disabled=false;button.textContent='Save answers and create download link';}}
}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-form]');if(!t)return;try{if(t.dataset.form==='prepare')await openCreditForm(t.dataset.id);if(t.dataset.form==='save')await savePreparedCredit();if(t.dataset.form==='refresh')await loadCreditDrafts();}catch(error){toast(error.message);}});
document.addEventListener('input',e=>{if(e.target.dataset.formAnswer&&creditFormSession)creditFormSession.answers[e.target.dataset.formAnswer]=e.target.value;});
loadCreditDrafts();
