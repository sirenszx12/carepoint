/* ---------- Data layer ---------- */
const KEY='carepoint_v1';
const today=()=>new Date().toISOString().slice(0,10);
const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
function seed(){return{
 patients:[
  {id:'P001',name:'Maria Santos',dob:'1984-03-12',sex:'F',phone:'0917 555 0142',allergies:'Penicillin'},
  {id:'P002',name:'Juan dela Cruz',dob:'1958-11-02',sex:'M',phone:'0928 555 0199',allergies:'None known'}],
 medications:[
  {id:'M001',name:'Amoxicillin',form:'Capsule',strength:'500 mg',reorder:100},
  {id:'M002',name:'Metformin',form:'Tablet',strength:'500 mg',reorder:150},
  {id:'M003',name:'Losartan',form:'Tablet',strength:'50 mg',reorder:100}],
 batches:[
  {id:'B001',medId:'M001',lot:'AMX-2301',expiry:addDays(35),qty:120,received:addDays(-200)},
  {id:'B002',medId:'M001',lot:'AMX-2405',expiry:addDays(400),qty:300,received:addDays(-30)},
  {id:'B003',medId:'M002',lot:'MET-2310',expiry:addDays(-10),qty:60,received:addDays(-400)},
  {id:'B004',medId:'M002',lot:'MET-2408',expiry:addDays(260),qty:500,received:addDays(-20)},
  {id:'B005',medId:'M003',lot:'LOS-2402',expiry:addDays(520),qty:80,received:addDays(-15)}],
 prescriptions:[{id:'RX001',patientId:'P002',date:today(),doctor:'Dr. A. Reyes',notes:'Follow-up in 4 weeks',status:'Pending'}],
 items:[
  {id:'I001',rxId:'RX001',medId:'M002',qty:60,directions:'1 tablet twice daily with meals',done:false},
  {id:'I002',rxId:'RX001',medId:'M003',qty:30,directions:'1 tablet every morning',done:false}],
 log:[],n:{P:2,M:3,B:5,RX:1,I:2,L:0}}}
let db;
try{db=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!db)db=seed();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}};
const nid=(p,w=3)=>{db.n[p]=(db.n[p]||0)+1;return p+String(db.n[p]).padStart(w,'0')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(s,r=document)=>r.querySelector(s);
const by=(arr,id)=>arr.find(x=>x.id===id);
const med=id=>by(db.medications,id)||{name:'?',strength:''};
const medName=id=>{const m=med(id);return `${m.name} ${m.strength}`};
const pat=id=>by(db.patients,id)||{name:'Unknown'};
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2800)}
function expState(d){if(d<today())return['exp','Expired'];if(d<=addDays(90))return['soon','Expires soon'];return['ok','In date']}
const stockOf=id=>db.batches.filter(b=>b.medId===id&&b.expiry>=today()).reduce((s,b)=>s+b.qty,0);

/* ---------- Dialog helper ---------- */
function form(title,html,onOk,okLabel='Save'){
  const box=$('#frm'),dlg=$('#dlg');
  box.innerHTML=`<h3>${title}</h3>${html}<div class="acts"><button type="button" class="btn alt" id="x">Cancel</button><button type="button" class="btn" id="ok">${okLabel}</button></div>`;
  $('#x').onclick=()=>dlg.close();
  const submit=()=>{
    for(const el of box.querySelectorAll('input,select,textarea')){if(!el.checkValidity()){el.reportValidity();return}}
    try{if(onOk(box)!==false)dlg.close()}catch(err){console.error(err);toast('Something went wrong: '+err.message)}
  };
  $('#ok').onclick=submit;
  box.onkeydown=e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();submit()}};
  dlg.showModal();
}
const FD=f=>[...f.querySelectorAll('[name]')].map(e=>[e.name,e.value]);
const fv=(f,n)=>f.querySelector('[name='+n+']').value;
const fld=(l,n,t='text',v='',req=true)=>`<label>${l}<input name="${n}" type="${t}" value="${esc(v)}" ${req?'required':''}></label>`;

