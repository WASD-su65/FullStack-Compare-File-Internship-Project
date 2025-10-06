(function (global) {
  'use strict';

  const App = global.App = global.App || {};
  const { qs, qsa, _normStr, escapeHTML } = App;

  const selStatus  = qs('#selStatus')  || null;
  const selType    = qs('#selType')    || null;
  const selField   = qs('#selField')   || null;
  const searchBox  = qs('#searchBox')  || null;
  const btnApply   = qs('#btnApply')   || null;
  const btnClear   = qs('#btnClear')   || null;
  const statusMsg  = qs('#statusMsg')  || null;

  const tbody         = qs('#tbody');
  const kpiAll        = qs('#kpiAll');
  const kpiMatched    = qs('#kpiMatched');
  const kpiUnmatched  = qs('#kpiUnmatched');
  const recordsMeta   = qs('#recordsMeta');
  const btnMoreRecords= qs('#btnMoreRecords');
  const cardAll       = qs('#cardAll');
  const cardMatched   = qs('#cardMatched');
  const cardUnmatched = qs('#cardUnmatched');

  const advFiltersPanel = document.getElementById('advFiltersRecords'); // ซ่อนตั้งต้นด้วย hidden class
  const mfGlobalSearch  = document.querySelector('#viewRecords #mfGlobalSearch') || null;
  const mfStatAll       = document.querySelector('#viewRecords #mfStatAll') || null;
  const mfStatFound     = document.querySelector('#viewRecords #mfStatFound') || null;
  const mfStatUnmatched = document.querySelector('#viewRecords #mfStatUnmatched') || null;
  const mfClearAll      = document.querySelector('#viewRecords #mfClearAll') || null;

  const mfCustomerInput = document.querySelector('#viewRecords #mfCustomer') || null;
  const mfCustomerAdd   = document.querySelector('#viewRecords #mfCustomerAdd') || null;
  const mfCustomerChips = document.querySelector('#viewRecords #mfCustomerChips') || null;

  const mfProvinceInput = document.querySelector('#viewRecords #mfProvince') || null;
  const mfProvinceAdd   = document.querySelector('#viewRecords #mfProvinceAdd') || null;
  const mfProvinceChips = document.querySelector('#viewRecords #mfProvinceChips') || null;

  const mfTypeInput     = document.querySelector('#viewRecords #mfType') || null;
  const mfTypeAdd       = document.querySelector('#viewRecords #mfTypeAdd') || null;
  const mfTypeChips     = document.querySelector('#viewRecords #mfTypeChips') || null;

  let __mfStatus = '';        // '', 'Found', 'Unmatched'
  let __inlineSearch = '';    // ข้อความค้นหาเมื่อไม่มี searchBox เก่า

  function getStatusFilter() {
    return selStatus ? (selStatus.value || '') : (__mfStatus || '');
  }
  function setStatusFilter(v) {
    if (selStatus) selStatus.value = v || '';
    __mfStatus = v || '';
  }
  function getSearchQuery() {
    if (searchBox) return (searchBox.value || '').trim().toLowerCase();
    return (__inlineSearch || '').trim().toLowerCase();
  }

  const MF = App.MF = App.MF || {
    customers: new Set(),
    provinces: new Set(),
    types:     new Set(),
  };

  App.populateLookups = (recs)=>{
    const provs=new Set(), custs=new Set(), types=new Set();
    for(const r of recs){
      const c=_normStr(r.customer); if(c) custs.add(c);
      const p=_normStr(r.province); if(p) provs.add(p);
      const t=_normStr(r.service_category ?? r.type ?? ''); if(t) types.add(t);
    }
    const sortedProvs=[...provs].sort((a,b)=>a.localeCompare(b));
    const sortedCusts=[...custs].sort((a,b)=>a.localeCompare(b));
    const sortedTypes=[...types].sort((a,b)=>a.localeCompare(b));

    const put = (sel, arr)=>{
      const el = qs(sel);
      if (!el) return;
      el.innerHTML = '';
      const fragment = document.createDocumentFragment();
      arr.forEach(v => {
        const option = document.createElement('option');
        option.value = v;
        option.textContent = v;
        fragment.appendChild(option);
      });
      el.appendChild(fragment);
    };
    put('#dlProvincesSummaryMulti', sortedProvs);
    put('#dlProvincesReport',       sortedProvs);
    put('#dlCustomers',             sortedCusts);
    const dlTypes = qs('#dlTypes');
    if (dlTypes) {
      dlTypes.innerHTML = '';
      const fragment = document.createDocumentFragment();
      sortedTypes.forEach(v => {
        const option = document.createElement('option');
        option.value = v;
        option.textContent = v;
        fragment.appendChild(option);
      });
      dlTypes.appendChild(fragment);
    }
  };

  App.applyFilters = (resetPaging=false)=>{
    const q = getSearchQuery();
    const field = selField ? selField.value : 'all';
    const status = getStatusFilter();
    const typSel = selType ? selType.value : '';

    const rows = (App.allRecords || []).filter(r=>{
      if (status && r.status !== status) return false;

      if (typSel) {
        const cat = _normStr(r.service_category ?? r.type ?? '');
        if (cat !== typSel) return false;
      }

      if (MF.customers.size && !MF.customers.has(r.customer)) return false;
      if (MF.provinces.size && !MF.provinces.has(r.province)) return false;
      if (MF.types.size) {
        const cat = _normStr(r.service_category ?? r.type ?? '');
        if (!MF.types.has(cat)) return false;
      }

      if (!q) return true;
      const read = (k)=> (k==='type' ? _normStr(r.service_category ?? r.type ?? '').toLowerCase()
                                     : (_normStr(r[k]) || '').toLowerCase());
      if (field === 'all') {
        return ['customer','project','province','type','circuit_number','branch','sla']
          .some(k=>read(k).includes(q))
          || ((_normStr(r.circuit_norm)||'').toLowerCase().includes(q));
      }
      return read(field).includes(q);
    });

    App.filtered = rows;
    App.RECORDS_FILTERED_CACHE = rows;
    if (resetPaging) App.RECORDS_SHOWN = 0;

    renderRecordsPaged();
    recomputeFacetOptions(App.allRecords || []);
    renderMfChips();
    renderKPIs();
    updateKPIActive();
  };

  App.loadRecordsLive = async (jobId)=>{
    try{
      if (advFiltersPanel) advFiltersPanel.classList.add('hidden');   // ซ่อนระหว่างโหลด
      if (statusMsg) statusMsg.textContent='โหลด Records...';

      App.allRecords = await App.fetchRecordsAll(jobId);

      App.populateLookups(App.allRecords);
      App.RECORDS_SHOWN = 0; App.applyFilters(true);
      App.SUM_SHOWN = 0; App.buildAndRenderSummary();
      await App.rebuildAndRenderReport();

      if (advFiltersPanel) {
        advFiltersPanel.classList.remove('hidden');
        advFiltersPanel.style.display = 'grid';
      }
      if (statusMsg) statusMsg.textContent='พร้อม';
    }catch(e){
      if (advFiltersPanel) {
        advFiltersPanel.classList.add('hidden');
        advFiltersPanel.style.display = 'none';
      }
      if (statusMsg) statusMsg.textContent='load error: '+ (e?.message || e);
      console.error(e);
    }
  };

  function updateKPIActive(){
    const s = getStatusFilter();
    if (cardAll)      cardAll.classList.toggle('active', !s);
    if (cardMatched)  cardMatched.classList.toggle('active', s==='Found');
    if (cardUnmatched)cardUnmatched.classList.toggle('active', s==='Unmatched');
  }
  App.updateKPIActive = updateKPIActive;

  let searchTimer = null;
  if (btnApply) btnApply.onclick = ()=> App.applyFilters(true);
  if (btnClear) btnClear.onclick = ()=>{
    setStatusFilter('');
    if (selType)  selType.value  = '';
    if (selField) selField.value = 'all';
    if (searchBox) searchBox.value = '';
    __inlineSearch = '';
    MF.customers.clear(); MF.provinces.clear(); MF.types.clear();
    if (mfGlobalSearch) mfGlobalSearch.value='';
    renderMfChips();
    App.applyFilters(true);
  };
  if (selStatus) selStatus.onchange = ()=> App.applyFilters(true);
  if (selType)   selType.onchange   = ()=> App.applyFilters(true);
  if (selField)  selField.onchange  = ()=> App.applyFilters(true);
  if (searchBox) searchBox.oninput  = ()=>{
    __inlineSearch = (searchBox.value || '');
    clearTimeout(searchTimer);
    searchTimer = setTimeout(()=>App.applyFilters(true), 180);
  };

  if (cardAll)      cardAll.addEventListener('click', ()=>{ setStatusFilter('');         App.applyFilters(true); });
  if (cardMatched)  cardMatched.addEventListener('click', ()=>{ setStatusFilter('Found');     App.applyFilters(true); });
  if (cardUnmatched)cardUnmatched.addEventListener('click', ()=>{ setStatusFilter('Unmatched'); App.applyFilters(true); });

  if (mfGlobalSearch){
    mfGlobalSearch.addEventListener('input', ()=>{
      __inlineSearch = (mfGlobalSearch.value || '');
      if (searchBox) searchBox.value = __inlineSearch; // sync ถ้ามี
      clearTimeout(searchTimer);
      searchTimer = setTimeout(()=>App.applyFilters(true), 180);
    });
  }
  if (mfStatAll)       mfStatAll.addEventListener('click',      ()=>{ setStatusFilter('');         App.applyFilters(true); });
  if (mfStatFound)     mfStatFound.addEventListener('click',    ()=>{ setStatusFilter('Found');     App.applyFilters(true); });
  if (mfStatUnmatched) mfStatUnmatched.addEventListener('click',()=>{ setStatusFilter('Unmatched'); App.applyFilters(true); });
  if (mfClearAll)      mfClearAll.addEventListener('click', ()=>{
    setStatusFilter(''); 
    if (selType)  selType.value  = '';
    if (selField) selField.value = 'all';
    if (searchBox) searchBox.value = '';
    __inlineSearch = '';
    MF.customers.clear(); MF.provinces.clear(); MF.types.clear();
    renderMfChips();
    App.applyFilters(true);
  });

  if (mfCustomerAdd) mfCustomerAdd.addEventListener('click', ()=>{
    const v = (mfCustomerInput?.value || '').trim();
    if (v) MF.customers.add(v);
    if (mfCustomerInput) mfCustomerInput.value='';
    renderMfChips(); App.applyFilters(true);
  });
  if (mfProvinceAdd) mfProvinceAdd.addEventListener('click', ()=>{
    const v = (mfProvinceInput?.value || '').trim();
    if (v) MF.provinces.add(v);
    if (mfProvinceInput) mfProvinceInput.value='';
    renderMfChips(); App.applyFilters(true);
  });
  if (mfTypeAdd) mfTypeAdd.addEventListener('click', ()=>{
    const v = (mfTypeInput?.value || '').trim();
    if (v) MF.types.add(v);
    if (mfTypeInput) mfTypeInput.value='';
    renderMfChips(); App.applyFilters(true);
  });

  function renderMfChips(){
    drawChipList(mfCustomerChips, MF.customers, (v)=>{ MF.customers.delete(v); App.applyFilters(true); });
    drawChipList(mfProvinceChips, MF.provinces, (v)=>{ MF.provinces.delete(v); App.applyFilters(true); });
    drawChipList(mfTypeChips,     MF.types,     (v)=>{ MF.types.delete(v);     App.applyFilters(true); });
  }
  function drawChipList(container, setObj, onRemove){
    if(!container) return;
    container.innerHTML='';
    const frag=document.createDocumentFragment();
    Array.from(setObj).forEach(val=>{
      const chip=document.createElement('button');
      chip.type='button';
      chip.className='chip';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = val;
      const x = document.createElement('span');
      x.className = 'x';
      x.textContent = '×';
      chip.appendChild(label);
      chip.appendChild(x);
      chip.addEventListener('click', ()=>onRemove(val));
      frag.appendChild(chip);
    });
    container.appendChild(frag);
  }

  function recomputeFacetOptions(rows){
    const cust=new Set(), prov=new Set(), typ=new Set();
    (rows||[]).forEach(r=>{
      if (r.customer) cust.add(r.customer);
      if (r.province) prov.add(r.province);
      const t=_normStr(r.service_category ?? r.type ?? ''); if(t) typ.add(t);
    });
    const availCust=[...cust].filter(v=>!MF.customers.has(v)).sort((a,b)=>a.localeCompare(b));
    const availProv=[...prov].filter(v=>!MF.provinces.has(v)).sort((a,b)=>a.localeCompare(b));
    const availType=[...typ ].filter(v=>!MF.types.has(v)).sort((a,b)=>a.localeCompare(b));

    const put=(sel, arr)=>{
      const el=qs(sel); if(!el) return;
      el.innerHTML = '';
      const fragment = document.createDocumentFragment();
      arr.forEach(v => {
        const option = document.createElement('option');
        option.value = v;
        option.textContent = v;
        fragment.appendChild(option);
      });
      el.appendChild(fragment);
    };
    put('#dlCustomers',             availCust);
    put('#dlProvincesSummaryMulti', availProv);
    put('#dlProvincesReport',       availProv);
    const dlTypes = qs('#dlTypes');
    if (dlTypes) {
      dlTypes.innerHTML = '';
      const fragment = document.createDocumentFragment();
      availType.forEach(v => {
        const option = document.createElement('option');
        option.value = v;
        option.textContent = v;
        fragment.appendChild(option);
      });
      dlTypes.appendChild(fragment);
    }
  }

  function renderKPIs(){
    const rows = App.RECORDS_FILTERED_CACHE || [];
    if (kpiAll)       kpiAll.textContent       = rows.length;
    if (kpiMatched)   kpiMatched.textContent   = rows.filter(r=>r.status==='Found').length;
    if (kpiUnmatched) kpiUnmatched.textContent = rows.filter(r=>r.status==='Unmatched').length;
  }

  function renderRecordsPaged(){
    const rows = App.RECORDS_FILTERED_CACHE || [];
    if (App.RECORDS_SHOWN === 0 && tbody) tbody.innerHTML='';

    const total  = rows.length;
    const remain = Math.max(0, total - (App.RECORDS_SHOWN || 0));
    const take   = Math.min(App.RECORDS_STEP || 200, remain);
    const slice  = rows.slice(App.RECORDS_SHOWN || 0, (App.RECORDS_SHOWN || 0)+take);

    const base = App.RECORDS_SHOWN || 0;
    let i=0, chunk=50;

    function paint(){
      const stop = Math.min(i+chunk, slice.length);
      for(; i<stop; i++){
        const r = slice[i];
        const cir   = _normStr(r.circuit_number ?? r.circuit_norm ?? r.circuit ?? '—');
        const branch= _normStr(r.branch ?? r.project ?? '—');
        const sla   = _normStr(r.sla ?? '—');
        const cust  = _normStr(r.customer ?? '—');
        const prov  = _normStr(r.province ?? '—');
        const typ   = _normStr(r.service_category ?? r.type ?? '—');

        const tr = document.createElement('tr');
        
        const cells = [
          base + i + 1,
          cir, branch, sla, cust, prov, typ
        ];
        
        cells.forEach(content => {
          const td = document.createElement('td');
          td.textContent = content;
          tr.appendChild(td);
        });
        
        const statusTd = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = r.status === 'Found' ? 'badge ok' : 'badge warn';
        badge.textContent = r.status === 'Found' ? 'Matched' : 'Unmatched';
        statusTd.appendChild(badge);
        tr.appendChild(statusTd);
        
        if (tbody) tbody.appendChild(tr);
      }
      if (i<slice.length) requestAnimationFrame(paint);
    }
    requestAnimationFrame(paint);

    App.RECORDS_SHOWN = base + take;
    if (recordsMeta) recordsMeta.textContent = `${Math.min(App.RECORDS_SHOWN, total)}/${total}`;
    if (btnMoreRecords) btnMoreRecords.disabled = (App.RECORDS_SHOWN >= total);
  }
  if (btnMoreRecords) btnMoreRecords.onclick = ()=> renderRecordsPaged();

})(window);
