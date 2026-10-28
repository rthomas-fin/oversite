(function(root){
 'use strict';
 const allowed=new Set(['getWorkspace','saveWorkspace','getFolderInbox','scanFolders','readFolderDocument','uploadFolderDocument','processFolderDocument','retryFolderDocument','getCreditPdf','getCreditForm','getCreditDrafts','saveCreditDraft']);
 class ScriptTransport {
  #token='';#expires=0;
  constructor({deploymentId,fetcher=(...args)=>root.fetch(...args),now=Date.now,onAuthRequired=()=>{}}){
   if(!/^[A-Za-z0-9_-]{20,250}$/.test(deploymentId))throw Error('The Google connection has not been configured.');
   Object.assign(this,{deploymentId,fetcher,now,onAuthRequired});this.writeOutcomeUncertain=false;
  }
  setToken(token,seconds){
   if(typeof token!=='string'||!token||!Number.isFinite(Number(seconds))||Number(seconds)<=0)throw Error('Google sign-in did not return a usable session.');
   this.#token=token;this.#expires=this.now()+Number(seconds)*1000;
  }
  clearToken(){this.#token='';this.#expires=0;}
  needsAuth(){return !this.#token||this.now()+360000>=this.#expires;}
  authError(){this.onAuthRequired();return Object.assign(Error('Reconnect Google. Your on-screen edits are retained.'),{authRequired:true});}
  async call(name,...args){
   if(!allowed.has(name)||args.length>1)throw Error('Unsupported dashboard action.');
   if(name==='saveWorkspace'&&this.writeOutcomeUncertain)throw Error('A previous save has an uncertain outcome. Export your edits and reload this page before saving again.');
   if(this.needsAuth())throw this.authError();
   let response,data;
   try{
    response=await this.fetcher('https://script.googleapis.com/v1/scripts/'+this.deploymentId+':run',{
     method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
     headers:{Authorization:'Bearer '+this.#token,'Content-Type':'application/json'},
     body:JSON.stringify({function:'overSiteBrowser',parameters:[{action:name,args}],devMode:false}),
     signal:AbortSignal.timeout(60000)
    });
    if(response.status===401){this.clearToken();throw this.authError();}
    data=await response.json();
   }catch(error){
    if(error.authRequired)throw error;
    if(name==='saveWorkspace')this.writeOutcomeUncertain=true;
    if(name==='saveWorkspace')throw Error('The save could not be confirmed. Export your edits and reload this page before trying another save.');
    const detail=response?'Google returned an unreadable response (HTTP '+response.status+').':
     ['TimeoutError','AbortError'].includes(error.name)?'The Google request timed out.':
     'The Google request failed before a response arrived ('+String(error.name||'Error')+': '+String(error.message||'connection failed').slice(0,180)+').';
    throw Error(detail+' No financial records were changed. Try signing in again to reconnect.');
   }
   if(!response.ok||data.error||!data.done||!data.response||!Object.hasOwn(data.response,'result')){
    // Never retry a write after a script error: its underlying batch may have completed.
    if(name==='saveWorkspace')this.writeOutcomeUncertain=true;
    const detail=data.error?.details?.find(d=>typeof d.errorMessage==='string')?.errorMessage;
    const message=detail||data.error?.message||'Google did not confirm completion.';
    throw Error(String(message).slice(0,600));
   }
   return data.response.result;
  }
 }
 class TabSession {
  constructor({storage,key,now=Date.now}){Object.assign(this,{storage,key,now});}
  clear(){try{this.storage.removeItem(this.key);}catch{}}
  save(token,seconds){try{if(typeof token!=='string'||!token||!Number.isFinite(Number(seconds)))return;this.storage.setItem(this.key,JSON.stringify({token,expiresAt:this.now()+Math.min(Number(seconds),3600)*1000}));}catch{}}
  read(){try{const s=JSON.parse(this.storage.getItem(this.key)||'null');if(!s||typeof s.token!=='string'||!s.token||!Number.isFinite(s.expiresAt)||s.expiresAt-this.now()<=360000||s.expiresAt-this.now()>3600000){this.clear();return null;}return {token:s.token,seconds:(s.expiresAt-this.now())/1000};}catch{this.clear();return null;}}
 }
 root.OverSiteTabSession=TabSession;
 root.OverSiteScriptTransport=ScriptTransport;
 if(typeof module!=='undefined'&&module.exports)module.exports=ScriptTransport;
})(typeof window==='undefined'?globalThis:window);