/* ---------- Views ---------- */
let view='patients',q='',selPatient=null;
const V={patients,rx,stock,log,schema};
function render(){$('#main').innerHTML='';V[view]();document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===view))}
document.querySelector('nav').onclick=e=>{const b=e.target.closest('button');if(b){view=b.dataset.v;q='';selPatient=null;render()}};
function search(ph){return `<input type="search" placeholder="${ph}" value="${esc(q)}" id="q" aria-label="${ph}">`}
function bindSearch(){const s=$('#q');if(!s)return;s.oninput=()=>{q=s.value;const p=s.selectionStart;render();const n=$('#q');n.focus();n.setSelectionRange(p,p)}}

/* Patients (1) -> Prescriptions (many) */
function patients(){
  const m=$('#main');
  if(selPatient){const p=by(db.patients,selPatient);const rxs=db.prescriptions.filter(r=>r.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date));
    m.innerHTML=`<button class="btn alt sm" id="back">Back to patients</button> <button class="btn alt sm" id="editp">Edit details</button>
    <h2 style="margin-top:12px">${esc(p.name)} <span class="muted small">${p.id}</span></h2>
    <p class="sub">Born ${esc(p.dob)} · ${esc(p.sex)} · ${esc(p.phone)}</p>
    <div class="card"><b>Allergies:</b> ${esc(p.allergies)}</div>
    <div class="bar"><h3 style="margin:0;flex:1">Prescription history (${rxs.length})</h3><button class="btn" id="newrx">New prescription</button></div>
    ${rxs.length?rxs.map(rxCard).join(''):'<div class="card empty">No prescriptions yet.</div>'}`;
    $('#back').onclick=()=>{selPatient=null;render()};$('#editp').onclick=()=>patientForm(p);$('#newrx').onclick=()=>rxForm(p.id);bindRx();return}
  const list=db.patients.filter(p=>(p.name+p.id+p.phone).toLowerCase().includes(q.toLowerCase()));
  m.innerHTML=`<h2>Patients</h2><p class="sub">One central record per patient. Open a record to see every prescription over time.</p>
  <div class="bar">${search('Search by name, ID or phone')}<button class="btn" id="add">Add patient</button></div>
  <div class="wrap"><table class="tbl"><tr><th>ID</th><th>Name</th><th>Date of birth</th><th>Allergies</th><th>Prescriptions</th><th></th></tr>
  ${list.map(p=>`<tr><td>${p.id}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.dob)}</td><td>${esc(p.allergies)}</td><td>${db.prescriptions.filter(r=>r.patientId===p.id).length}</td><td><button class="btn alt sm" data-open="${p.id}">Open record</button> <button class="btn alt sm" data-editp="${p.id}">Edit</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No patients match. Add a patient to get started.</td></tr>'}</table></div>`;
  bindSearch();$('#add').onclick=()=>patientForm();
  m.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{selPatient=b.dataset.open;render()});
  m.querySelectorAll('[data-editp]').forEach(b=>b.onclick=()=>patientForm(by(db.patients,b.dataset.editp)));
}
function patientForm(p){
  p=p&&p.id?p:null;const v=p||{};
  form(p?'Edit patient':'Add patient',fld('Full name','name','text',v.name||'')+`<div class="grid2">${fld('Date of birth','dob','date',v.dob||'')}<label>Sex<select name="sex"><option ${v.sex==='F'?'selected':''}>F</option><option ${v.sex==='M'?'selected':''}>M</option></select></label></div>`+fld('Phone','phone','tel',v.phone||'')+fld('Allergies','allergies','text',v.allergies||'None known'),f=>{
    const d=Object.fromEntries(FD(f));
    if(p)Object.assign(p,d);else db.patients.push({id:nid('P'),...d});
    save();render();toast(p?'Patient updated':'Patient added')});
}

