(function (global) {
  const App = global.App = global.App || {};
  const { qs, showLoading, hideLoading } = App;

  const fileMaster=qs('#fileMaster'), fileCompare=qs('#fileCompare'), btnCompare=qs('#btnCompare');

  function checkCompareEnable(){ btnCompare.disabled=!fileCompare.files.length; }
  fileMaster.onchange=checkCompareEnable; fileCompare.onchange=checkCompareEnable;

  btnCompare.onclick=async()=>{ 
    try{
      showLoading('กำลังอัปโหลดและประมวลผล…');
      btnCompare.disabled = true;
      await App.uploadCompare();
      await App.loadJobs();
      fileMaster.value = ''; fileCompare.value = '';
      checkCompareEnable();
      qs('#loadingText').textContent='สำเร็จ!'; setTimeout(hideLoading, 800);
    }catch(e){
      qs('#loadingText').textContent='เปรียบเทียบล้มเหลว';
      setTimeout(()=>{ hideLoading(); alert('เปรียบเทียบล้มเหลว: '+e.message); }, 300);
    }finally{ btnCompare.disabled = false; }
  };

  const tabRecords=qs('#tabRecords'), tabSummary=qs('#tabSummary'), tabReport=qs('#tabReport');
  const viewRecords=qs('#viewRecords'), viewSummary=qs('#viewSummary'), viewReport=qs('#viewReport');
  const btnExportXLSX=qs('#btnExportXLSX'), btnExportSummary=qs('#btnExportSummary'), btnExportPNG=qs('#btnExportPNG'), btnExportPDF=qs('#btnExportPDF');

  tabRecords.onclick=()=>{
    tabRecords.classList.add('active');
    tabSummary.classList.remove('active');
    tabReport.classList.remove('active');
    viewRecords.classList.remove('hidden');
    viewSummary.classList.add('hidden');
    viewReport.classList.add('hidden');
    btnExportPNG.disabled = true;
    btnExportPDF.disabled = true;
    App.updateKPIActive();
  };
  tabSummary.onclick=()=>{
    tabSummary.classList.add('active');
    tabRecords.classList.remove('active');
    tabReport.classList.remove('active');
    viewSummary.classList.remove('hidden');
    viewRecords.classList.add('hidden');
    viewReport.classList.add('hidden');
    btnExportPNG.disabled = true;
    btnExportPDF.disabled = true;
    App.buildAndRenderSummary();
  };
  tabReport.onclick=async ()=>{
    tabReport.classList.add('active');
    tabRecords.classList.remove('active');
    tabSummary.classList.remove('active');
    viewReport.classList.remove('hidden');
    viewRecords.classList.add('hidden');
    viewSummary.classList.add('hidden');
    btnExportPNG.disabled = false;
    btnExportPDF.disabled = false;
    await App.rebuildAndRenderReport();
  };



  btnExportXLSX.onclick = ()=> App.exportXLSX();
  btnExportSummary.onclick = ()=> App.exportSummaryServer();
  btnExportPNG.onclick = ()=> App.exportPNG();
  btnExportPDF.onclick = ()=> App.exportPDF();

  App.loadJobs();
  App.updateKPIActive();

})(window);
