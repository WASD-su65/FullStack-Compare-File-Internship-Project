(function (global) {
  const App = global.App = global.App || {};

  App.ensurePngPdfLibs = async ()=>{
    await App.loadScriptOnce('/static/lib/html2canvas.min.js');
    await App.loadScriptOnce('/static/lib/jspdf.umd.min.js');
  };

  App.ensureXlsxLib = async ()=>{
    await App.loadScriptOnce('/static/lib/xlsx.full.min.js');
  };

  App.isSummaryActive = ()=>{
    const tabSummary = App.qs('#tabSummary'), viewSummary = App.qs('#viewSummary');
    return tabSummary.classList.contains('active') && !viewSummary.classList.contains('hidden');
  };
  App.isReportActive = ()=>{
    const tabReport = App.qs('#tabReport'), viewReport = App.qs('#viewReport');
    return tabReport.classList.contains('active') && !viewReport.classList.contains('hidden');
  };

  App.exportXLSX = async ()=>{
    await App.ensureXlsxLib();

    if(App.isReportActive()){
      const rep = App.reportFrom(App.allRecords);
      const rows=[{
        'จำนวนลูกค้า': rep.customers,
        'จำนวนเหตุเสีย': rep.circuits,
        'Data': rep.services.Data || 0,
        'Broadband': rep.services.Broadband || 0,
        'Voice': rep.services.Voice || 0,
        'จังหวัด': (rep.provinceCounts||[]).map(x=>`${x.province}(${x.count})`).join(', ')
      }];
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ReportSummary');
      XLSX.writeFile(wb, `compare_report_summary_${App.currentJob || 'latest'}_${App.nowTag()}.xlsx`);
    }else if(App.isSummaryActive()){
      App.rebuildSummaryRows();
      const rows = App.SUMMARY_CACHE_ROWS.map((r,idx)=>({
        '#': idx+1, 'ลูกค้า': r.cust || '', 'จังหวัด': r.prov || '',
        'ประเภท': r.typeText || '', 'จำนวนวงจร': r.count ?? 0, 'เลขวงจร': r.cirText || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Summary(Web)');
      XLSX.writeFile(wb, `compare_summary_web_${App.currentJob || 'latest'}_${App.nowTag()}.xlsx`);
    }else{
      const rows = App.RECORDS_FILTERED_CACHE.map((r,idx)=>({
        '#': idx+1,
        'เลขวงจร': App._normStr(r.circuit_number) || (r.circuit_norm || '—'),
        'สาขา': App._normStr(r.branch) || '—',
        'SLA': App._normStr(r.sla) || '—',
        'ลูกค้า': App._normStr(r.customer) || '—',
        'จังหวัด': App._normStr(r.province) || '—',
        'ประเภท': App._normStr(r.service_category ?? r.type ?? '') || '—',
        'สถานะ': r.status || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Compare');
      XLSX.writeFile(wb, `compare_records_${App.currentJob || 'latest'}_${App.nowTag()}.xlsx`);
    }
  };

  App.exportSummaryServer = ()=>{
    if(!App.currentJob){ alert('กรุณาเลือก Job ก่อน'); return; }
    window.location = `${App.API_BASE}/export/summary?job_id=${App.currentJob}`;
  };

  App.exportPNG = async ()=>{
    try{
      if (App.qs('#viewReport').classList.contains('hidden')) {
        alert('เปิดแท็บ Report ก่อน'); 
        return;
      }
      await App.ensurePngPdfLibs();

      const el = App.qs('#reportCapture');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#0b1220';
      const canvas = await html2canvas(el, {backgroundColor: bg.trim(), scale: 2, useCORS:true, logging:false});
      canvas.toBlob((blob)=>{
        const a=document.createElement('a');
        a.href=URL.createObjectURL(blob);
        a.download=`report_${App.currentJob || 'latest'}_${App.nowTag()}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    }catch(e){ alert('Export PNG ล้มเหลว: '+e.message); }
  };

  App.exportPDF = async ()=>{
    try{
      if (App.qs('#viewReport').classList.contains('hidden')) {
        alert('เปิดแท็บ Report ก่อน'); 
        return;
      }
      await App.ensurePngPdfLibs();

      const container = App.qs('#reportCapture');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#0b1220';

      const canvas = await html2canvas(container, {
        backgroundColor: bg.trim(),
        scale: 3,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;

      const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
      const imgW = canvas.width * scale;
      const imgH = canvas.height * scale;

      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
      pdf.save(`report_${App.currentJob || 'latest'}_${App.nowTag()}.pdf`);
    }catch(e){
      alert('Export PDF ล้มเหลว: ' + e.message);
    }
  };

})(window);