/* Prescriptions (1) -> Items (many) */
function rxCard(r){
  const its=db.items.filter(i=>i.rxId===r.id);const pend=its.some(i=>!i.done);
  return `<div class="card"><div class="bar" style="margin:0 0 8px"><b>${r.id}</b><span class="muted small" style="flex:1">${esc(r.date)} · ${esc(r.doctor)} · ${esc(pat(r.patientId).name)}</span>
  <span class="tag ${pend?'soon':'ok'}">${pend?'Pending':'Dispensed'}</span><button class="btn alt sm" data-editrx="${r.id}">Edit</button>${pend?`<button class="btn sm" data-disp="${r.id}">Dispense (FEFO)</button>`:''}</div>
  <table class="tbl small"><tr><th>Medication</th><th>Qty</th><th>Directions</th><th>Status</th></tr>
  ${its.map(i=>`<tr><td>${esc(medName(i.medId))}</td><td>${i.qty}</td><td>${esc(i.directions)}</td><td>${i.done?'<span class="tag ok">Dispensed</span>':'<span class="tag neutral">Waiting</span>'}</td></tr>`).join('')}</table>
  ${r.notes?`<p class="muted small" style="margin:8px 0 0">Note: ${esc(r.notes)}</p>`:''}</div>`}
function bindRx(){document.querySelectorAll('[data-disp]').forEach(b=>b.onclick=()=>dispense(b.dataset.disp));document.querySelectorAll('[data-editrx]').forEach(b=>b.onclick=()=>rxForm(null,by(db.prescriptions,b.dataset.editrx)))}
function rx(){
  const list=db.prescriptions.filter(r=>(r.id+pat(r.patientId).name+r.doctor).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>b.id.localeCompare(a.id));
  $('#main').innerHTML=`<h2>Prescriptions</h2><p class="sub">Each prescription belongs to one patient and can order several drugs under one ID.</p>
  <div class="bar">${search('Search by RX ID, patient or doctor')}<button class="btn" id="add">New prescription</button></div>
  ${list.map(rxCard).join('')||'<div class="card empty">No prescriptions found.</div>'}`;
  bindSearch();bindRx();$('#add').onclick=()=>rxForm();
}
function rxForm(pid,r){
  if(!db.patients.length||!db.medications.length)return toast('Add a patient and a medication first');
  const locked=!!r&&db.items.some(i=>i.rxId===r.id&&i.done);
  const cur=r?db.items.filter(i=>i.rxId===r.id):[];
  const rowHtml=(i={})=>`<div class="row"><select name="med">${db.medications.map(m=>`<option value="${m.id}" ${m.id===i.medId?'selected':''}>${esc(m.name)} ${esc(m.strength)}</option>`).join('')}</select><input name="qty" type="number" min="1" value="${i.qty||1}" aria-label="Quantity"><input name="dir" placeholder="Directions" required value="${esc(i.directions||'')}"><button type="button" class="btn alt sm" data-rm aria-label="Remove drug">×</button></div>`;
  const sel=r?r.patientId:pid;
  const drugs=locked?'<p class="muted small">This prescription has been dispensed, so its drugs and quantities are fixed to keep the dispensing log accurate. You can still correct the doctor, date and notes.</p>'
   :`<label>Drugs ordered</label><div id="rows">${(cur.length?cur:[{}]).map(rowHtml).join('')}</div><button type="button" class="btn alt sm" id="more">Add another drug</button>`;
  form(r?'Edit prescription '+r.id:'New prescription',`<label>Patient<select name="pid" ${locked?'disabled':''}>${db.patients.map(p=>`<option value="${p.id}" ${p.id===sel?'selected':''}>${esc(p.name)} (${p.id})</option>`).join('')}</select></label>
  <div class="grid2">${fld('Prescribing doctor','doctor','text',r?r.doctor:'')}${fld('Date','date','date',r?r.date:today())}</div>
  ${drugs}
  <label>Notes<textarea name="notes" rows="2">${esc(r?r.notes:'')}</textarea></label>`,f=>{
    let meds=[],qty=[],dir=[];
    if(!locked){
      meds=[...f.querySelectorAll('[name=med]')];qty=[...f.querySelectorAll('[name=qty]')];dir=[...f.querySelectorAll('[name=dir]')];
      if(!meds.length){toast('Add at least one drug');return false}
    }
    const id=r?r.id:nid('RX');
    if(r){r.doctor=fv(f,'doctor');r.date=fv(f,'date');r.notes=fv(f,'notes');if(!locked)r.patientId=fv(f,'pid')}
    else db.prescriptions.push({id,patientId:fv(f,'pid'),date:fv(f,'date'),doctor:fv(f,'doctor'),notes:fv(f,'notes'),status:'Pending'});
    if(!locked){
      db.items=db.items.filter(i=>i.rxId!==id);
      meds.forEach((m,i)=>db.items.push({id:nid('I'),rxId:id,medId:m.value,qty:+qty[i].value,directions:dir[i].value,done:false}));
    }
    save();render();toast(r?id+' updated':id+' created')},r?'Save changes':'Create prescription');
  if(!locked){
    const rows=$('#rows');$('#more').onclick=()=>rows.insertAdjacentHTML('beforeend',rowHtml());
    rows.onclick=e=>{if(e.target.dataset.rm!==undefined)e.target.closest('.row').remove()};
  }
}

