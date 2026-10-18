/* Shared, deterministic extraction. No network, evaluation, or financial posting. */
var OverSiteIntake = (function () {
 'use strict';
 function date(value) {
  const s=String(value||'').trim(); let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y,mo,d;
  if(m){[,y,mo,d]=m;}else{m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(!m)return '';[,mo,d,y]=m;}
  const v=new Date(Date.UTC(+y,+mo-1,+d));
  return v.getUTCFullYear()===+y&&v.getUTCMonth()===+mo-1&&v.getUTCDate()===+d?v.toISOString().slice(0,10):'';
 }
 function money(value) {
  const s=String(value??'').trim().replace(/^USD\s*/i,'').replace(/^\$\s*/,'').replace(/,/g,'');
  if(!/^\d+(?:\.\d{1,2})?$/.test(s))return 0;
  const n=Math.round(Number(s)*100);return Number.isSafeInteger(n)&&n<=1e12?n:0;
 }
 function csv(text,delimiter) {
  const out=[];let row=[],cell='',quote=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===delimiter&&!quote){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);out.push(row);row=[];cell='';}else cell+=c;}
  if(quote)throw Error('Unclosed quoted field. Correct the source file before importing.');
  if(cell||row.length){row.push(cell);out.push(row);}return out.filter(r=>r.some(x=>String(x).trim()));
 }
 function table(rows) {
  let header=-1,index;
  for(let i=0;i<Math.min(rows.length,30);i++){
   const h=rows[i].map(x=>String(x).toLowerCase().replace(/[^a-z]/g,''));
   const at=keys=>h.findIndex(x=>keys.includes(x));
   const a={invoice:at(['invoice','invoicenumber','invoiceid','invoiceno','reference','referencenumber']),amount:at(['amount','total','balance','amountdue','totalamount','openamount','balanceowing','outstanding']),party:at(['vendor','customer','company','party','name','vendorname','customername']),date:at(['date','invoicedate']),due:at(['duedate','paymentduedate'])};
   if(a.invoice>=0&&a.amount>=0){header=i;index=a;break;}
  }
  if(header<0)return null;
  const data=rows.slice(header+1).filter(r=>String(r[index.invoice]||'').trim());
  if(data.length>500)throw Error('More than 500 invoice rows. Split the source; no rows were silently discarded.');
  return data.map(r=>({invoice:String(r[index.invoice]||'').trim(),party:index.party<0?'':String(r[index.party]||'').trim(),amount:money(r[index.amount]),date:index.date<0?'':date(r[index.date]),due:index.due<0?'':date(r[index.due]),expected:''}));
 }
 function parse(text,name,grids) {
  if(typeof text!=='string'||text.length>100000)throw Error('Document text exceeds the review limit. Split the source into smaller files.');
  if(grids){const rows=[];for(const grid of grids){const found=table(grid.rows);if(found)rows.push(...found.map(r=>({...r,sheet:grid.name})));}if(rows.length>500)throw Error('Workbook exceeds 500 invoice rows. Split the source.');if(rows.length)return rows;}
  if(/\.(csv|tsv)$/i.test(name)){const rows=table(csv(text,/\.tsv$/i.test(name)?'\t':','));if(rows)return rows;}
  const pick=re=>(text.match(re)||[])[1]?.trim()||'';
  const amount=pick(/(?:amount\s*due|balance\s*due|grand\s*total|invoice\s*total|total\s*due)\s*[:\s]*\$?\s*([\d,]+\.\d{2})/i)||pick(/^total\s*[:\s]*\$?\s*([\d,]+\.\d{2})\s*$/im);
  return [{invoice:pick(/(?:invoice\s*(?:number|no\.?|#|id))\s*[:#\s]*([A-Za-z0-9][A-Za-z0-9_./-]*)/i),party:pick(/\b(?:vendor|supplier|customer|company|from)\s*:\s*([^\r\n]+)/i),amount:money(amount),date:date(pick(/(?:invoice\s*date|^date)\s*:\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/im)),due:date(pick(/due\s*date\s*:\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)),expected:''}];
 }
 function key(party,invoice){return String(party||'').trim().toLowerCase()+'|'+String(invoice||'').trim().toLowerCase();}
 return {date,money,csv,table,parse,key};
})();
