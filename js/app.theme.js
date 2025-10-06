(function (global) {
  const d = document, root = d.documentElement;

  function css(name){ return getComputedStyle(root).getPropertyValue(name).trim(); }
  function getSaved(){
    try{ const t = localStorage.getItem('theme'); return (t==='light'||t==='dark') ? t : 'dark'; }
    catch{ return 'dark'; }
  }

  function applyChartDefaults(theme){
    if (!global.Chart) return;

    const text = (theme==='light') ? (css('--text') || '#1f2937') : '#e5e7eb';
    const strong = (theme==='light') ? (css('--text-strong') || '#0f172a') : '#ffffff';

    global.Chart.defaults.color = text;

    if (global.Chart.defaults.plugins){
      global.Chart.defaults.plugins.legend = Object.assign(
        { labels: { color: text } },
        global.Chart.defaults.plugins.legend || {}
      );

      if (global.Chart.defaults.plugins.datalabels){
        global.Chart.defaults.plugins.datalabels.color = strong;
        global.Chart.defaults.plugins.datalabels.textStrokeColor = (theme==='light' ? '#ffffff' : '#000000');
        global.Chart.defaults.plugins.datalabels.textStrokeWidth = 0.8;
        global.Chart.defaults.plugins.datalabels.backgroundColor = null; // โปร่ง ไม่บังชิ้นส่วน
        global.Chart.defaults.plugins.datalabels.borderRadius = 2;
        global.Chart.defaults.plugins.datalabels.padding = {top:2,right:4,bottom:2,left:4};
      }
    }
  }

  function setTheme(t){
    root.dataset.theme = t;
    try{ localStorage.setItem('theme', t); }catch{}

    const btn = d.getElementById('btnTheme');
    if (btn){
      btn.textContent = (t==='light') ? '🌙 Dark' : '☀️ Light';
      btn.title = (t==='light') ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    }

    applyChartDefaults(t);

    if (global.App && typeof global.App.rebuildAndRenderReport === 'function'){
      try { global.App.rebuildAndRenderReport(); } catch(_) {}
    }
  }

  function injectToggleButton(){
    const header = d.querySelector('header') || d.body;
    const exportBtn = header.querySelector('#btnExportPDF')
                    || header.querySelector('#btnExportPNG')
                    || header.querySelector('#btnExportSummary')
                    || header.querySelector('#btnExportXLSX');
    const container = exportBtn ? exportBtn.parentElement : header;

    if (!d.getElementById('btnTheme')){
      const btn = d.createElement('button');
      btn.id = 'btnTheme';
      btn.type = 'button';
      btn.textContent = '☀️ Light';
      btn.style.marginInlineStart = '8px';
      container.appendChild(btn);
      btn.addEventListener('click', ()=> setTheme(root.dataset.theme==='light' ? 'dark' : 'light'));
    }
  }

  d.addEventListener('DOMContentLoaded', ()=>{
    injectToggleButton();
    const initial = getSaved();
    applyChartDefaults(initial);
    setTheme(initial);
  });

})(window);
