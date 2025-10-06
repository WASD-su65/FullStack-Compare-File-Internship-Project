(function (global) {
  const App = global.App = global.App || {};

  App.qs  = (s, el=document)=>el.querySelector(s);
  App.qsa = (s, el=document)=>[...el.querySelectorAll(s)];

  App.escapeHTML = s => (s??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  App._normStr   = s => ((s??'')+'').trim();

  const bangkokFormatter = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  });
  App.parseAPIDate = (s)=>{
    if(!s) return new Date(NaN);
    if(typeof s!=='string') return new Date(s);
    let t = s.trim();
    if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(t)) t = t.replace(' ','T');
    if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(t)) t += 'Z';
    return new Date(t);
  };
  App.isValidDate = d => d instanceof Date && !isNaN(d);
  App.fmtBangkok  = s => {
    const d = App.parseAPIDate(s);
    return App.isValidDate(d) ? bangkokFormatter.format(d) : '-';
  };

  App.showLoading = (text='กำลังประมวลผล…')=>{
    App.qs('#loadingText').textContent = text;
    App.qs('#loadingOverlay').style.display='flex';
  };
  App.hideLoading = ()=>{
    App.qs('#loadingOverlay').style.display='none';
  };

  App.downloadBlob = (content, filename, type='text/csv')=>{
    const blob = new Blob([content], {type});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  App.nowTag = ()=>{
    const d = new Date();
    return d.getFullYear().toString()
      + String(d.getMonth()+1).padStart(2,'0')
      + String(d.getDate()).padStart(2,'0')
      + '_' + String(d.getHours()).padStart(2,'0')
      + String(d.getMinutes()).padStart(2,'0');
  };

  App.loadScriptOnce = (() => {
    const loaded = new Set();
    return (url) => new Promise((resolve, reject) => {
      if (loaded.has(url)) return resolve();
      const s = document.createElement('script');
      s.src = url;
      s.onload  = () => { loaded.add(url); resolve(); };
      s.onerror = () => reject(new Error('load fail: '+url));
      document.head.appendChild(s);
    });
  })();

})(window);
