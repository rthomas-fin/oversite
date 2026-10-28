
/* Google bridge: same interface, shared Sheet, explicit private what-if mode.
   Google authorization stays in memory. No bank operations. */
window.OVERSITE_LOCAL_PREVIEW=document.body.dataset.localPreview==='true';
const CLOUD={ready:false,loading:true,refreshing:false,saving:false,dirty:false,conflict:false,authRequired:false,readOnly:false,mode:'shared',version:null,email:'',owner:false,timer:null,seq:0,shared:null,docs:[],docsError:'',message:'Connecting…'};
const BROWSER_POLLING=!!window.OverSiteTransport?.browserPolling;
let folderPoller=null,folderStatus='Folder checks have not started',folderPendingRender=false;
let cloudRefreshPending=false,cloudRefreshFolders=false,cloudUpdates=null;
let privateScenariosLoaded=false;
const scenarioStorageKey=()=> 'oversite-private-scenarios:'+CLOUD.email;
function savePrivateScenarios(){try{sessionStorage.setItem(scenarioStorageKey(),JSON.stringify({baseline:baselineV3,scenarios:scenariosV3}));}catch{toast('Private scenarios could not be retained in this tab. Export a backup before reloading.');}}
function loadPrivateScenarios(){if(privateScenariosLoaded)return;privateScenariosLoaded=true;try{const x=JSON.parse(sessionStorage.getItem(scenarioStorageKey())||'null');if(x?.baseline&&validState(x.baseline))baselineV3=x.baseline;if(Array.isArray(x?.scenarios))scenariosV3=x.scenarios.filter(s=>s&&validState(s.state));}catch{toast('Saved private scenarios could not be loaded. The shared plan is unchanged.');}}
const nativeRenderCloud=render;
const cloudBar=document.createElement('div');cloudBar.className='cloud-bar';cloudBar.id='cloud-bar';document.querySelector('header').after(cloudBar);
if(window.OVERSITE_LOCAL_PREVIEW){const banner=document.createElement('div');banner.className='migration-preview';banner.textContent='Local migration check · sample records · changes are not saved to Google';document.body.prepend(banner);}
function cloudPaint(){
 cloudBar.className='cloud-bar '+(CLOUD.conflict?'error':CLOUD.mode==='private'?'draft':'');
 const msg=CLOUD.conflict?CLOUD.message:CLOUD.readOnly?'Read-only connection check · edits stay private':CLOUD.saving?(window.OVERSITE_LOCAL_PREVIEW?'Saving to sample test session…':'Saving to shared Google Sheet…'):CLOUD.mode==='private'?'Private what-if — changes are not being posted':CLOUD.dirty?'Unsaved changes — waiting to save':CLOUD.message;
 cloudBar.innerHTML=`<strong>${esc(msg)}</strong><span class="cloud-meta">${esc(CLOUD.email)}</span><button data-cloud="mode">${CLOUD.mode==='shared'?'Test privately':'Return to shared'}</button>${CLOUD.mode==='private'?'<button data-cloud="apply">Apply to shared plan</button>':'<button data-cloud="save">Save now</button>'}<button data-cloud="reload">Reload shared</button>`;
 if(CLOUD.readOnly)cloudBar.querySelectorAll('[data-cloud=apply],[data-cloud=save]').forEach(b=>{b.disabled=true;b.title='Shared saving is disabled during verification.';});
 const label=document.querySelector('.local-indicator');if(label)label.textContent=CLOUD.ready?(window.OVERSITE_LOCAL_PREVIEW?'Local test session':'Google ledger connected'):'Google connection pending';
 const foot=document.querySelector('.sidebar-foot p');if(foot)foot.innerHTML='Shared working records in Google Sheets.<br>Private what-ifs require Apply to share.';
 const band=document.querySelector('.preview-band span');if(band)band.textContent='Planning system · No live bank feed or automatic payments. Original documents are not rewritten.';
}
render=function(){nativeRenderCloud();cloudPaint();};
async function rpcCloud(name,...args){
 if(window.OverSiteTransport)return window.OverSiteTransport.call(name,...args);
 const r=await fetch('/api/'+encodeURIComponent(name),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-OverSite-Request':'1'},body:JSON.stringify({args})});
 if(r.redirected||!r.headers.get('content-type')?.includes('application/json'))throw Error('Your sign-in expired. Export unsaved work, then reload to sign in.');
 const data=await r.json();if(!r.ok)throw Error(data.error||'The request could not be completed.');return data;
}
function normalizeCloudState(state){S=state;initV3();committedV3=deep(S);undoStates=[];v3Redo=[];v3LastChange=null;v3Cached=null;}
function receiveCloud(r){CLOUD.loading=true;normalizeCloudState(r.state);CLOUD.version=r.version;CLOUD.shared=deep(S);CLOUD.email=r.email;CLOUD.owner=r.owner;CLOUD.ready=true;CLOUD.dirty=false;CLOUD.conflict=false;CLOUD.message=window.OVERSITE_LOCAL_PREVIEW?'Local migration check · sample records only':'Saved in Google · website changes save automatically';CLOUD.loading=false;scenarioName='Shared working plan';render();document.getElementById('cloud-wait')?.remove();document.documentElement.classList.remove('cloud-loading');}
// All existing editors, date moves, splits, toggles and Undo call this same hook.
// Defer only until this edit's synchronous handlers finish, including source metadata.
persistV3=function(){if(CLOUD.loading)return;if(CLOUD.ready)savePrivateScenarios();CLOUD.seq++;CLOUD.dirty=true;clearTimeout(CLOUD.timer);if(CLOUD.ready&&!CLOUD.readOnly&&CLOUD.mode==='shared'&&!CLOUD.conflict)CLOUD.timer=setTimeout(saveCloud,0);cloudPaint();};
function notifyCloudChanged(folders=false){try{cloudUpdates?.postMessage({type:'workspace-changed',email:CLOUD.email,folders});}catch{}}
function requestCloudRefresh(folders=false){cloudRefreshPending=true;cloudRefreshFolders=cloudRefreshFolders||folders;return refreshCloud(false);}
function documentChangedCloud(){notifyCloudChanged(true);return requestCloudRefresh(true);}
try{if(window.BroadcastChannel){cloudUpdates=new window.BroadcastChannel('oversite-workspace:'+String(window.OverSiteConnection?.deploymentId||'local'));cloudUpdates.onmessage=e=>{if(e.data?.type==='workspace-changed'&&e.data.email===CLOUD.email)requestCloudRefresh(!!e.data.folders);};}}catch{}
async function saveCloud(){
 if(!CLOUD.ready||CLOUD.readOnly||CLOUD.authRequired||CLOUD.mode!=='shared'||CLOUD.conflict||CLOUD.saving||!CLOUD.dirty)return;
 CLOUD.saving=true;const seq=CLOUD.seq,snapshot=deep(S);cloudPaint();
 try{const r=await rpcCloud('saveWorkspace',{version:CLOUD.version,state:snapshot,mutationId:'ui-'+Date.now()+'-'+Math.random().toString(36).slice(2)});
 if(r.conflict){CLOUD.conflict=true;CLOUD.message=r.message;toast(r.message);return;}
 CLOUD.version=r.version;CLOUD.shared=deep(r.state);if(CLOUD.seq===seq){CLOUD.loading=true;S=r.state;initV3();committedV3=deep(S);CLOUD.loading=false;CLOUD.dirty=false;}
 CLOUD.message=(window.OVERSITE_LOCAL_PREVIEW?'Saved to local test session at ':'Saved to Google at ')+new Date().toLocaleTimeString();
 notifyCloudChanged();
 }catch(e){CLOUD.authRequired=!!e.authRequired;CLOUD.conflict=!e.authRequired;CLOUD.message='Save paused: '+e.message;toast(CLOUD.message+' Your on-screen changes are retained; export a backup.');}
 finally{CLOUD.saving=false;cloudPaint();if(CLOUD.dirty&&!CLOUD.conflict&&!CLOUD.authRequired&&CLOUD.mode==='shared')CLOUD.timer=setTimeout(saveCloud,0);else if(cloudRefreshPending&&!CLOUD.dirty&&!CLOUD.conflict)void refreshCloud(false);}
}
async function refreshCloud(force=false){
 if(CLOUD.loading||CLOUD.refreshing||CLOUD.saving||CLOUD.authRequired)return;
 if(!force&&(CLOUD.dirty||(CLOUD.mode==='private'&&!CLOUD.readOnly)||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,select')))return;
 if(force&&CLOUD.dirty&&!confirm('Discard unsaved/private edits and load the shared plan? Export a backup first to preserve them.'))return;
 CLOUD.refreshing=true;const startSeq=CLOUD.seq,startMode=CLOUD.mode,folders=cloudRefreshFolders||['files','credit'].includes(page);let failed=false;
 cloudRefreshPending=false;cloudRefreshFolders=false;
 try{const r=await rpcCloud('getWorkspace');if(CLOUD.seq!==startSeq||CLOUD.mode!==startMode||CLOUD.saving||(!force&&!safeFolderRender())){cloudRefreshPending=true;cloudRefreshFolders=cloudRefreshFolders||folders;return;}if(force||!CLOUD.ready||CLOUD.version!==r.version||CLOUD.readOnly!==!!r.readOnly){CLOUD.mode='shared';receiveCloud(r);}else if(CLOUD.message.startsWith('Connection error:')){CLOUD.message='Saved in Google - website changes save automatically';cloudPaint();}if(CLOUD.ready&&folders){const d=await rpcCloud('getFolderInbox');if(CLOUD.seq===startSeq&&JSON.stringify(d.items)!==JSON.stringify(CLOUD.docs)){CLOUD.docs=d.items;if(safeFolderRender())render();else folderPendingRender=true;}}}
 catch(e){failed=true;cloudRefreshPending=true;cloudRefreshFolders=cloudRefreshFolders||folders;CLOUD.authRequired=!!e.authRequired;CLOUD.message='Connection error: '+e.message;cloudPaint();const w=document.getElementById('cloud-wait');if(w){w.innerHTML='<div style="max-width:650px;padding:30px"><h2>OverSite connection needs attention</h2><p>'+esc(e.message)+'</p><p>Your records have not been changed. Reload to refresh your sign-in; contact the workspace owner if the problem continues.</p><a href="./">Try again</a></div>';}}
 finally{CLOUD.refreshing=false;if(cloudRefreshPending&&!failed&&CLOUD.mode==='shared'&&safeFolderRender())setTimeout(()=>{if(cloudRefreshPending)void refreshCloud(false);},0);}
}
function enterPrivateCloud(){clearTimeout(CLOUD.timer);CLOUD.mode='private';scenarioName='Private what-if';CLOUD.dirty=false;cloudPaint();}
// Loading an older backup or scenario must not overwrite the shared plan automatically.
document.addEventListener('click',e=>{const b=e.target.closest('[data-v3],[data-action]');if(!b)return;const a=b.dataset.v3||b.dataset.action;if(['load-scenario','load-baseline','import','reset'].includes(a)){if(CLOUD.saving){e.preventDefault();e.stopImmediatePropagation();toast('Wait until the shared save finishes.');return;}enterPrivateCloud();}},true);
document.addEventListener('click',async e=>{const t=e.target.closest('[data-cloud]');if(!t)return;try{
 const a=t.dataset.cloud;
 if(a==='save')await saveCloud();
 if(a==='reload')await refreshCloud(true);
 if(a==='mode'){if(CLOUD.saving)return toast('Wait for the current save.');if(CLOUD.mode==='shared'){if(CLOUD.dirty)await saveCloud();if(CLOUD.conflict)return;enterPrivateCloud();render();}else await refreshCloud(true);}
 if(a==='apply'){if(CLOUD.saving)return;if(!confirm('Apply this scenario to the shared working plan? This updates the shared ledger and payment plan, not original invoices, and sends NO payments.'))return;const r=await rpcCloud('getWorkspace');if(r.version!==CLOUD.version){CLOUD.conflict=true;cloudPaint();return toast('Shared data changed since you started. Export this scenario and reload before applying.');}CLOUD.mode='shared';CLOUD.dirty=true;CLOUD.seq++;scenarioName='Shared working plan';await saveCloud();render();}
 if(a==='scan'){if(folderPoller){await folderPoller.check(true);}else{CLOUD.docsError='';toast('Checking the registered Google Drive folders…');const r=await rpcCloud('scanFolders');CLOUD.docs=r.items;CLOUD.docsError=(r.errors||[]).join('; ');render();toast(r.changed+' new or changed files. Nothing posted to AR, AP or cash.');}}
 if(a==='toggle-polling'&&folderPoller){folderPoller.enabled?folderPoller.stop():folderPoller.start();render();}
 if(a==='enable-checks'){const r=await rpcCloud('enableFolderChecks');toast('Automatic folder checks enabled for approximately every '+r.intervalMinutes+' minutes. Review results in Folder inbox.');}
 if(a==='read-doc')await importCloudDocument(t.dataset.id);
 }catch(err){CLOUD.docsError=err.message;toast(err.message);cloudPaint();}});
function driveInboxCloud(bucket){const docs=CLOUD.docs.filter(r=>!bucket||r[1]===bucket);return `<section class="panel section-gap"><div class="panel-head"><div><h2>Google Drive folder inbox</h2><p class="sub">${docs.length} indexed files · originals stay in Drive · processing results below</p></div><div class="actions"><button class="btn" data-cloud="scan">Refresh folders</button>${CLOUD.owner?'<button class="btn small" data-cloud="enable-checks">Enable 15-minute checks</button>':''}</div></div>${CLOUD.docsError?'<div class="notice red-notice">'+esc(CLOUD.docsError)+'</div>':''}<div class="cloud-wrap"><table class="cloud-inbox"><thead><tr><th>Folder / document</th><th>Source changed</th><th>Processing</th><th>Actions</th></tr></thead><tbody>${docs.map(r=>`<tr><td><b>${esc(r[2])}</b><span class="mini">${esc(r[1])}</span></td><td>${esc(String(r[3]).slice(0,10))}</td><td>${esc(r[6])}</td><td><a class="btn small" target="_blank" rel="noopener" href="${esc(r[4])}">Original ↗</a> ${['AR','AP','Credit apps'].includes(r[1])?`<button class="btn small" data-cloud="read-doc" data-id="${esc(r[0])}">Bring into review</button>`:'<span class="mini">Enter verified expense/loan terms on its work page</span>'}</td></tr>`).join('')||'<tr><td colspan="4" class="cloud-empty">Click Refresh folders to discover existing files. Automatic checks are optional and must be enabled by the owner.</td></tr>'}</tbody></table></div><div class="cloud-setup-note">CSV, TSV, plain text and Google Docs can supply review text. PDFs, scans and Excel files are linked and flagged for manual extraction; this release does not claim to read them automatically. Extracted values are never posted without review. Older revisions stay in the review history.</div></section>`;}
const legacyFilesCloud=filesScreenV3;
filesScreenV3=function(){const holder=document.createElement('div');holder.innerHTML=legacyFilesCloud();const queue=holder.querySelector('.intake-table')?.closest('.panel')?.outerHTML||'';return title('Files & folders','Your private Drive folders feed the review queue. The shared ledger drives cash and runway.',`<a class="btn" href="${esc(S.root)}" target="_blank" rel="noopener">Open workspace ↗</a>`)+folderCards()+driveInboxCloud()+queue+`<div class="notice">Use Google Drive to add original documents. To update the ledger directly, use AR, AP, Expenses, or the shared Sheet. Reviewing a document does not make it paid or authorize credit.</div>`;};
const legacyCreditCloud=creditScreenV3;
creditScreenV3=function(){let html=legacyCreditCloud();html=html.replace(/Local review queue/g,'Shared review queue').replace(/No local applications yet\./g,'No applications in the shared review queue yet.').replace(/Google Drive folder created\. Hourly application-review checks are scheduled in ChatGPT\./g,'Credit apps folder connected through the folder inbox.').replace(/The local interface below does not scan Drive or synchronize review results\./g,'Use Refresh folders below and Bring into review. Reviewed application records save with the shared plan.');return html+driveInboxCloud('Credit apps');};
async function importCloudDocument(id){
 const r=await rpcCloud('readFolderDocument',id),fp='drive:'+r.fileId+':'+r.modified;if(S.intake.some(x=>x.fingerprint===fp||String(x.fingerprint||'').startsWith(fp+'|')))return toast('This document revision is already in the review queue.');
 const common={filename:r.filename,bucket:r.bucket,sourceUrl:r.url,driveFileId:r.fileId,sourceModified:r.modified,fingerprint:fp,party:'',invoice:'',amount:0,date:'',expected:'',note:'Google Drive source. Verify every extracted field. Original is unchanged.'};
 let records=[];
 if(r.bucket==='Credit apps')records=[{...common,status:r.text===null?'Needs extraction':'Needs information',creditFields:r.text===null?[]:CREDIT_FIELDS_V3.filter(([label,re])=>re.test(r.text)).map(([label])=>label)}];
 else if(r.text===null)records=[{...common,status:'Needs extraction',note:r.note}];
 else records=parseDoc(r.text,r.filename.toLowerCase()).map((x,i)=>({...common,...x,fingerprint:fp+'|'+i,amount:Number.isSafeInteger(x.amount)?x.amount:0,status:'Needs review'}));
 if(!records.length)records=[{...common,status:'Needs extraction',note:'No invoice fields could be extracted. Open the original and enter verified values.'}];
 for(let i=0;i<records.length;i++){const x=records[i],dest=r.bucket==='AR'?'ar':'ap';x.id='drive-review-'+Date.now()+'-'+i;if(x.invoice&&S[dest].some(a=>a.invoice.toLowerCase()===x.invoice.toLowerCase()&&(a.customer||a.vendor).toLowerCase()===(x.party||'').toLowerCase()))x.status='Duplicate';S.intake.push(x);}
 save('Added '+records.length+' Drive document records to review; no financial posting');toast('Document is in the shared review queue. Check source amounts and dates before posting.');render();
}
window.addEventListener('beforeunload',e=>{if(CLOUD.dirty||CLOUD.saving){e.preventDefault();e.returnValue='Unsaved changes';}});
window.OverSiteCloud={status:()=>({...CLOUD,shared:undefined,docs:undefined}),refresh:()=>refreshCloud(true),save:saveCloud};
(async()=>{CLOUD.loading=false;await refreshCloud(true);if(CLOUD.ready){try{const r=await rpcCloud('getFolderInbox');CLOUD.docs=r.items;}catch(e){CLOUD.docsError=e.message;}render();if(BROWSER_POLLING)startFolderPolling();}setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)refreshCloud(false);},30000);})();

