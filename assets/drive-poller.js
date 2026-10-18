/* Browser polling has no credentials or financial posting logic. */
(function(root){
 'use strict';
 class DrivePoller {
  constructor({scan,onResult=()=>{},onStatus=()=>{},canRun=()=>true,interval=60000,schedule=(...args)=>root.setTimeout(...args),cancel=(...args)=>root.clearTimeout(...args),now=Date.now}){
   Object.assign(this,{scan,onResult,onStatus,canRun,interval,schedule,cancel,now});
   this.enabled=false;this.inFlight=null;this.timer=null;this.failures=0;this.lastChecked=null;
  }
  status(message,extra={}){this.onStatus({message,enabled:this.enabled,lastChecked:this.lastChecked,...extra});}
  start(){if(this.enabled)return;this.enabled=true;void this.check();}
  stop(){this.enabled=false;this.cancel(this.timer);this.timer=null;this.status('Folder checks paused');}
  wake(){if(this.enabled){this.cancel(this.timer);this.timer=null;return this.check();}}
  async check(manual=false){
   if(this.inFlight)return this.inFlight;
   if(!this.enabled&&!manual)return;
   if(!this.canRun()){this.status('Folder checks paused until this tab is active and connected');this.queue(this.interval);return;}
   this.status('Checking Drive folders…');
   this.inFlight=(async()=>{
    let delay=this.interval;
    try{
     const result=await this.scan();
     if(!this.enabled&&!manual)return;
     this.lastChecked=this.now();
     this.onResult(result);
     if(result.errors?.length)throw Error(result.errors.join('; '));
     this.failures=0;this.status(this.enabled?'Folder checks every minute while this tab is active':'Folders refreshed; automatic checks remain paused');
    }catch(error){
     if(!this.enabled&&!manual)return;
     this.failures++;delay=Math.min(900000,this.interval*2**Math.min(this.failures,4));
     this.status(error.authRequired?'Reconnect Google to resume folder checks':'Folder check failed; retrying later',{error:error.message});
    }finally{this.inFlight=null;if(this.enabled)this.queue(delay);}
   })();
   return this.inFlight;
  }
  queue(delay){this.cancel(this.timer);if(this.enabled)this.timer=this.schedule(()=>{this.timer=null;void this.check();},delay);}
 }
 root.OverSiteDrivePoller=DrivePoller;
 if(typeof module!=='undefined'&&module.exports)module.exports=DrivePoller;
})(typeof window==='undefined'?globalThis:window);
