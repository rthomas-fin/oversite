/* Shared, deterministic extraction. No network, evaluation, or financial posting. */
var OverSiteIntake = (function () {
 'use strict';
 function date(value) {
  const s=String(value||'').trim(); let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y,mo,d;
  if(m){[,y,mo,d]=m;}else{m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);if(!m)return '';[,mo,d,y]=m;if(y.length===2)y='20'+y;}
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
 const normalized=value=>String(value??'').toLowerCase().replace(/[^a-z]/g,'');
 const invoiceHeaders=['invoice','invoicenumber','invoiceid','invoiceno','reference','referencenumber','osoiinvoice','osinvoice','oiinvoice'];
 const invoiceValue=value=>String(value??'').trim().replace(/^(\d+)\.0+$/,'$1');
 function table(rows) {
  let header=-1,index;
  for(let i=0;i<Math.min(rows.length,30);i++){
   const h=rows[i].map(x=>String(x).toLowerCase().replace(/[^a-z]/g,''));
   const at=keys=>h.findIndex(x=>keys.includes(x));
   const a={invoice:at(invoiceHeaders),amount:at(['amount','total','balance','amountdue','totalamount','openamount','balanceowing','outstanding']),party:at(['vendor','customer','company','party','name','vendorname','customername','client']),date:at(['date','invoicedate']),due:at(['duedate','paymentduedate'])};
   if(a.invoice>=0&&a.amount>=0){header=i;index=a;break;}
  }
  if(header<0)return null;
  const data=rows.slice(header+1).filter(r=>{const v=String(r[index.invoice]||'').trim();return v&&!invoiceHeaders.includes(normalized(v))&&!/^(?:grand\s+total|sub\s*total|total|outstanding|received|description)$/i.test(v);});
  if(data.length>500)throw Error('More than 500 invoice rows. Split the source; no rows were silently discarded.');
  const client=rows.slice(0,header).flat().map(String).map(v=>v.match(/^\s*Client\s*:\s*(.+)$/i)?.[1]).find(Boolean)||'';
  return data.map(r=>({invoice:invoiceValue(r[index.invoice]),party:index.party<0?client:String(r[index.party]||'').trim(),amount:money(r[index.amount]),date:index.date<0?'':date(r[index.date]),due:index.due<0?'':date(r[index.due]),expected:''}));
 }
 // Invoice registers contain payment history and must not use the one-invoice text fallback.
 function audit(grids){
  const rows=[],warnings=[];let recognized=false;
  for(const grid of grids||[]){
   if(!grid.rows.slice(0,30).flat().some(v=>/accounts\s+receivable\s+audit/i.test(String(v))))continue;
   recognized=true;
   const header=grid.rows.findIndex(r=>r.some(v=>invoiceHeaders.includes(normalized(v)))&&r.some(v=>normalized(v)==='status')&&r.some(v=>normalized(v)==='paiddate'));
   if(header<0)throw Error('The AR register needs invoice, amount, date, payment status and paid-date columns.');
   const h=grid.rows[header].map(normalized),at=keys=>h.findIndex(v=>keys.includes(v));
   const i=at(invoiceHeaders),a=at(['amount','invoiceamount']),d=at(['date','invoicedate']),s=at(['status']),p=at(['paiddate']),approval=at(['approved']),submitted=at(['invoiced']),description=at(['description']);
   if([i,a,d,s,p].some(x=>x<0))throw Error('The AR register is missing a required column.');
   const party=grid.rows.slice(0,header).flat().map(String).map(v=>v.match(/^\s*Client\s*:\s*(.+)$/i)?.[1]?.trim()).find(Boolean)||'';
   const sheetRows=[];
   for(let n=header+1;n<grid.rows.length;n++){
    const r=grid.rows[n],invoice=invoiceValue(r[i]);
    if(!invoice||invoiceHeaders.includes(normalized(invoice))||/^(total|subtotal|grand total|outstanding|received|description)$/i.test(invoice))continue;
    const amount=money(r[a]),sourcePaymentStatus=String(r[s]||'').trim(),sourceApproval=String(r[approval]||'').trim();
    sheetRows.push({invoice,party,amount,date:date(r[d]),due:'',expected:'',sourcePaymentStatus,sourceApproval,sourcePaidDate:date(r[p]),sourceSubmittedDate:date(r[submitted]),description:String(r[description]||''),paid:/^paid$/i.test(sourcePaymentStatus)?amount:0,sheet:grid.name,sourceRow:n+1});
   }
   if(!sheetRows.length)throw Error('No invoice rows were found in the AR register.');
   for(const label of ['OUTSTANDING','RECEIVED','GRAND TOTAL']){
    const total=grid.rows.find(r=>r.some(v=>String(v).trim().toUpperCase()===label));
    if(total){const source=money(total[a]),sum=sheetRows.reduce((n,r)=>n+(label==='OUTSTANDING'?r.amount-r.paid:label==='RECEIVED'?r.paid:r.amount),0);if(source!==sum)warnings.push(label+' summary differs from the invoice rows; invoice rows were used.');}
   }
   rows.push(...sheetRows);
  }
  if(!recognized)return null;
  if(rows.length>500)throw Error('Workbook exceeds 500 invoice rows. Split the source.');
  const keys=new Set();
  for(const r of rows){if(!r.party||!r.invoice||!r.amount||!r.date||! /^(open|paid)$/i.test(r.sourcePaymentStatus))throw Error('AR register row '+r.sourceRow+' in '+r.sheet+' needs a customer, invoice, positive amount, valid date and Open/Paid status.');const k=key(r.party,r.invoice);if(keys.has(k))throw Error('Repeated invoice '+r.invoice+' in the AR register. Resolve the duplicate source rows.');keys.add(k);}
  return {rows,warnings};
 }
 function parse(text,name,grids) {
  if(typeof text!=='string'||text.length>100000)throw Error('Document text exceeds the review limit. Split the source into smaller files.');
  if(grids){const rows=[];for(const grid of grids){const found=table(grid.rows);if(found)rows.push(...found.map(r=>({...r,sheet:grid.name})));}if(rows.length>500)throw Error('Workbook exceeds 500 invoice rows. Split the source.');if(rows.length)return rows;throw Error('Excel was read automatically, but no invoice table was recognized. Review the column headings; no summary total was posted.');}
  if(/\.(csv|tsv)$/i.test(name)){const rows=table(csv(text,/\.tsv$/i.test(name)?'\t':','));if(rows)return rows;}
  const pick=re=>(text.match(re)||[])[1]?.trim()||'';
  const amount=pick(/(?:amount\s*due|balance\s*due|grand\s*total|invoice\s*total|total\s*due)\s*[:\s]*\$?\s*([\d,]+\.\d{2})/i)||pick(/^total\s*[:\s]*\$?\s*([\d,]+\.\d{2})\s*$/im);
  return [{invoice:pick(/(?:invoice\s*(?:number|no\.?|#|id))\s*[:#\s]*([A-Za-z0-9][A-Za-z0-9_./-]*)/i),party:pick(/\b(?:vendor|supplier|customer|company|from)\s*:\s*([^\r\n]+)/i),amount:money(amount),date:date(pick(/(?:invoice\s*date|^date)\s*:\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/im)),due:date(pick(/due\s*date\s*:\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)),expected:''}];
 }
 function key(party,invoice){return String(party||'').trim().toLowerCase()+'|'+String(invoice||'').trim().toLowerCase();}
 return {date,money,csv,table,parse,key,audit};
})();
