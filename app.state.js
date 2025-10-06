(function (global) {
  const App = global.App = global.App || {};

  App.API_BASE = '';

  App.fileMaster = null;
  App.fileCompare = null;

  App.currentJob = null;
  App.JOBS_ALL = [];
  App.JOBS_FILTERED = [];
  App.JOBS_SHOWN = 0;   App.JOBS_STEP = 50;

  App.allRecords = [];
  App.filtered = [];
  App.RECORDS_FILTERED_CACHE = [];
  App.RECORDS_SHOWN = 0; App.RECORDS_STEP = 100;

  App.SUMMARY_STATE = { selectedProvinces: new Set() };
  App.SUMMARY_CACHE_ROWS = [];
  App.SUM_SHOWN = 0; App.SUM_STEP = 100;

  App.REPORT_STATE = { selectedProvinces: new Set() };

  App.svcChart = null;
  App.provChart = null;

  function _cssVar(name){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v||'').toString().trim();
  }
  function _readPaletteVar(name){
    const raw = _cssVar(name);
    if(!raw) return [];
    return raw.split(',').map(s=>s.trim()).filter(Boolean);
  }
  function _buildSvcColors(){
    return {
      Data:      _cssVar('--svc-data')      || '#60a5fa',
      Broadband: _cssVar('--svc-broadband') || '#f59e0b',
      Voice:     _cssVar('--svc-voice')     || '#f472b6'
    };
  }
  function _buildProvPalette(){
    const arr = _readPaletteVar('--prov-palette');
    return arr.length ? arr : [
      '#60a5fa','#f59e0b','#f472b6','#a78bfa','#38bdf8','#fb7185',
      '#c084fc','#fca5a5','#93c5fd','#e879f9','#eab308','#fda4af',
      '#818cf8','#fbbf24'
    ];
  }

  App.SVC_COLORS   = _buildSvcColors();
  App.PROV_PALETTE = _buildProvPalette();
  App.provColorMap = new Map();

  App.reloadThemeColors = ()=>{
    App.SVC_COLORS   = _buildSvcColors();
    App.PROV_PALETTE = _buildProvPalette();
    if (App.provColorMap && typeof App.provColorMap.clear === 'function') {
      App.provColorMap.clear();
    }
    if (typeof App.rebuildAndRenderReport === 'function') {
      App.rebuildAndRenderReport();
    }
  };

})(window);
