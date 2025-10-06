(function (global) {
  const App = global.App = global.App || {};
  const { qs, qsa, fmtBangkok, parseAPIDate, isValidDate, fetchJobs, fetchRecords, togglePin, adminCheck } = App;

  const jobsList=qs('#jobsList'), jobCount=qs('#jobCount');
  const jobDateFrom=qs('#jobDateFrom'), jobDateTo=qs('#jobDateTo');
  const btnJobFilter=qs('#btnJobFilter'), btnJobClear=qs('#btnJobClear');
  const btnJobsMore=qs('#btnJobsMore'), jobsMeta=qs('#jobsMeta');

  const adminToken=qs('#adminToken'), btnAdminToggle=qs('#btnAdminToggle'), adminStatus=qs('#adminStatus'), btnBulkDelete=qs('#btnBulkDelete');
  let ADMIN_MODE=false, ADMIN_TOKEN_VAL='';

  App.loadJobs = async ()=>{
    jobsList.innerHTML='<li class="small">กำลังโหลด...</li>';
    
    const recordsFilter = App.qs('#advFiltersRecords');
    const summaryFilter = App.qs('#advFilters');
    if (recordsFilter) {
      recordsFilter.classList.add('hidden');
      recordsFilter.style.display = 'none';
    }
    if (summaryFilter) {
      summaryFilter.classList.add('hidden');
      summaryFilter.style.display = 'none';
    }
    
    try{
      const jobs = await fetchJobs();
      App.JOBS_ALL = jobs || [];
      jobCount.textContent=`${App.JOBS_ALL.length} jobs`;
      App.applyJobsFilter(true);
    }catch(e){
      jobsList.innerHTML=`<li class="small">Error: ${App.escapeHTML(e.message||'unknown')}</li>`;
    }
  };

  App.applyJobsFilter = (resetShown=false)=>{
    const from = jobDateFrom.value ? new Date(jobDateFrom.value+'T00:00:00') : null;
    const to   = jobDateTo.value   ? new Date(jobDateTo.value+'T23:59:59.999') : null;

    App.JOBS_FILTERED = App.JOBS_ALL.filter(j=>{
      const dt = parseAPIDate(j.created_at);
      if(from && (!isValidDate(dt) || dt < from)) return false;
      if(to && (!isValidDate(dt) || dt > to)) return false;
      return true;
    });

    App.JOBS_FILTERED.sort((a,b)=>{
      const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
      if(pb!==pa) return pb - pa;
      const da=parseAPIDate(a.created_at), db=parseAPIDate(b.created_at);
      const at=isValidDate(da)?da.getTime():-Infinity;
      const bt=isValidDate(db)?db.getTime():-Infinity;
      if(bt!==at) return bt - at;
      return (b.job_id||0)-(a.job_id||0);
    });

    if(resetShown) App.JOBS_SHOWN = 0;
    renderJobs(true);
  };

  function renderJobs(forceReset=false){
    if(forceReset) { jobsList.innerHTML=''; App.JOBS_SHOWN=0; }
    const remain = Math.max(0, App.JOBS_FILTERED.length - App.JOBS_SHOWN);
    const take = Math.min(App.JOBS_STEP, remain);
    const slice = App.JOBS_FILTERED.slice(App.JOBS_SHOWN, App.JOBS_SHOWN + take);

    slice.forEach(j=>{
      const li=document.createElement('li');
      li.className = (App.currentJob===j.job_id) ? 'active' : '';
      const ts = fmtBangkok(j.created_at);
      const pinLabel = j.pinned ? '⭐' : '☆';
      const chk = ADMIN_MODE ? `<input type="checkbox" class="job-select" data-job="${j.job_id}" style="margin-right:8px">` : '';
      li.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            ${chk}
            <strong>Job #${j.job_id}</strong>
            <button class="pin-btn" data-job="${j.job_id}" title="Pin/Unpin" style="padding:2px 8px">${pinLabel}</button>
          </div>
          <div class="small" style="color:#9aa6b2">${ts}</div>
        </div>
        <div class="small">Records: ${j.total_records} · Matched: ${j.matched_total} · Unmatched: ${j.unmatched_total}</div>
      `;
      li.addEventListener('click', ()=>App.selectJob(j.job_id, li));
      const pinBtn = li.querySelector('.pin-btn');
      if(pinBtn){ pinBtn.addEventListener('click', (e)=>{ e.stopPropagation(); App.togglePinJob(j.job_id, !j.pinned); }); }
      const cb = li.querySelector('.job-select');
      if(cb){ cb.addEventListener('click', (e)=>{ e.stopPropagation(); }); }
      jobsList.appendChild(li);
    });

    App.JOBS_SHOWN += take;
    jobsMeta.textContent = `${App.JOBS_FILTERED.length ? App.JOBS_SHOWN : 0}/${App.JOBS_FILTERED.length}`;
    btnJobsMore.disabled = (App.JOBS_SHOWN >= App.JOBS_FILTERED.length);
  }
  btnJobsMore.onclick = ()=> renderJobs();

  App.togglePinJob = async (jobId, newState)=>{
    try{ await togglePin(jobId, newState); await App.loadJobs(); }
    catch(e){ console.error('แก้ PIN ไม่สำเร็จ:', e.message); }
  };

  App.selectJob = async (jobId, li)=>{
    App.currentJob=jobId;
    qsa('#jobsList li').forEach(el=>el.classList.remove('active'));
    if(li) li.classList.add('active');

    qs('#btnExportXLSX').disabled=false; 
    qs('#btnExportSummary').disabled=false;

    await App.loadRecordsLive(jobId);
  };

  btnAdminToggle.onclick = async ()=>{
    if(ADMIN_MODE){ ADMIN_TOKEN_VAL=''; adminToken.value=''; setAdminUI(false,'ปิดโหมด'); return; }
    const token=(adminToken.value||'').trim();
    const ok=token ? await adminCheck(token) : false;
    if(ok){ ADMIN_TOKEN_VAL=token; setAdminUI(true,'Token ถูกต้อง'); }
  };
  function setAdminUI(enabled, msg){
    ADMIN_MODE = enabled;
    adminStatus.textContent = `Admin mode: ${enabled ? 'ON' : 'OFF'}${msg? ' — ' + msg : ''}`;
    btnBulkDelete.disabled = !enabled;
    btnAdminToggle.textContent = enabled ? 'Disable' : 'Enable';
    renderJobs(true);
  }

  btnBulkDelete.onclick = async ()=>{
    const ids = Array.from(qsa('.job-select:checked')).map(cb=>parseInt(cb.dataset.job,10)).filter(Boolean);
    if(!confirm(`ยืนยันลบ ${ids.length} jobs? (ข้ามที่ pinned)`)) return;
    try{
      const data = await App.adminBulkDelete(ADMIN_TOKEN_VAL, ids);
      await App.loadJobs();
    }catch(e){ console.error('ลบล้มเหลว:', e.message); }
  };

  btnJobFilter.onclick = ()=> App.applyJobsFilter(true);
  btnJobClear.onclick  = ()=>{ jobDateFrom.value=''; jobDateTo.value=''; App.applyJobsFilter(true); };

})(window);
