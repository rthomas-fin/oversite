(function(){
 'use strict';
 const config=window.OverSiteConnection,gate=document.getElementById('cloud-wait');
 const assetVersion=document.currentScript?new URL(document.currentScript.src).search:'';
 let client,transport,loaded=false,loading=false,bootStarted=false,activeEmail='';
 let tabSession=null,authPending=null,resolveAuth=null,quietAttempt=false,retryAfter=0,signOutButton;
 const accountKey='OverSite:account:'+config?.clientId+':'+config?.deploymentId;
 let accountHint='';try{accountHint=sessionStorage.getItem(accountKey)||'';}catch{}
 if(config?.rememberTabSession){try{tabSession=new window.OverSiteTabSession({storage:sessionStorage,key:'OverSite:auth:'+config.clientId+':'+config.deploymentId+':'+config.scopes.join(',')});}catch{}}
 const make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 function showGate(message,enabled=true){
  const box=make('section','');box.className='google-signin';
  box.append(make('h1','OverSite Financial Command Center'),make('p',message));
  const button=make('button','Sign in with Google');button.className='btn primary';button.disabled=!enabled;button.onclick=connect;
  box.append(button,make('p','Your financial records are loaded from your private Google Sheet after sign-in.'));
  if(enabled){const other=make('button','Use another Google account');other.className='btn';other.onclick=()=>{transport?.clearToken();tabSession?.clear();accountHint='';try{sessionStorage.removeItem(accountKey);}catch{}requestGoogle(false,true);};box.append(other);}
  box.append(make('p','OverSite organizes receivables, bills, cash plans and documents using your connected Google workspace.'));
  const links=make('nav','');links.setAttribute('aria-label','Workspace information');for(const [label,url] of [['Privacy','./privacy.html'],['Terms of use','./terms.html']]){const a=make('a',label);a.href=url;a.style.marginRight='18px';links.append(a);}box.append(links);
  gate.replaceChildren(box);
 }
 const strip=make('div','');strip.className='google-reconnect';strip.hidden=true;
 const reconnect=make('button','Reconnect Google');reconnect.className='btn';reconnect.onclick=connect;
 const note=make('span','');strip.append(note,reconnect);document.body.prepend(strip);
 function authRequired(message='Google connection paused. It will reconnect when you next use the dashboard, or choose Reconnect Google.'){
  tabSession?.clear();
  if(loaded){strip.hidden=false;note.textContent=message;document.dispatchEvent(new Event('oversite-auth-required'));}
  else showGate(message);
 }
 function connectionFailed(error){
  if(/ACCESS_DENIED|OWNER_ONLY|PERMISSION_DENIED|does not have permission/i.test(error.message)){transport.clearToken();tabSession?.clear();authRequired('This Google account does not have workspace access. Use an authorized account.');return;}
  if(error.authRequired||transport.needsAuth()){authRequired(error.message);return;}
  // A network or service failure is not a sign-out. Keep the unexpired session.
  if(loaded){strip.hidden=false;note.textContent=error.message;reconnect.textContent='Retry connection';}
  else{showGate(error.message);gate.querySelector('button').textContent='Retry connection';}
 }
 function finishAuth(ok){const done=resolveAuth;resolveAuth=null;authPending=null;quietAttempt=false;reconnect.disabled=false;done?.(ok);}
 function authFailed(message){
  const quiet=quietAttempt;if(quiet)retryAfter=Date.now()+300000;
  finishAuth(false);
  if(quiet&&!transport.needsAuth())return;
  reconnect.textContent='Reconnect Google';authRequired(message);
 }
 function requestGoogle(quiet=false,selectAccount=false){
  if(!client)return null;if(authPending)return authPending;
  if(quiet&&(!accountHint||Date.now()<retryAfter))return null;
  quietAttempt=quiet;reconnect.disabled=true;
  authPending=new Promise(resolve=>{resolveAuth=resolve;});const pending=authPending;
  try{client.requestAccessToken({prompt:selectAccount?'select_account':quiet?'none':'',...(accountHint?{login_hint:accountHint}:{})});}
  catch{authFailed('Google sign-in could not open. Choose Reconnect Google to try again.');}
  return pending;
 }
 function loadScript(name){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./assets/'+name+'.js'+assetVersion;s.onload=resolve;s.onerror=()=>reject(Error('A dashboard file could not be loaded. Reload to try again.'));document.body.append(s);});}
 async function openDashboard(){
  if(loading)return;loading=true;
  try{
   const first=await transport.call('getWorkspace');
   if(!first?.state||!first.email||!first.version)throw Error('Google returned an incomplete ledger. No records were changed.');
   if(loaded&&first.email!==activeEmail){transport.clearToken();tabSession?.clear();throw Object.assign(Error('A different Google account was selected. Your edits are retained. Sign back in with '+activeEmail+' or export your work before reloading.'),{authRequired:true});}
   activeEmail=first.email;accountHint=first.email;try{sessionStorage.setItem(accountKey,accountHint);}catch{}
   if(loaded){strip.hidden=true;document.dispatchEvent(new Event('oversite-auth-ready'));return true;}
   document.getElementById('seed').textContent=JSON.stringify(first.state);
   window.OverSiteDefaults=first.uiDefaults||{};
   let cached=first;
   window.OverSiteTransport={
    call:async(name,...args)=>{if(name==='getWorkspace'&&cached){const result=cached;cached=null;return result;}if(authPending&&transport.needsAuth())await authPending;return transport.call(name,...args);},
    needsAuth:()=>transport.needsAuth(),
    browserPolling:true
   };
   bootStarted=true;
   for(const name of ['core','worksheet','home','drive-poller','cloud','document-parser','pdf-lib','intake-ui','fflate','word-forms','form-ui','document-updates'])await loadScript(name);
   loaded=true;strip.hidden=true;
   signOutButton=make('button','Sign out');signOutButton.className='btn';signOutButton.onclick=()=>{if(window.OverSiteCloud?.status().dirty&&!confirm('Sign out and discard unsaved on-screen edits? Export a backup first if needed.'))return;tabSession?.clear();try{sessionStorage.removeItem(accountKey);}catch{}transport.clearToken();location.reload();};document.querySelector('.top-actions')?.append(signOutButton);
   return true;
  }catch(error){
   if(bootStarted&&!loaded){showGate('A dashboard file could not load. Reload this page to try again. No ledger changes were sent.',false);const retry=make('a','Reload dashboard');retry.href='./';retry.className='btn';gate.firstElementChild.append(retry);}
   else connectionFailed(error);
  }
  finally{loading=false;}
 }
 function connect(){
  if(!client)return;
  reconnect.textContent='Reconnect Google';
  if(!transport.needsAuth())return openDashboard();
  return requestGoogle(false);
 }
 // Google requires a real user gesture. Renew on ordinary app use, never on a
 // timer, and never reopen consent repeatedly when Google needs manual attention.
 document.addEventListener('click',event=>{
  if(!event.isTrusted||!loaded||!client||event.target.closest('a')||event.target===signOutButton||event.target===reconnect)return;
  if(transport.needsRenewal())requestGoogle(true);
 },true);
 if(!config?.clientId||!config?.deploymentId){
  showGate('The website is ready for its Google connection. Sign-in setup must be completed before it can open your ledger.',false);return;
 }
 try{transport=new window.OverSiteScriptTransport({deploymentId:config.deploymentId,onAuthRequired:()=>authRequired()});}
 catch(error){showGate(error.message,false);return;}
 showGate('Loading Google sign-in…',false);
 const gis=document.createElement('script');gis.src='https://accounts.google.com/gsi/client';gis.async=true;
 gis.onerror=()=>showGate('Google sign-in could not load. Check your connection and reload.',false);
 gis.onload=()=>{
  client=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:config.scopes.join(' '),
   callback:async response=>{
    if(response.error){authFailed('Google needs you to reconnect. Your on-screen edits are retained.');return;}
    if(!google.accounts.oauth2.hasGrantedAllScopes(response,...config.scopes)){authFailed('Google access was not fully granted. Reconnect to open your private ledger.');return;}
    try{const expiresAt=Date.now()+Number(response.expires_in)*1000;transport.setToken(response.access_token,response.expires_in);tabSession?.save(response.access_token,response.expires_in);const opened=await openDashboard();if(opened){tabSession?.save(response.access_token,(expiresAt-Date.now())/1000);retryAfter=0;}finishAuth(!!opened);}
    catch(error){authFailed(error.message);}
   },
   error_callback:()=>authFailed('Google sign-in was closed or blocked. Choose Reconnect Google to try again.')
  });
  const existing=tabSession?.read();
  if(existing){transport.setToken(existing.token,existing.seconds);showGate('Opening your private financial dashboard…',false);openDashboard();}
  else showGate('Sign in to open your private financial dashboard.');
 };
 document.head.append(gis);
})();