/* FEFO dispensing: Batch (1) -> Dispensing log (many) */
function dispense(rxId){
  const r=by(db.prescriptions,rxId),its=db.items.filter(i=>i.rxId===rxId&&!i.done);
  const avail={};db.batches.forEach(b=>avail[b.id]=b.qty);
  const plan=[],short=[];
  for(const it of its){
    let need=it.qty;
    const bs=db.batches.filter(b=>b.medId===it.medId&&b.expiry>=today()).sort((a,b)=>a.expiry.localeCompare(b.expiry));
    for(const b of bs){if(need<=0)break;const take=Math.min(need,avail[b.id]);if(take>0){avail[b.id]-=take;need-=take;plan.push({it,b,take})}}
    if(need>0)short.push(`${medName(it.medId)} (short by ${need})`);
  }
  if(short.length)return form('Cannot dispense',`<p>Not enough in-date stock for: <b>${esc(short.join(', '))}</b>.</p><p class="muted small">Expired batches are never dispensed. Receive a new batch under Medications & batches, then try again.</p>`,()=>true,'Close');
  const lines=plan.map(p=>`<li>${esc(medName(p.it.medId))}: <b>${p.take}</b> from lot ${esc(p.b.lot)} <span class="muted">(exp ${p.b.expiry})</span></li>`).join('');
  form('Confirm dispensing',`<p>${rxId} for <b>${esc(pat(r.patientId).name)}</b>. Stock is taken from the earliest-expiring batch first:</p><ul>${lines}</ul>`,()=>{
    plan.forEach(p=>{p.b.qty-=p.take;db.log.push({id:nid('L'),batchId:p.b.id,itemId:p.it.id,rxId,patientId:r.patientId,qty:p.take,date:new Date().toISOString().slice(0,16).replace('T',' ')})});
    its.forEach(i=>i.done=true);r.status='Dispensed';save();render();toast(rxId+' dispensed')},'Dispense');
}

