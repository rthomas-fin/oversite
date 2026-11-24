/* Private form preparation: verified profile -> questions -> saved Drive draft. */
let creditFormSession=null,creditDraftItems=[],creditDraftProblem='',creditDraftLoaded=false,creditDraftLoading=null;
function formAnswerRecord(source){const r=S.companyProfile?.formAnswers?.[source.id];return r?.sourceModified===source.modified?r:null;}
function personFormAnswer(label,person){
 if(!person)return '';
 const key=String(label).toLowerCase().replace(/[^a-z]/g,'');
 const aliases={name:['coapplicantfulllegalname','coapplicantprintedname','principaloperatorname'],preferredName:['coapplicantpreferredfirstname'],birthDate:['coapplicantdateofbirth'],email:['coapplicantemail'],homeAddress:['principaloperatorhomeaddress','coapplicantresidenceaddress'],garagingAddress:['vehiclegaragingaddress'],driverLicense:['driverslicensenumber'],driverLicenseState:['driverslicensestate'],title:['principaloperatorposition','coapplicantoccupation'],employmentYears:['principaloperatoryearsassociated','coapplicantemploymenttenure'],residenceYears:['coapplicantresidencetenure'],grossMonthlyIncome:['coapplicantmonthlygrossincome'],ownershipPercent:['ownerorofficer1ownershippercentage']};
 const match=Object.keys(aliases).find(k=>aliases[k].includes(key));
 if(match==='birthDate'&&/^\d{4}-\d{2}-\d{2}$/.test(person[match]||'')){const [y,m,d]=person[match].split('-');return m+'/'+d+'/'+y;}
 return match?String(person[match]??''):'';
}
function rememberedFormAnswer(field,source,personId){
 const record=formAnswerRecord(source);
 if(record&&Object.prototype.hasOwnProperty.call(record.answers||{},field.label))return String(record.answers[field.label]??'');
 const company=field.profileKey?S.companyProfile?.[field.profileKey]:'';
 return typeof company==='string'&&company?company:personFormAnswer(field.label,S.companyProfile?.people?.[personId]);
}
function rememberFormAnswers(session){
 const previous=S.companyProfile?.formAnswers?.[session.source.id]||{};
 const answers={...(previous.answers||{})};
 for(const field of session.fields)answers[field.label]=String(session.answers[field.id]??'');
 S.companyProfile={...S.companyProfile,formAnswers:{...S.companyProfile?.formAnswers,[session.source.id]:{...previous,name:session.source.name,sourceModified:session.source.modified,draftId:session.saved.id,personId:session.personId||previous.personId||'',confirmedAt:new Date().toISOString(),answers}}};
}
function savedFormMemory(){
 const p=S.companyProfile||{},people=Object.values(p.people||{}),forms=Object.values(p.formAnswers||{});
 const labels={name:'Legal name',preferredName:'Preferred name',title:'Position',email:'Email',phone:'Phone',ownershipPercent:'Ownership',birthDate:'Date of birth',driverLicense:'Driver’s license number',driverLicenseState:'License state',homeAddress:'Home address',garagingAddress:'Vehicle garaging address',residenceYears:'Years at this address',employmentYears:'Years with the company',grossMonthlyIncome:'Gross monthly income (USD)',housingStatus:'Home ownership',repossession:'Repossession history',pendingLawsuit:'Pending lawsuit',bankruptcyTenYears:'Bankruptcy in the last 10 years',toyotaCustomer:'Toyota Financial Services customer',confirmedAt:'Last confirmed'};
 const entries=obj=>Object.entries(obj).map(([key,value])=>`<tr><td>${esc(labels[key]||key)}</td><td>${esc(String(value??'')||'Not answered')}</td></tr>`).join('');
 intakeModal('Saved company, people and application answers',`<p>Stored in your private shared Google Sheet. Personal answers stay associated with the named person and application. Blank fields remain unanswered.</p>${people.map(person=>`<details open><summary>${esc(person.name||'Saved person')}</summary><table><tbody>${entries(person)}</tbody></table></details>`).join('')}${forms.map(form=>`<details><summary>${esc(form.name)} · ${Object.values(form.answers||{}).filter(v=>String(v??'').trim()).length} saved answers</summary><p>Confirmed ${esc(String(form.confirmedAt||'').slice(0,10))}. Open this form to change its answers.</p><table><tbody>${entries(form.answers||{})}</tbody></table></details>`).join('')||'<p>No application answers saved yet.</p>'}`);
}
function formPersonPicker(session){
 const people=Object.entries(S.companyProfile?.people||{});if(!people.length)return '';
 return `<label class="field">Person named on this application<select data-form-person><option value="">Choose a saved person if needed</option>${people.map(([id,p])=>`<option value="${esc(id)}" ${id===session.personId?'selected':''}>${esc(p.name)}</option>`).join('')}</select><span class="mini">Fills matching empty personal fields. Existing answers stay unchanged.</span></label>`;
}
function formBytes64(bytes){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);}
function creditSourceName(name){return String(name||'').replace(/ - (?:draft|customer signed)(\.(?:docx|pdf))$/i,'$1').toLowerCase();}
function savedCreditCopies(){
 const copies=new Map(creditDraftItems.map(f=>[f.id,f]));
 // The shared intake arrives before the folder index during sign-in.
 const inventory=new Map();
 for(const f of S.intake||[])if(f.status!=='Archived'&&f.driveFileId){const row=[f.driveFileId,f.bucket,f.filename,f.sourceModified,f.sourceUrl];if(!inventory.has(f.driveFileId)||String(row[3])>String(inventory.get(f.driveFileId)[3]))inventory.set(f.driveFileId,row);}
 for(const r of CLOUD.docs||[])inventory.set(r[0],r);
 for(const r of inventory.values()){
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
 creditDraftLoading=(async()=>{try{const r=await rpcCloud('getCreditDrafts');creditDraftItems=r.items||[];creditDraftProblem='';}catch(e){creditDraftProblem=e.message;}finally{creditDraftLoaded=true;creditDraftLoading=null;}if(!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,select')&&(typeof CLOUD==='undefined'||(!CLOUD.dirty&&!CLOUD.saving)))render();document.dispatchEvent(new Event('oversite-form-drafts-updated'));})();
 return creditDraftLoading;
}
function savedCreditDrafts(){
 const latest=new Map(),earlier=[];for(const f of savedCreditCopies().sort((a,b)=>String(b.modified).localeCompare(String(a.modified)))){const key=f.sourceId||f.id;if(latest.has(key))earlier.push(f);else latest.set(key,f);}
 const row=(f,old=false)=>`<p><b>${esc(f.name)}</b><span class="mini">${old?'Earlier copy · ':''}${f.customerSigned?'Customer-signed copy':(f.remaining?f.remaining+' blank fields (review if applicable)':'Filled draft saved')+' · Unsigned'} · ${esc(f.modified?new Date(f.modified).toLocaleString():'')}</span>${creditDraftLinks(f)}</p>`;
 return `<section class="panel section-gap"><div class="panel-head"><div><h2>Saved forms</h2><p class="sub">The latest saved copy for each form is shown first. Customer-signed copies are labeled separately from unsigned drafts.</p></div><button class="btn" data-form="refresh">Refresh drafts</button></div><div class="panel-body">${creditDraftProblem?`<p class="notice">${esc(creditDraftProblem)}</p>`:''}${!creditDraftLoaded?'Checking saved drafts…':latest.size?[...latest.values()].map(f=>row(f)).join(''):'No saved draft found. Use Fill original form to prepare a Word .docx or fillable PDF.'}${earlier.length?`<details><summary>Earlier copies (${earlier.length})</summary>${earlier.map(f=>row(f,true)).join('')}</details>`:''}</div></section>`;
}
const inboxBeforeForms=driveInboxCloud;
driveInboxCloud=function(bucket){const holder=document.createElement('div');holder.innerHTML=inboxBeforeForms(bucket);for(const row of holder.querySelectorAll('tbody tr')){const action=row.querySelector('[data-cloud="read-doc"]'),copy=action&&savedCreditCopies().find(f=>f.id===action.dataset.id);if(copy){row.children[2].textContent=copy.customerSigned?'Customer-signed copy':'Saved form draft';action.remove();}}return holder.innerHTML;};
const filesWithIntake=filesScreenV3,creditWithIntake=creditScreenV3,queueWithIntake=reviewQueueIntake;
filesScreenV3=function(){return filesWithIntake()+savedCreditDrafts();};
creditScreenV3=function(){const holder=document.createElement('div');holder.innerHTML=creditWithIntake();for(const button of holder.querySelectorAll('[data-intake="fill-pdf"]')){const copy=savedCreditCopies().find(f=>f.customerSigned&&f.id===button.dataset.id);if(copy){button.insertAdjacentHTML('beforebegin',creditDraftLinks(copy));button.remove();}}return holder.innerHTML+'<p><button class="btn" data-form="memory">Saved people & application answers</button></p>'+savedCreditDrafts();};
reviewQueueIntake=function(){const holder=document.createElement('div');holder.innerHTML=queueWithIntake();for(const row of holder.querySelectorAll('tbody tr')){const id=row.querySelector('[data-intake="details"]')?.dataset.id,x=S.intake.find(r=>r.id===id);if(x?.bucket==='Credit apps'&&x.driveFileId&&/\.(?:docx|pdf)$/i.test(x.filename)){for(const action of row.querySelectorAll('[data-intake="details"],[data-intake="fill-pdf"],[data-burn="review-file"]'))action.remove();row.lastElementChild.insertAdjacentHTML('afterbegin',`<button class="btn small primary" data-form="prepare" data-id="${esc(x.driveFileId)}">Fill original form</button>`);}}return holder.innerHTML;};
profileFields.push(['entityDescription','Registered entity description (for example: Texas limited liability company)'],['formationState','State of formation'],['noticeDetails','Legal notice address, contact name and email'],['ceoName','CEO name'],['ceoEmail','CEO email'],['defaultEffectiveDate','Effective date for new forms'],['signatoryName','Authorized representative — printed name'],['signatoryTitle','Authorized representative — title'],['signatureDriveUrl','Saved signature image — private Google Drive link']);
profileFields.push(['ein','Business EIN'],['website','Business website'],['formationYear','Formation year (if exact date is unknown)'],['businessDescription','Business description'],['businessStreet','Business street'],['businessCity','Business city'],['businessState','Business state'],['businessZip','Business ZIP'],['bankName','Business bank'],['bankBranch','Bank branch'],['bankContact','Bank contact'],['bankPhone','Bank contact phone'],['financialYear','Year of saved financial figures'],['grossRevenue','Gross revenue for that year (USD)']);
async function openCreditForm(id){
 await intakeReady();toast('Reading the form and matching saved company details…');
 const source=await rpcCloud('getCreditForm',id),bytes=Uint8Array.from(atob(source.data),c=>c.charCodeAt(0));
 const record=formAnswerRecord(source);
 const session={source,answers:{},fields:[],word:null,pdf:null,saved:null,busy:false,personId:record?.personId||''};
 if(/\.docx$/i.test(source.name)){
  session.word=OverSiteWordForms.open(bytes);session.fields=session.word.fields.filter(f=>!f.manual);
 }else{
  session.pdf=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false});let form=session.pdf.getForm();
  // A previously prepared flat form can be resumed without replacing the original.
  if(!form.getFields().length&&record?.draftId){
   await loadCreditDrafts();const draft=creditDraftItems.find(f=>f.id===record.draftId&&f.sourceId===source.id&&!f.customerSigned);
   if(draft){const prepared=await rpcCloud('getCreditForm',draft.id);session.pdf=await PDFLib.PDFDocument.load(Uint8Array.from(atob(prepared.data),c=>c.charCodeAt(0)),{updateMetadata:false});form=session.pdf.getForm();session.saved=draft;}
  }
  if(form.hasXFA()||form.getFields().some(f=>f instanceof PDFLib.PDFSignature&&f.acroField.dict.get(PDFLib.PDFName.of('V'))))throw Error('XFA or signed PDFs need manual completion. Use an unsigned fillable original.');
  session.fields=form.getFields().filter(f=>f instanceof PDFLib.PDFTextField&&!OverSiteWordForms.isManual(f.getName())).map((f,i)=>({id:'pdf-'+i,label:f.getName(),context:f.getName(),profileKey:OverSiteWordForms.profileKey(f.getName()),existing:f.getText()||'',pdfField:f}));
 }
 for(const field of session.fields){const known=rememberedFormAnswer(field,source,session.personId);session.answers[field.id]=(field.replaceFromProfile?known||field.existing:field.existing||known)||'';if(!session.answers[field.id]&&/^effective\s*date$/i.test(field.label)&&S.companyProfile?.defaultEffectiveDate==='current'){const now=new Date();session.answers[field.id]=now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}}
 session.initialAnswers={...session.answers};
 creditFormSession=session;
 if(intakeDialog.open)intakeDialog.close();
 if(!session.fields.length){intakeModal('Form needs manual completion',`<p>No supported blank text fields were found. The original is stored in Credit apps. Flat/scanned PDFs need a fillable version.</p><a class="btn" href="https://drive.google.com/file/d/${encodeURIComponent(id)}/view" target="_blank" rel="noopener">Open original ↗</a>`);return;}
 showCreditQuestions();
 // Save fully answered forms immediately. Unknown answers are never invented.
 if(!session.saved&&session.fields.every(f=>session.answers[f.id].trim()))await savePreparedCredit();
}
preparePdf=async function(id){return openCreditForm(id);};
function showCreditQuestions(){
 const s=creditFormSession,missing=s.fields.filter(f=>!s.answers[f.id].trim());
 intakeModal('Fill original form — '+s.source.name,`<p>${missing.length?missing.length+' blank field'+(missing.length===1?'':'s')+' remain. Some may be optional or not applicable. Saved company details have been filled where the labels match.':'The detected text fields have answers. Verify them before using the draft.'}</p><p class="mini">Answers go into the original document format. All answers you enter are remembered for this application when you save; matched company details are also reusable. Identified customer names use your saved legal business name; contract terms stay unchanged.</p>${s.saved?`<div class="notice">${missing.length?'Incomplete draft':'Draft'} saved in Credit apps. ${creditDraftLinks(s.saved)}</div>`:''}${formPersonPicker(s)}<div class="form-grid">${s.fields.map(f=>`<label class="field">${esc(f.label)}${s.answers[f.id]?'':' · blank'}<span class="mini">${esc(f.context)}</span>${f.multiline?`<textarea data-form-answer="${esc(f.id)}" maxlength="1500" rows="4">${esc(s.answers[f.id])}</textarea>`:`<input data-form-answer="${esc(f.id)}" maxlength="1500" value="${esc(s.answers[f.id])}">`}</label>`).join('')}</div><p><button class="btn primary" data-form="save">Fill document and save download link</button></p><p class="mini">${s.word?.manual.length?'Signature or ambiguous signing areas also remain for manual completion. ':''}You may save an incomplete draft. Nothing is signed or submitted.</p>`);
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
  S.companyProfile={...S.companyProfile,...verified};rememberFormAnswers(s);save('Remembered company and application answers');await saveCloud();
  if(typeof CLOUD!=='undefined'&&(CLOUD.dirty||CLOUD.conflict))throw Error('The PDF is saved, but its answers still need to sync. Resolve the shared save before leaving this form.');
  await loadCreditDrafts();await documentChangedCloud();intakeDialog.close();showCreditQuestions();toast('Draft saved in Credit apps. The download link is ready.');
 }finally{s.busy=false;if(button){button.disabled=false;button.textContent='Fill document and save download link';}}
}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-form]');if(!t)return;try{if(t.dataset.form==='prepare')await openCreditForm(t.dataset.id);if(t.dataset.form==='save')await savePreparedCredit();if(t.dataset.form==='refresh')await loadCreditDrafts();if(t.dataset.form==='memory')savedFormMemory();}catch(error){toast(error.message);}});
document.addEventListener('input',e=>{if(e.target.dataset.formAnswer&&creditFormSession)creditFormSession.answers[e.target.dataset.formAnswer]=e.target.value;});
document.addEventListener('change',e=>{if(!e.target.matches?.('[data-form-person]')||!creditFormSession)return;const s=creditFormSession;s.personId=e.target.value;for(const field of s.fields)if(!s.answers[field.id])s.answers[field.id]=personFormAnswer(field.label,S.companyProfile?.people?.[s.personId]);intakeDialog.close();showCreditQuestions();});
document.addEventListener('oversite-auth-ready',()=>loadCreditDrafts());
function refreshCreditResults(){
 if(typeof CLOUD==='undefined'||!CLOUD.ready||CLOUD.authRequired||document.visibilityState!=='visible'||(typeof navigator!=='undefined'&&!navigator.onLine))return;
 return loadCreditDrafts();
}
document.addEventListener('visibilitychange',refreshCreditResults);
document.addEventListener('oversite-folders-checked',refreshCreditResults);
if(typeof setInterval==='function')setInterval(refreshCreditResults,60000);
loadCreditDrafts();
