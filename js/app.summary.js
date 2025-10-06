(function (global) {
  'use strict';

  const App = global.App = global.App || {};
  const { qs, _normStr, escapeHTML } = App;

  const viewSummary       = qs('#viewSummary');
  if (!viewSummary) return;

  const tbodySummary      = qs('#tbodyOurSummary');
  const summaryMeta       = qs('#summaryMeta');
  const btnMoreSummary    = qs('#btnMoreSummary');
  const sumStatusMsg      = qs('#sumStatusMsg'); // อาจไม่มีแล้ว ไม่เป็นไร

  const smGlobalSearch    = viewSummary.querySelector('#mfGlobalSearch');
  const smCustomerInput   = viewSummary.querySelector('#mfCustomer');
  const smCustomerChips   = viewSummary.querySelector('#mfCustomerChips');
  const smProvinceInput   = viewSummary.querySelector('#mfProvince');
  const smProvinceChips   = viewSummary.querySelector('#mfProvinceChips');
  const smTypeInput       = viewSummary.querySelector('#mfType');
  const smTypeChips       = viewSummary.querySelector('#mfTypeChips');

  const dlCustomersSummary= viewSummary.querySelector('#dlCustomers');
  const dlProvSummary     = viewSummary.querySelector('#dlProvincesSummaryMulti');
  const dlTypesSummary    = viewSummary.querySelector('#dlTypes');

  App.SUM_STEP = App.SUM_STEP || 300;
  const SMF = App.SUMMARY_MF = App.SUMMARY_MF || {
    customers: new Set(),
    provinces: new Set(),
    types:     new Set(),
    globalQ:   ''
  };

  const norm = (v)=> _normStr ? _normStr(v) : (v==null?'':String(v).trim());
  function serviceTypeOf(r){
    const raw = norm(r.service_category ?? r.type ?? '');
    if (typeof App.categorizeService === 'function') return App.categorizeService(raw);
    return raw;
  }
  function circuitOf(r){
    return norm(r.circuit_number) || norm(r.circuit_norm) || norm(r.circuit) || '—';
  }

  function blinkExistingChip(container, value){
    if (!container) return;
    const chip = [...container.querySelectorAll('.chip')].find(ch => (ch.dataset.val||'') === value);
    if (!chip) return;
    chip.classList.remove('pulse');
    void chip.offsetWidth;
    chip.classList.add('pulse');
  }

  function recomputeSummaryFacetOptions(rows){
    const custSet=new Set(), provSet=new Set(), typeSet=new Set();

    (rows||[]).forEach(r=>{
      const st = (r?.status ?? '').toString().trim().toLowerCase();
      if (st === 'unmatched') return;
      const c = norm(r.customer); if (c) custSet.add(c);
      const p = norm(r.province); if (p) provSet.add(p);
      const t = serviceTypeOf(r); if (t) typeSet.add(t);
    });

    const availCust = [...custSet].filter(v=>!SMF.customers.has(v)).sort((a,b)=>a.localeCompare(b));
    const availProv = [...provSet].filter(v=>!SMF.provinces.has(v)).sort((a,b)=>a.localeCompare(b));
    const availType = [...typeSet].filter(v=>!SMF.types.has(v)).sort((a,b)=>a.localeCompare(b));

    if (dlCustomersSummary) dlCustomersSummary.innerHTML = availCust.map(v=>`<option value="${escapeHTML(v)}">`).join('');
    if (dlProvSummary)      dlProvSummary.innerHTML      = availProv.map(v=>`<option value="${escapeHTML(v)}">`).join('');
    if (dlTypesSummary)     dlTypesSummary.innerHTML     = availType.map(v=>`<option value="${escapeHTML(v)}">`).join('');
  }

  App.rebuildSummaryRows = ()=>{
    const provAllow = new Set([...SMF.provinces]);
    const hasProv   = provAllow.size > 0;
    const hasCust   = SMF.customers.size > 0;
    const hasType   = SMF.types.size > 0;
    const q         = (SMF.globalQ || '').trim().toLowerCase();

    const map = new Map(); // key: cust|prov|type -> {cust,prov,typeText,count,cirText}
    for (const r of (App.allRecords || [])){
      const st = (r?.status ?? '').toString().trim().toLowerCase();
      if (st === 'unmatched') continue;

      const cust = norm(r.customer) || '—';
      const prov = norm(r.province) || '—';
      const typeText = serviceTypeOf(r) || '—';

      if (hasCust && !SMF.customers.has(cust)) continue;
      if (hasProv && !provAllow.has(prov)) continue;
      if (hasType && !SMF.types.has(typeText)) continue;

      if (q){
        const hay = [
          cust, prov, typeText, circuitOf(r),
          norm(r.project)||'', norm(r.branch)||'', norm(r.sla)||'', norm(r.status)||''
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) continue;
      }

      const key = `${cust}|${prov}|${typeText}`;
      let row = map.get(key);
      if (!row){
        row = { cust, prov, typeText, circuits: new Set() };
        map.set(key, row);
      }
      row.circuits.add(circuitOf(r));
    }

    const out = [...map.values()]
      .map(row=>{
        const cirList = [...row.circuits].sort((a,b)=>a.localeCompare(b));
        return {
          cust: row.cust,
          prov: row.prov,
          typeText: row.typeText,
          count: cirList.length,
          cirText: cirList.join(', ')
        };
      })
      .sort((a,b)=>{
        if (a.cust !== b.cust) return a.cust.localeCompare(b.cust);
        if (a.prov !== b.prov) return a.prov.localeCompare(b.prov);
        return a.typeText.localeCompare(b.typeText);
      });

    App.SUMMARY_CACHE_ROWS = out;
    App.SUM_SHOWN = 0;
  };

  function renderSummaryPaged(){
    const rows = App.SUMMARY_CACHE_ROWS || [];
    if ((App.SUM_SHOWN||0) === 0 && tbodySummary) tbodySummary.innerHTML = '';

    const total  = rows.length;
    const remain = Math.max(0, total - (App.SUM_SHOWN||0));
    const take   = Math.min(App.SUM_STEP || 300, remain);
    const slice  = rows.slice(App.SUM_SHOWN||0, (App.SUM_SHOWN||0) + take);

    const base = App.SUM_SHOWN || 0;
    let i=0, chunk=50;

    function paint(){
      const end = Math.min(i+chunk, slice.length);
      for(; i<end; i++){
        const r = slice[i];
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td class="c">${base+i+1}</td>
           <td>${escapeHTML(r.cust||'')}</td>
           <td>${escapeHTML(r.prov||'')}</td>
           <td>${escapeHTML(r.typeText||'')}</td>
           <td class="c">${r.count ?? 0}</td>
           <td class="mono">${escapeHTML(r.cirText||'')}</td>`;
        tbodySummary.appendChild(tr);
      }
      if (i<slice.length) requestAnimationFrame(paint);
    }
    requestAnimationFrame(paint);

    App.SUM_SHOWN = base + take;
    if (summaryMeta) summaryMeta.textContent = `${Math.min(App.SUM_SHOWN, total)}/${total}`;
    if (btnMoreSummary) btnMoreSummary.disabled = (App.SUM_SHOWN >= total);
  }
  if (btnMoreSummary) btnMoreSummary.addEventListener('click', renderSummaryPaged);


  function buildAndRenderSummary(){
    try{
      if (sumStatusMsg) sumStatusMsg.textContent = 'กำลังคำนวณ…';
      recomputeSummaryFacetOptions(App.allRecords || []);
      App.rebuildSummaryRows();            // ← ให้ export.js เรียกตัวเดียวกันได้
      renderSummaryPaged();
      
      const advFilters = qs('#advFilters');
      if (advFilters && App.allRecords && App.allRecords.length > 0) {
        advFilters.classList.remove('hidden');
        advFilters.style.display = 'grid';
      }
      
      if (sumStatusMsg) sumStatusMsg.textContent = 'พร้อม';
    }catch(e){
      if (sumStatusMsg) sumStatusMsg.textContent = 'เกิดข้อผิดพลาด: '+(e?.message||e);
      console.error(e);
    }
  }
  App.buildAndRenderSummary = buildAndRenderSummary;

  function drawChipList(container, setObj, onRemove){
    if(!container) return;
    container.innerHTML='';
    const frag=document.createDocumentFragment();
    [...setObj].forEach(val=>{
      const chip = document.createElement('button');
      chip.type='button';
      chip.className='chip';
      chip.dataset.val = val;
      chip.innerHTML = `<span class="label">${escapeHTML(val)}</span><span class="x">×</span>`;
      chip.addEventListener('click', ()=>{
        onRemove(val);
        drawSmfChips();               // ลบแล้วหายทันที (ข้อ 2)
        buildAndRenderSummary();
      });
      frag.appendChild(chip);
    });
    container.appendChild(frag);
  }
  function drawSmfChips(){
    drawChipList(smCustomerChips, SMF.customers, (v)=> SMF.customers.delete(v));
    drawChipList(smProvinceChips, SMF.provinces, (v)=> SMF.provinces.delete(v));
    drawChipList(smTypeChips,     SMF.types,     (v)=> SMF.types.delete(v));
  }

  viewSummary.addEventListener('click', (e)=>{
    const btn = e.target.closest('#mfCustomerAdd, #mfProvinceAdd, #mfTypeAdd, #mfClearAll, #mfStatAll');
    if (!btn) return;
    e.preventDefault();

    if (btn.id === 'mfCustomerAdd'){
      const v = norm(smCustomerInput?.value);
      if (!v) return;
      if (SMF.customers.has(v)) { blinkExistingChip(smCustomerChips, v); return; } // กันซ้ำ (ข้อ 1)
      SMF.customers.add(v);
      if (smCustomerInput) smCustomerInput.value='';
      drawSmfChips();
      buildAndRenderSummary();
      return;
    }
    if (btn.id === 'mfProvinceAdd'){
      const v = norm(smProvinceInput?.value);
      if (!v) return;
      if (SMF.provinces.has(v)) { blinkExistingChip(smProvinceChips, v); return; } // กันซ้ำ
      SMF.provinces.add(v);
      if (smProvinceInput) smProvinceInput.value='';
      drawSmfChips();
      buildAndRenderSummary();
      return;
    }
    if (btn.id === 'mfTypeAdd'){
      const v = norm(smTypeInput?.value);
      if (!v) return;
      if (SMF.types.has(v)) { blinkExistingChip(smTypeChips, v); return; } // กันซ้ำ
      SMF.types.add(v);
      if (smTypeInput) smTypeInput.value='';
      drawSmfChips();
      buildAndRenderSummary();
      return;
    }
    if (btn.id === 'mfClearAll'){
      SMF.customers.clear(); SMF.provinces.clear(); SMF.types.clear(); SMF.globalQ='';
      drawSmfChips();
      if (smGlobalSearch) smGlobalSearch.value='';
      buildAndRenderSummary();
      return;
    }
    if (btn.id === 'mfStatAll'){
      if (smGlobalSearch) smGlobalSearch.value='';
      SMF.globalQ='';
      buildAndRenderSummary();
      return;
    }
  });

  viewSummary.addEventListener('keydown', (e)=>{
    if (e.key !== 'Enter' || !e.target || e.target.tagName !== 'INPUT') return;
    const tgt = e.target;
    if (tgt === smCustomerInput){
      const v = norm(tgt.value); if (!v) return;
      if (SMF.customers.has(v)) { blinkExistingChip(smCustomerChips, v); return; }
      SMF.customers.add(v); tgt.value='';
    }else if (tgt === smProvinceInput){
      const v = norm(tgt.value); if (!v) return;
      if (SMF.provinces.has(v)) { blinkExistingChip(smProvinceChips, v); return; }
      SMF.provinces.add(v); tgt.value='';
    }else if (tgt === smTypeInput){
      const v = norm(tgt.value); if (!v) return;
      if (SMF.types.has(v)) { blinkExistingChip(smTypeChips, v); return; }
      SMF.types.add(v); tgt.value='';
    }else{
      return;
    }
    drawSmfChips();
    buildAndRenderSummary();
  });

  if (smGlobalSearch){
    let t=null;
    smGlobalSearch.addEventListener('input', ()=>{
      SMF.globalQ = smGlobalSearch.value || '';
      clearTimeout(t);
      t = setTimeout(()=>buildAndRenderSummary(), 150);
    });
  }

  App.onJobLoadedForSummary = ()=>{
    recomputeSummaryFacetOptions(App.allRecords || []);
    drawSmfChips();
  };

  if (Array.isArray(App.allRecords) && App.allRecords.length){
    App.onJobLoadedForSummary();
    buildAndRenderSummary();
  }

})(window);
