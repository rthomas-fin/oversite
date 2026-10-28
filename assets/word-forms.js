/* Fill explicit Word blanks only; preserve original package parts and formatting. */
(function(root){
 'use strict';
 const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const elements=(node,name)=>Array.from(node.getElementsByTagNameNS(W,name));
 const attr=(node,name)=>node?.getAttributeNS(W,name)||'';
 const isManual=label=>/signature|signed|guarant|consent|authoriz|social.security|\bssn\b|routing|account.number/i.test(label);
 function profileKey(label){
  const key=String(label).toLowerCase().replace(/[^a-z]/g,'');
  const groups={legalName:['legalbusinessname','legalcompanyname','companyname','businessname','applicantname','customername'],dba:['dba','doingbusinessas'],address:['address','businessaddress','billingaddress','mailingaddress'],phone:['phone','businessphone','telephone'],email:['email','businessemail'],entityType:['entitytype','businesstype'],entityDescription:['companyentitydescription'],formationDate:['formationdate','dateestablished'],contact:['contact','contactname'],signatoryName:['printedname','signatoryname','authorizedrepresentativename'],signatoryTitle:['title','signatorytitle'],tradeReferences:['tradereferences']};
  return Object.keys(groups).find(k=>groups[k].includes(key));
 }
 function xml(text){
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('This Word document contains unsupported XML declarations.');
  const doc=new root.DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('The Word document contains unreadable XML.');
  return doc;
 }
 function open(bytes){
  if(bytes.length>5000000)throw Error('Maximum file size is 5 MB.');
  let total=0,count=0;
  const entries=root.fflate.unzipSync(bytes,{filter:file=>{total+=file.originalSize;count++;if(total>50000000||count>3000||file.originalSize>15000000)throw Error('The expanded Word document is too large.');return true;}});
  if(!entries['word/document.xml']||!entries['[Content_Types].xml'])throw Error('This file is not a valid Word .docx document.');
  if(Object.keys(entries).some(n=>/^_xmlsignatures\//i.test(n)||/vbaProject/i.test(n)))throw Error('Signed or macro-enabled Word documents need manual completion. Use an unsigned .docx original.');
  const fields=[],parts={},manual=[];
  for(const name of Object.keys(entries).filter(n=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(n))){
   const doc=xml(root.fflate.strFromU8(entries[name]));parts[name]=doc;
   for(const [pIndex,p] of elements(doc,'p').entries()){
    const nodes=elements(p,'t'),text=nodes.map(n=>n.textContent).join('');
    if(!text.trim())continue;
    // Do not change tracked revisions, field codes, drawings, or protected content.
    let ancestor=p,excluded=false;
    while(ancestor&&ancestor!==doc){if(ancestor.namespaceURI===W&&['del','ins','sdt'].includes(ancestor.localName))excluded=true;ancestor=ancestor.parentNode;}
    if(excluded||elements(p,'fldChar').length||elements(p,'fldSimple').length)continue;
    for(const match of text.matchAll(/\[\s*_{2,}\s*\]|\{\{[^{}\r\n]{1,100}\}\}|_{3,}/g)){
     const before=text.slice(0,match.index),after=text.slice(match.index+match[0].length);
     let label=match[0].startsWith('{{')?match[0].slice(2,-2).trim():'';
     if(!label&&/effective\s+as\s+of\s*$/i.test(before))label='Effective date';
     if(!label&&/\ba\s*$/i.test(before)&&/^\s*[“"(]*Customer/i.test(after))label='Company entity description';
     if(!label)label=before.split(/[\n;.!?]/).pop().trim().replace(/[:\s]+$/,'').slice(-85)||'Blank '+(fields.length+1);
     const context=text.slice(Math.max(0,match.index-100),match.index)+' ⟦answer⟧ '+after.slice(0,100);
     const blocked=isManual(label)||/^\s*By\s*:/i.test(text)||(/^\s*_{3,}\s*,\s*_{3,}\s*$/.test(text));
     const field={id:'word-'+fields.length,part:name,pIndex,start:match.index,end:match.index+match[0].length,label,context,manual:blocked,profileKey:blocked?null:profileKey(label)};
     fields.push(field);if(blocked)manual.push(field);
    }
   }
   // Plain-text content controls with an explicit placeholder are supported.
   for(const [sIndex,sdt] of elements(doc,'sdt').entries()){
    const props=elements(sdt,'sdtPr')[0],content=elements(sdt,'sdtContent')[0];
    if(!props||!content||!elements(props,'text').length||elements(props,'lock').length||elements(content,'sdt').length)continue;
    if(!elements(props,'showingPlcHdr').length)continue;
    const label=attr(elements(props,'alias')[0],'val')||attr(elements(props,'tag')[0],'val')||'Text field '+(fields.length+1);
    const field={id:'word-'+fields.length,part:name,sIndex,label,context:label,manual:isManual(label),profileKey:isManual(label)?null:profileKey(label)};
    fields.push(field);if(field.manual)manual.push(field);
   }
  }
  if(fields.length>250)throw Error('This form has more than 250 blanks. Split it before preparing a draft.');
  return {entries,fields,manual};
 }
 function fill(form,answers){
  const entries={...form.entries},changes=new Map();
  for(const field of form.fields){
   const value=answers[field.id];if(field.manual||value==null||String(value).trim()==='')continue;
   if(typeof value!=='string'||value.length>1500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw Error('An answer is invalid or too long.');
   if(!changes.has(field.part))changes.set(field.part,[]);changes.get(field.part).push({...field,value});
  }
  for(const [part,fields]of changes){
   const doc=xml(root.fflate.strFromU8(entries[part]));
   for(const f of fields.filter(f=>f.sIndex!==undefined)){
    const sdt=elements(doc,'sdt')[f.sIndex],content=elements(sdt,'sdtContent')[0],nodes=elements(content,'t');
    if(!nodes.length)throw Error('This content control has no editable text.');
    nodes[0].textContent=f.value;nodes[0].setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');for(const n of nodes.slice(1))n.textContent='';
    const placeholder=elements(sdt,'showingPlcHdr')[0];placeholder?.parentNode.removeChild(placeholder);
   }
   for(const f of fields.filter(f=>f.pIndex!==undefined).sort((a,b)=>b.pIndex-a.pIndex||b.start-a.start)){
    const nodes=elements(elements(doc,'p')[f.pIndex],'t');let offset=0,inserted=false;
    for(const node of nodes){const text=node.textContent,start=offset,end=start+text.length;offset=end;if(end<=f.start||start>=f.end)continue;
     const prefix=text.slice(0,Math.max(0,f.start-start)),suffix=text.slice(Math.min(text.length,f.end-start));
     node.textContent=prefix+(inserted?'':f.value)+suffix;inserted=true;node.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
    }
    if(!inserted)throw Error('The original field could not be located. Reopen the form.');
   }
   entries[part]=root.fflate.strToU8(new root.XMLSerializer().serializeToString(doc));
  }
  return root.fflate.zipSync(entries,{level:6});
 }
 root.OverSiteWordForms={open,fill,profileKey,isManual};
})(typeof window==='undefined'?globalThis:window);