const receiveCloudBase=receiveCloud;receiveCloud=function(r){CLOUD.readOnly=!!r.readOnly;receiveCloudBase(r);loadPrivateScenarios();if(CLOUD.readOnly){CLOUD.mode='private';scenarioName='Private verification';}render();document.body.classList.remove('cloud-loading');};

function safeFolderRender(){return !CLOUD.dirty&&!CLOUD.saving&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,select');}
function paintFolderStatus(){document.querySelectorAll('[data-folder-poll-status]').forEach(el=>{el.textContent=folderStatus;});}
function startFolderPolling(){
 if(folderPoller||!window.OverSiteDrivePoller)return;
 folderPoller=new window.OverSiteDrivePoller({
  scan:()=>rpcCloud('scanFolders'),
  canRun:()=>CLOUD.ready&&!CLOUD.saving&&!CLOUD.authRequired&&!window.OverSiteTransport.needsAuth()&&navigator.onLine&&document.visibilityState==='visible',
  onResult:r=>{const changed=JSON.stringify(r.items)!==JSON.stringify(CLOUD.docs);CLOUD.docs=r.items||[];CLOUD.docsError=(r.errors||[]).join('; ');if(changed){if(['files','credit'].includes(page)&&safeFolderRender())render();else folderPendingRender=true;}if(r.queued>0)void documentChangedCloud();},
  onStatus:s=>{folderStatus=s.message+(s.lastChecked?' · Last checked '+new Date(s.lastChecked).toLocaleTimeString():'')+(s.error?' · '+s.error:'');paintFolderStatus();}
 });
 folderPoller.start();
}
const originalDriveInboxCloud=driveInboxCloud;
driveInboxCloud=function(bucket){
 let html=originalDriveInboxCloud(bucket);
 if(!BROWSER_POLLING)return html;
 html=html.replace(/<button class="btn small" data-cloud="enable-checks">.*?<\/button>/,'<button class="btn small" data-cloud="toggle-polling">'+(folderPoller?.enabled?'Pause checks':'Resume checks')+'</button>');
 html=html.replace('Automatic checks are optional and must be enabled by the owner.','The dashboard checks while this tab is active.');
 return html+'<p class="cloud-setup-note" data-folder-poll-status>'+esc(folderStatus)+'</p>';
};
document.addEventListener('oversite-auth-required',()=>{CLOUD.authRequired=true;clearTimeout(CLOUD.timer);cloudPaint();});
document.addEventListener('oversite-auth-ready',async()=>{CLOUD.authRequired=false;if(CLOUD.dirty)await saveCloud();else await refreshCloud(false);if(CLOUD.ready)startFolderPolling();folderPoller?.wake();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){folderPoller?.wake();refreshCloud(false);}});
window.addEventListener('online',()=>{folderPoller?.wake();refreshCloud(false);});
function settleCloudView(){setTimeout(()=>{if(cloudRefreshPending)void refreshCloud(false);if(folderPendingRender&&safeFolderRender()){folderPendingRender=false;render();}},0);}
document.addEventListener('focusout',settleCloudView);
document.addEventListener('close',settleCloudView,true);
