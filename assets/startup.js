
/* OverSite startup diagnostics. No record writes or changes to authorization. */
(function () {
  'use strict';
  var report = { build: 'startup-check-20261014', errors: [], started: Date.now(), phase: 'Interface startup' };
  var timeout;
  function connecting() { return document.body?.dataset.staticMode!=='true' && !!document.getElementById('cloud-wait'); }
  function status() {
    try { return window.OverSiteCloud && window.OverSiteCloud.status ? window.OverSiteCloud.status() : null; }
    catch (_) { return null; }
  }
  function text(tag, value) { var e = document.createElement(tag); e.textContent = value; return e; }
  function show(message, code) {
    var w = document.getElementById('cloud-wait');
    if (!w) return;
    var box = document.createElement('section');
    box.style.cssText = 'max-width:740px;margin:24px;padding:30px;background:white;border:1px solid #dce5e8;border-radius:12px;font:16px/1.6 Arial;color:#173b38';
    box.appendChild(text('h2', 'OverSite could not finish connecting'));
    box.appendChild(text('p', 'Your ledger has not been reset. No payments or records were changed by this check.'));
    var details = text('pre', code + '\n' + String(message).slice(0,1600));
    details.id = 'oversite-connection-error';
    details.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:#f7f3ed;border-radius:6px;font:13px/1.6 monospace';
    box.appendChild(details);
    box.appendChild(text('p', 'Send the message in this box back in the chat. Do not run setup again or change sharing permissions.'));
    var button = text('button', 'Retry connection');
    button.style.cssText = 'padding:10px 16px;border:0;border-radius:6px;background:#087d73;color:#fff;cursor:pointer';
    button.addEventListener('click', function () {
      var s = status();
      if (s && !s.ready && window.OverSiteCloud) {
        w.textContent = 'Retrying the private Google ledger connection…';
        startTimer();
        window.OverSiteCloud.refresh();
      } else {
        box.appendChild(text('p','Refresh the website using the browser reload button.'));
      }
    });
    box.appendChild(button); w.replaceChildren(box);
    report.displayed = code;
  }
  function delayed() {
    if (!connecting()) return;
    var s = status();
    if (report.errors.length) show(report.errors.join('\n'), 'STARTUP_ERROR');
    else if (!s) show('The interface loaded, but the Google connection script did not finish starting.', 'CONNECTOR_NOT_STARTED');
    else show('Google has not returned the shared ledger within 45 seconds.\nStage: ' + (s.message || 'Waiting for getWorkspace') + '\nPlease share this message; the request may still be running.', 'LEDGER_RESPONSE_TIMEOUT');
  }
  function startTimer() { clearTimeout(timeout); timeout = setTimeout(delayed, 45000); }
  window.addEventListener('error', function (e) {
    if (!e.message) return;
    report.errors.push(String(e.message) + (e.lineno ? ' (browser line ' + e.lineno + ')' : ''));
    if (connecting()) setTimeout(function(){show(report.errors.join('\n'), 'STARTUP_ERROR');},0);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var message = e.reason && e.reason.message ? e.reason.message : String(e.reason || 'Unknown startup error');
    report.errors.push(message);
    if (connecting()) show(message,'CONNECTION_ERROR');
  });
  window.addEventListener('DOMContentLoaded',function(){
    if (!connecting()) return;
    report.phase='Waiting for shared ledger';
    if (report.errors.length) show(report.errors.join('\n'),'STARTUP_ERROR');
    else startTimer();
  });
  window.OverSiteStartupCheck = { report: function(){return {build:report.build,phase:report.phase,elapsedSeconds:Math.round((Date.now()-report.started)/1000),errors:report.errors.slice(),displayed:report.displayed||null};}, check:delayed };
})();
