(function (global) {
  const App = global.App = global.App || {};
  const { qs, API_BASE, showLoading, hideLoading } = App;

  App.uploadCompare = async ()=>{
    const fd = new FormData();
    if(qs('#fileMaster').files.length) fd.append('master_file', qs('#fileMaster').files[0]);
    fd.append('compare_file', qs('#fileCompare').files[0]);
    const r=await fetch(`${API_BASE}/compare-upload`,{method:'POST',body:fd});
    if(!r.ok){
      let msg = await r.text(); try{ const j=JSON.parse(msg); msg=j.detail||msg; }catch{}
      throw new Error(msg || `HTTP ${r.status}`);
    }
  };

  App.fetchJobs = async ()=>{
    const r=await fetch(`${API_BASE}/jobs`);
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  };

  App.fetchRecords = async (jobId)=>{
    const r=await fetch(`${API_BASE}/jobs/${jobId}/records?page_size=10000`);
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  };

  App.fetchRecordsAll = async (jobId)=>{
    let allRecords = [];
    let page = 1;
    const pageSize = 10000;
    
    while (true) {
      const r = await fetch(`${API_BASE}/jobs/${jobId}/records?page=${page}&page_size=${pageSize}`);
      if (!r.ok) throw new Error(await r.text());
      const records = await r.json();
      
      if (records.length === 0) break;
      allRecords = allRecords.concat(records);
      
      if (records.length < pageSize) break;
      page++;
    }
    
    return allRecords;
  };

  App.adminCheck = async (token)=>{
    const res = await fetch(`${API_BASE}/admin/check`, {
      headers: { 'X-Admin-Token': token }
    });
    if(!res.ok) return false;
    const data = await res.json().catch(()=>({ok:false}));
    return !!data.ok;
  };

  App.togglePin = async (jobId, newState)=>{
    const res = await fetch(`${API_BASE}/jobs/${jobId}/pin`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ pinned: newState })
    });
    if(!res.ok) throw new Error(await res.text());
  };

  App.adminBulkDelete = async (token, ids)=>{
    const res = await fetch(`${API_BASE}/admin/jobs/bulk`, {
      method: 'DELETE', 
      headers: { 
        'Content-Type': 'application/json',
        'X-Admin-Token': token
      },
      body: JSON.stringify({ job_ids: ids })
    });
    if(!res.ok) throw new Error(await res.text());
    return res.json();
  };

})(window);
