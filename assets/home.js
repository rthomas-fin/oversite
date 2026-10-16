
// Navigation only: no changes to bank data, invoice balances or forecasting assumptions.
const homeHeader=document.querySelector('.top-actions');
if(homeHeader)homeHeader.insertAdjacentHTML('afterbegin','<button type="button" class="home-always" data-v3="nav" data-page="forecast">⌂ Cash & runway</button>');
document.addEventListener('click',e=>{
 if(e.target.closest('[data-home-fix="runway"]')){
   const F=modelV3(S);selectedDay=F.negative||F.breach||F.start;selectedMonth=selectedDay.slice(0,7);mxModeV5='detail';page='overview';render();window.scrollTo(0,0);
 }
 if(e.target.closest('[data-v3="month"]')){
   requestAnimationFrame(()=>document.querySelector('.month-explanation')?.scrollIntoView({block:'start',behavior:'smooth'}));
 }
 const b=e.target.closest('[data-action="navigate"][data-page="overview"],[data-v3="nav"][data-page="overview"]');
 if(b){mxModeV5='months';render();}
});
// Keep these two primary views explicit and always start at the cash overview.
page='forecast';render();
