(function(){
 'use strict';
 const config=window.OverSiteConnection,gate=document.getElementById('cloud-wait');
 let client,transport,loaded=false,loading=false,bootStarted=false;
 const make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 function showGate(message,enabled=true){
  const box=make('section','');box.className='google-signin';
  box.append(make('h1','OverSite Financial Command Center'),make('p',message));
  const button=make('button','Sign in with Google');button.className='btn primary';button.disabled=!enabled;button.onclick=connect;
  box.append(button,make('p','Your financial records are loaded from your private Google Sheet after sign-in.'));
  gate.replaceChildren(box);
 }
 const strip=make('div','');strip.className='google-reconnect';strip.hidden=true;
 const reconnect=make('button','Reconnect Google');reconnect.className='btn';reconnect.onclick=connect;
 const note=make('span','');strip.append(note,reconnect);document.body.prepend(strip);
 function authRequired(message='Google sign-in needs refreshing. Your edits remain on screen.'){
  if(loaded){strip.hidden=false;note.textContent=message;document.dispatchEvent(new Event('oversite-auth-required'));}
  else showGate(message);
 }
 function loadScript(name){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./assets/'+name+'.js';s.onload=resolve;s.onerror=()=>reject(Error('A dashboard file could not be loaded. Reload to try again.'));document.body.append(s);});}
 async function openDashboard(){
  if(loading)return;loading=true;
  try{
   const first=await transport.call('getWorkspace');
   if(!first?.state||!first.email||!first.version)throw Error('Google returned an incomplete ledger. No records were changed.');
   if(loaded){strip.hidden=true;document.dispatchEvent(new Event('oversite-auth-ready'));return;}
   document.getElementById('seed').textContent=JSON.stringify(first.state);
   window.OverSiteDefaults=first.uiDefaults||{};
   let cached=first;
   window.OverSiteTransport={
    call:(name,...args)=>{if(name==='getWorkspace'&&cached){const result=cached;cached=null;return Promise.resolve(result);}return transport.call(name,...args);},
    needsAuth:()=>transport.needsAuth(),
    browserPolling:true
   };
   bootStarted=true;
   for(const name of ['core','worksheet','home','drive-poller','cloud'])await loadScript(name);
   loaded=true;strip.hidden=true;
  }catch(error){
   if(bootStarted&&!loaded){showGate('A dashboard file could not load. Reload this page to try again. No ledger changes were sent.',false);const retry=make('a','Reload dashboard');retry.href='./';retry.className='btn';gate.firstElementChild.append(retry);}
   else authRequired(error.message);
  }
  finally{loading=false;}
 }
 function connect(){
  if(!client)return;
  reconnect.disabled=true;
  try{client.requestAccessToken({prompt:''});}catch{reconnect.disabled=false;authRequired('Google sign-in could not open. Check popup permissions and try again.');}
 }
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
    reconnect.disabled=false;
    if(response.error){authRequired('Google sign-in was not completed. You can try again.');return;}
    if(!google.accounts.oauth2.hasGrantedAllScopes(response,...config.scopes)){transport.clearToken();authRequired('Google access was not fully granted. Reconnect to open your private ledger.');return;}
    try{transport.setToken(response.access_token,response.expires_in);await openDashboard();}
    catch(error){authRequired(error.message);}
   },
   error_callback:()=>{reconnect.disabled=false;authRequired('The sign-in window was closed or blocked. Click Sign in to try again.');}
  });
  showGate('Sign in to open your private financial dashboard.');
 };
 document.head.append(gis);
})();