/* Medications (1) -> Batches (many) */
function stock(){
  const low=db.medications.filter(m=>stockOf(m.id)<m.reorder).length;
  const soon=db.batches.filter(b=>b.qty>0&&expState(b.expiry)[0]==='soon').length;
  const expd=db.batches.filter(b=>b.qty>0&&expState(b.expiry)[0]==='exp').length;
  $('#main').innerHTML=`<h2>Medications & batches</h2><p class="sub">Each catalog drug can sit on the shelf as several batches, each with its own lot number and expiry date.</p>
  <div class="stats"><div class="stat"><b>${db.medications.length}</b>Catalog drugs</div><div class="stat"><b>${low}</b>Below reorder level</div><div class="stat"><b>${soon}</b>Batches expiring in 90 days</div><div class="stat"><b>${expd}</b>Expired batches on shelf</div></div>
  <div class="bar">${search('Search medication or lot number')}<button class="btn alt" id="addm">Add medication</button><button class="btn" id="addb">Receive batch</button></div>
  ${db.medications.filter(m=>(m.name+m.strength+db.batches.filter(b=>b.medId===m.id).map(b=>b.lot).join(' ')).toLowerCase().includes(q.toLowerCase())).map(m=>{
    const bs=db.batches.filter(b=>b.medId===m.id).sort((a,b)=>a.expiry.localeCompare(b.expiry));const s=stockOf(m.id);
    return `<div class="card"><div class="bar" style="margin:0 0 8px"><b style="flex:1">${esc(m.name)} ${esc(m.strength)} <span class="muted small">${esc(m.form)} · ${m.id}</span></b>
    <span class="tag ${s<m.reorder?'exp':'ok'}">${s} in date${s<m.reorder?' · reorder':''}</span><button class="btn alt sm" data-editm="${m.id}">Edit drug</button></div>
    <table class="tbl small"><tr><th>Lot</th><th>Expiry</th><th>On hand</th><th>Received</th><th>Status</th><th></th></tr>
    ${bs.map(b=>{const[c,t]=expState(b.expiry);return `<tr><td>${esc(b.lot)}</td><td>${b.expiry}</td><td>${b.qty}</td><td>${b.received}</td><td><span class="tag ${c}">${t}</span></td><td><button class="btn alt sm" data-editb="${b.id}">Edit</button></td></tr>`}).join('')||'<tr><td colspan="6" class="muted">No batches received yet.</td></tr>'}</table></div>`}).join('')||'<div class="card empty">No medications found.</div>'}`;
  bindSearch();$('#addm').onclick=()=>medForm();$('#addb').onclick=()=>batchForm();
  document.querySelectorAll('[data-editm]').forEach(b=>b.onclick=()=>medForm(by(db.medications,b.dataset.editm)));
  document.querySelectorAll('[data-editb]').forEach(b=>b.onclick=()=>editBatch(by(db.batches,b.dataset.editb)));
}
function medForm(m){
  m=m&&m.id?m:null;const v=m||{};
  form(m?'Edit medication':'Add medication',fld('Drug name','name','text',v.name||'')+`<div class="grid2">${fld('Form (tablet, capsule…)','form','text',v.form||'')}${fld('Strength','strength','text',v.strength||'')}</div>`+fld('Reorder level (units)','reorder','number',v.reorder??100),f=>{
    const d=Object.fromEntries(FD(f));d.reorder=+d.reorder;
    if(m)Object.assign(m,d);else db.medications.push({id:nid('M'),...d});
    save();render();toast(m?'Medication updated':'Medication added')});
}
function editBatch(b){
  form('Edit batch '+b.id+' · '+esc(medName(b.medId)),fld('Lot number','lot','text',b.lot)+`<div class="grid2">${fld('Expiry date','expiry','date',b.expiry)}${fld('Quantity on hand','qty','number',b.qty)}</div><p class="muted small">Use this to fix typos. Past dispensing log entries keep pointing to this batch.</p>`,f=>{
    const d=Object.fromEntries(FD(f));
    if(db.batches.some(x=>x.id!==b.id&&x.medId===b.medId&&x.lot.toLowerCase()===d.lot.toLowerCase())){toast('That lot already exists for this drug');return false}
    b.lot=d.lot;b.expiry=d.expiry;b.qty=Math.max(0,+d.qty);save();render();toast('Batch updated')});
}
function batchForm(){
  if(!db.medications.length)return toast('Add a medication first');
  form('Receive batch',`<label>Medication<select name="medId">${db.medications.map(m=>`<option value="${m.id}">${esc(m.name)} ${esc(m.strength)}</option>`).join('')}</select></label>`+
   fld('Lot number','lot')+`<div class="grid2">${fld('Expiry date','expiry','date')}${fld('Quantity','qty','number','100')}</div>`,f=>{
    const d=Object.fromEntries(FD(f));
    if(db.batches.some(b=>b.medId===d.medId&&b.lot.toLowerCase()===d.lot.toLowerCase())){toast('That lot already exists for this drug');return false}
    db.batches.push({id:nid('B'),medId:d.medId,lot:d.lot,expiry:d.expiry,qty:+d.qty,received:today()});save();render();toast('Batch received')},'Receive batch');
}

