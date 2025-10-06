(function (global) {
  const App = global.App = global.App || {};
  const { qs, escapeHTML } = App;

  const svcCanvas=qs('#svcPie'), provCanvas=qs('#provPie');
  const hotspotsEl=qs('#hotspots');
  const reportNote=qs('#reportNote');
  const kpiAffectedCustomers=qs('#kpiAffectedCustomers');
  const kpiAffectedCircuits=qs('#kpiAffectedCircuits');
  const kpiAffectedProvinces=qs('#kpiAffectedProvinces');
  const kpiProvinceList=qs('#kpiProvinceList');
  const kpiData=qs('#kpiData'), kpiBroadband=qs('#kpiBroadband'), kpiVoice=qs('#kpiVoice');

  const reportProvinceInput = qs('#reportProvinceInput');
  const btnAddProvince = qs('#btnAddProvince');
  const btnClearReportFilters = qs('#btnClearReportFilters');
  const reportProvinceChips = qs('#reportProvinceChips');

  const root = document.documentElement;
  function css(name, fallback=''){
    const v = getComputedStyle(root).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }
  function getTheme(){
    const attr = root.dataset.theme;
    if (attr === 'light' || attr === 'dark') return attr;
    try {
      const t = localStorage.getItem('theme');
      if (t === 'light' || t === 'dark') return t;
    } catch {}
    return 'dark';
  }
  function themeColors(){
    const t = getTheme();
    if (t === 'light'){
      return {
        text: css('--text', '#1f2937'),
        strong: css('--text-strong', '#0f172a'),
        panel: css('--panel', '#ffffff'),
        stroke: '#ffffff',
        border: '#101826',
        legendPos: 'right',
        rightPadding: 132     // กันพื้นที่ให้ % ด้านขวา
      };
    }
    return {
      text: '#e5e7eb',
      strong: '#ffffff',
      panel: '#0b1220',
      stroke: '#000000',
      border: '#e5e7eb',
      legendPos: 'right',
      rightPadding: 132
    };
  }

  App.categorizeService = (s)=>{
    const t=(s||'').toString().toLowerCase();
    if(t.includes('broadband')) return 'Broadband';
    if(t.includes('voice') || t.includes('tele')) return 'Voice';
    if(t.includes('data')) return 'Data';
    return 'Other';
  };

  App.colorForProvince = (name)=>{
    if(!App.provColorMap.has(name)){
      App.provColorMap.set(name, App.PROV_PALETTE[App.provColorMap.size % App.PROV_PALETTE.length]);
    }
    return App.provColorMap.get(name);
  };

  App.severityColor = (ratio)=>{
    const h = 190 - Math.floor(190*ratio);
    return `hsl(${h} 90% 55%)`;
  };

  App.reportFrom = (records)=>{
    const sel = App.REPORT_STATE.selectedProvinces;
    const base = records.filter(r=>{
      if(r.status!=='Found') return false;
      const prov=App._normStr(r.province) || '—';
      if(sel.size && !sel.has(prov)) return false;
      return true;
    });
    const uniqueCust=new Set();
    const provSet=new Set();
    const svcCount={Data:0,Broadband:0,Voice:0};

    const provCounts=new Map();
    const provSvcCounts=new Map();

    for(const r of base){
      const cust=App._normStr(r.customer);
      const svc=App.categorizeService(App._normStr(r.service_category ?? r.type ?? ''));
      const prov=App._normStr(r.province) || '—';

      if(cust) uniqueCust.add(cust);
      if(prov){
        provSet.add(prov);
        provCounts.set(prov, (provCounts.get(prov)||0)+1);

        if(!provSvcCounts.has(prov)) provSvcCounts.set(prov, {Data:0,Broadband:0,Voice:0,total:0});
        const obj = provSvcCounts.get(prov);
        if(['Data','Broadband','Voice'].includes(svc)) obj[svc] += 1;
        obj.total += 1;
      }
      if(svcCount.hasOwnProperty(svc)) svcCount[svc] += 1;
    }

    const provinceCounts = [...provCounts.entries()]
      .map(([province,count])=>({province,count}))
      .sort((a,b)=>b.count - a.count || a.province.localeCompare(b.province));

    const hotspots = [...provSvcCounts.entries()]
      .map(([province,o])=>({province, total:o.total, Data:o.Data, Broadband:o.Broadband, Voice:o.Voice}))
      .sort((a,b)=>b.total - a.total)
      .slice(0,5);

    return {
      customers: uniqueCust.size,
      circuits: base.length,
      provinces: provSet.size,
      provinceCounts,
      provincesList: [...provSet].sort((a,b)=>a.localeCompare(b)),
      services: svcCount,
      hotspots
    };
  };

  App.ensureChartLibs = async ()=>{
    await App.loadScriptOnce('/static/lib/chart.umd.min.js');
    await App.loadScriptOnce('/static/lib/chartjs-plugin-datalabels.min.js');
  };

  const pieLabelLinesPlugin = {
    id:'pieLabelLines',
    afterDatasetDraw(chart, args, opts){
      const type = chart.config.type;
      if(type!=='pie' && type!=='doughnut') return;
      const {ctx} = chart;
      const meta = chart.getDatasetMeta(args.index);
      const data = meta?.data || [];
      ctx.save();
      ctx.strokeStyle = opts?.color || '#9aa6b2';
      ctx.lineWidth = opts?.lineWidth || 1;
      const len = opts?.length || 16;
      data.forEach((arc)=>{
        const val = chart.data.datasets[args.index]?.data?.[arc.index] ?? 0;
        if(!val) return;
        const angle = (arc.startAngle + arc.endAngle)/2;
        const r = arc.outerRadius;
        const x0 = arc.x + Math.cos(angle)*r;
        const y0 = arc.y + Math.sin(angle)*r;
        const x1 = arc.x + Math.cos(angle)*(r + len);
        const y1 = arc.y + Math.sin(angle)*(r + len);
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
      });
      ctx.restore();
    }
  };

  function themedPieOptions(){
    const c = themeColors();

    const dynamicOffset = (ctx)=>{
      const chart = ctx.chart;
      const meta = chart.getDatasetMeta(0);
      const arc = meta?.data?.[ctx.dataIndex];
      if(!arc) return 12;
      const mid = (arc.startAngle + arc.endAngle)/2;
      const cos = Math.cos(mid);
      if (cos > 0.5) return 18;
      if (cos > 0.2) return 14;
      return 12;
    };

    return {
      responsive:true, maintainAspectRatio:false, resizeDelay:150,
      layout:{ padding:{top:40,right:c.rightPadding,bottom:40,left:56} },
      plugins:{
        legend:{ position:c.legendPos, labels:{ color: c.text } },
        tooltip:{ enabled:true },
        datalabels:{
          anchor:'end',
          align:'end',
          offset: dynamicOffset,
          clamp:false, clip:false,
          color: c.strong,
          textStrokeColor: c.stroke,
          textStrokeWidth: 1.1,
          font:{ weight:'800', size: 12 },
          formatter:(value, ctx)=>{
            const arr = ctx.chart.data.datasets[0].data;
            const total = arr.reduce((a,b)=>a+(+b||0),0) || 1;
            const pct = Math.round((value/total)*100);
            return `${pct}%`;  // แสดงเสมอ
          }
        },
        pieLabelLines:{ length:18, color:'#9aa6b2', lineWidth:1 }
      }
    };
  }

  App.initChartsOnce = ()=>{
    if(!window.Chart) return;

    if(!App.svcChart){
      Chart.register(window.ChartDataLabels || {}, pieLabelLinesPlugin);
      App.svcChart = new Chart(svcCanvas.getContext('2d'), {
        type: 'pie',
        data: { labels: [], datasets: [{ data:[], backgroundColor: [], hoverBackgroundColor: [], borderColor: themeColors().border, borderWidth:2, clip:0 }] },
        options: themedPieOptions()
      });
    }

    if(!App.provChart){
      App.provChart = new Chart(provCanvas.getContext('2d'), {
        type: 'pie',
        data: { labels: [], datasets: [{ data:[], backgroundColor: [], borderColor: themeColors().border, borderWidth:2, clip:0 }]},
        options: themedPieOptions()
      });
    }
  };

  App.updateCharts = (rep)=>{
    if(!App.svcChart || !App.provChart) return;

    const svcRawFull = [
      {label:'Data', value: rep.services.Data||0, color:App.SVC_COLORS.Data},
      {label:'Broadband', value: rep.services.Broadband||0, color:App.SVC_COLORS.Broadband},
      {label:'Voice', value: rep.services.Voice||0, color:App.SVC_COLORS.Voice}
    ];
    const svcRaw = svcRawFull.filter(x=>x.value>0);
    App.svcChart.data.labels = svcRaw.map(x=>x.label);
    App.svcChart.data.datasets[0].data = svcRaw.map(x=>x.value);
    App.svcChart.data.datasets[0].backgroundColor = svcRaw.map(x=>x.color);
    App.svcChart.data.datasets[0].hoverBackgroundColor = svcRaw.map(x=>x.color);
    App.svcChart.options = themedPieOptions();
    App.svcChart.update();

    App.provColorMap.clear();
    const TOP_N = 8;
    const top = rep.provinceCounts.slice(0, TOP_N);
    const labels = top.map(x=>x.province);
    const data = top.map(x=>x.count);
    const colors = labels.map(n => App.colorForProvince(n));
    App.provChart.data.labels = labels;
    App.provChart.data.datasets[0].data = data;
    App.provChart.data.datasets[0].backgroundColor = colors;
    App.provChart.options = themedPieOptions();
    App.provChart.update();

    const totalSvc = (rep.services.Data||0)+(rep.services.Broadband||0)+(rep.services.Voice||0) || 1;
    const svcPairs = [['Data', rep.services.Data||0],['Broadband', rep.services.Broadband||0],['Voice', rep.services.Voice||0]]
      .sort((a,b)=>b[1]-a[1]);
    const topSvc = svcPairs[0];
    const topSvcPct = Math.round((topSvc[1]/totalSvc)*100);

    const topProvObj = rep.provinceCounts[0];
    const topProvTxt = topProvObj ? `${topProvObj.province} (${topProvObj.count})` : '—';
    const topProvPct = topProvObj && rep.circuits ? Math.round((topProvObj.count/rep.circuits)*100) : 0;

    reportNote.textContent = `Top Service: ${topSvc[0]} (${topSvcPct}%) • Top Province: ${topProvTxt}${topProvObj ? ' • '+topProvPct+'%' : ''}`;
  };

  App.renderHotspots = (rep)=>{
    const list = rep.hotspots || [];
    if(!list.length){ hotspotsEl.innerHTML = '<div class="small">—</div>'; return; }
    const max = Math.max(...list.map(x=>x.total)) || 1;
    hotspotsEl.innerHTML = list.map(x=>{
      const width = Math.round((x.total/max)*100);
      const color = App.severityColor(x.total/max);
      const line = `${escapeHTML(x.province)} (${x.total}) • Data (${x.Data}) | Broadband (${x.Broadband}) | Voice (${x.Voice})`;
      return `<div class="hot-row">
        <div class="hot-name">${line}</div>
        <div class="hot-bar"><span style="width:${width}%; background:${color}"></span></div>
      </div>`;
    }).join('');
  };

  App.renderProvinceList = (rep)=>{
    if(rep.provinceCounts.length){
      kpiProvinceList.innerHTML = rep.provinceCounts
        .map(o=>`<span class="chip">${escapeHTML(o.province)}<span class="small"> • ${o.count}</span></span>`)
        .join(' ');
    }else{
      kpiProvinceList.innerHTML = '<span class="small">—</span>';
    }
  };

  App.rebuildAndRenderReport = async ()=>{
    qs('#reportStatusMsg').textContent='กำลังคำนวณ…';
    await App.ensureChartLibs();

    const rep = App.reportFrom(App.allRecords);

    kpiAffectedCustomers.textContent = rep.customers;
    kpiAffectedCircuits.textContent  = rep.circuits;
    kpiAffectedProvinces.textContent = rep.provinces;

    kpiData.textContent = rep.services.Data || 0;
    kpiBroadband.textContent = rep.services.Broadband || 0;
    kpiVoice.textContent = rep.services.Voice || 0;

    App.renderProvinceList(rep);
    App.initChartsOnce();
    App.updateCharts(rep);
    App.renderHotspots(rep);

    qs('#reportStatusMsg').textContent='พร้อม';
  };

  function renderReportProvinceChips(){
    if(!reportProvinceChips) return;
    reportProvinceChips.innerHTML = '';
    const arr = [...App.REPORT_STATE.selectedProvinces].sort((a,b)=>a.localeCompare(b));
    for(const p of arr){
      const el = document.createElement('span');
      el.className = 'chip';
      el.innerHTML = `${escapeHTML(p)} <button title="ลบ">×</button>`;
      el.querySelector('button').onclick = () => {
        App.REPORT_STATE.selectedProvinces.delete(p);
        renderReportProvinceChips();
        App.rebuildAndRenderReport();
      };
      reportProvinceChips.appendChild(el);
    }
  }

  function addReportProvince(){
    const v = (reportProvinceInput?.value || '').trim();
    if(!v) return;
    App.REPORT_STATE.selectedProvinces.add(v);
    if(reportProvinceInput) reportProvinceInput.value = '';
    renderReportProvinceChips();
    App.rebuildAndRenderReport();
  }

  function clearReportProvinces(){
    App.REPORT_STATE.selectedProvinces.clear();
    renderReportProvinceChips();
    App.rebuildAndRenderReport();
  }

  if(btnAddProvince) btnAddProvince.onclick = addReportProvince;
  if(btnClearReportFilters) btnClearReportFilters.onclick = clearReportProvinces;
  if(reportProvinceInput){
    reportProvinceInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ','){
        e.preventDefault();
        addReportProvince();
      }
    });
  }

  renderReportProvinceChips();

})(window);