/* Dispensing log + recall tracing */
function log(){
  const list=db.log.filter(l=>{const b=by(db.batches,l.batchId);return (b.lot+l.rxId+pat(l.patientId).name+medName(b.medId)).toLowerCase().includes(q.toLowerCase())}).slice().reverse();
  const pts=[...new Set(list.map(l=>l.patientId))];
  $('#main').innerHTML=`<h2>Dispensing log</h2><p class="sub">Every deduction is tied to one batch. Search a lot number to trace a recall to the patients who received it.</p>
  <div class="bar">${search('Search lot number, patient, RX ID or drug')}</div>
  ${q&&list.length?`<div class="card"><b>Recall trace:</b> ${pts.length} patient(s) matched – ${pts.map(p=>esc(pat(p).name)+' ('+esc(pat(p).phone||'')+')').join('; ')}</div>`:''}
  <div class="wrap"><table class="tbl small"><tr><th>When</th><th>Drug</th><th>Lot</th><th>Expiry</th><th>Qty</th><th>Patient</th><th>RX</th></tr>
  ${list.map(l=>{const b=by(db.batches,l.batchId);return `<tr><td>${l.date}</td><td>${esc(medName(b.medId))}</td><td>${esc(b.lot)}</td><td>${b.expiry}</td><td>${l.qty}</td><td>${esc(pat(l.patientId).name)}</td><td>${l.rxId}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty">Nothing dispensed yet. Dispense a pending prescription to see entries here.</td></tr>'}</table></div>`;
  bindSearch();
}

/* Data model */
function schema(){
  const R=[['Patients','1 : many','Prescriptions','A patient can have many prescriptions over time; each prescription belongs to exactly one patient.'],
   ['Prescriptions','1 : many','Prescription items','One visit can order several distinct drugs under a single prescription ID.'],
   ['Medications','1 : many','Inventory batches','One catalog drug can sit on shelves as many batches, each with its own lot and expiry.'],
   ['Inventory batches','1 : many','Dispensing log','Each deduction points to a specific batch, giving FEFO order and recall traceability.']];
  $('#main').innerHTML=`<h2>Data model</h2><p class="sub">How the records in this system connect.</p>
  ${R.map(r=>`<div class="card"><div class="rel"><div class="node">${r[0]}</div><div class="link">${r[1]}</div><div class="node">${r[2]}</div></div><p class="muted small" style="margin:10px 0 0">${r[3]}</p></div>`).join('')}
  <div class="card"><b>Prescription items also link to Medications</b><p class="muted small" style="margin:6px 0 0">An item names the catalog drug ordered. At dispensing time the system picks in-date batches of that drug, earliest expiry first, and writes one log row per batch used.</p></div>
  <button class="btn alt" id="reset">Reset demo data</button>`;
  $('#reset').onclick=()=>form('Reset demo data','<p>This replaces everything with the sample data.</p>',()=>{db=seed();save();render();toast('Demo data restored')},'Reset');
}
render();