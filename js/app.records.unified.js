(function (w) {
  const TAG = "[RU/v5]";
  w.App = w.App || {};

  const PAGE_SIZE = 100;
  const HEADER_MAP = {
    "ลูกค้า": "customer",
    "จังหวัด": "province",
    "ประเภท": "type",
    "เลขวงจร": "circuit",
    "สถานะ": "status",
    "สาขา": "project",
    "ชื่อโครงการ": "project"
  };
  const REQUIRED_KEYS = ["customer","province","type","circuit","status"]; // project optional
  const POS_PATTERNS = ["matched","match","match แล้ว","พบ","ตรง","เท่ากัน","ตรงกับ","อยู่ใน","มีใน"];
  const NEG_PATTERNS = ["unmatched","ไม่พบ","ไม่ตรง","ไม่ match","ต่าง","ผิด","ขาด","ใหม่","ไม่มีใน"];


  const norm = (s)=> (s==null ? "" : String(s).replace(/[\u200B-\u200D\uFEFF]/g,"").trim().toLowerCase().replace(/\s+/g," "));
  const includesNorm = (hay, needle)=> norm(hay).includes(norm(needle));
  const debounce = (fn, ms=200)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
  const uniqSorted = (arr)=> Array.from(new Set((arr||[]).map(v=> (v==null?"":String(v).trim())).filter(Boolean)))
                                 .sort((a,b)=> String(a).localeCompare(String(b),'th'));
  const cssVar = (name,fb)=>{ try{ const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v||fb; }catch{ return fb; } };
  const createEl = (tag, attrs={}, children=[])=>{
    const el=document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)){
      if(k==="class") el.className=v;
      else if(k==="style"&&typeof v==="object") Object.assign(el.style,v);
      else if(k.startsWith("on")&&typeof v==="function") el.addEventListener(k.slice(2),v);
      else el.setAttribute(k,v);
    }
    (Array.isArray(children)?children:[children]).forEach(c=>{
      if (c==null) return; el.appendChild(typeof c==="string"?document.createTextNode(c):c);
    });
    return el;
  };

  function ensureStyle(){
    try{
      document.getElementById("ru-style")?.remove();
      const st = document.createElement("style");
      st.id = "ru-style";
      st.textContent = `
        :root{ --ru-panel:#0f172a; --ru-muted:#334155; --ru-text:#e5e7eb; }
        @media (prefers-color-scheme: light){
          :root{ --ru-panel:#ffffff; --ru-muted:#d1d5db; --ru-text:#111827; }
        }
        #ru-filterbar, #ru-footer { font-family: inherit; }
        #ru-root .ru-chip { transition: background .15s, border-color .15s; }
        #ru-root .ru-chip:hover { filter: brightness(1.08); }

        .ru-input-wrap { position: relative; }
        .ru-suggest {
          position: absolute; z-index: 12;
          left: 0; right: 0;
          max-height: 260px; overflow: auto;
          padding: 8px; margin-top: 4px;
          background: var(--ru-panel); color: var(--ru-text);
          border: 1px solid var(--ru-muted); border-radius: 10px;
          box-shadow: 0 6px 18px rgba(0,0,0,.25);
          display: none; pointer-events: none;
        }
        .ru-suggest.open { display:block; pointer-events:auto; }
        .ru-suggest .ru-option {
          display:inline-flex; align-items:center; gap:6px;
          padding:4px 8px; margin:4px 6px 0 0;
          border-radius:999px; border:1px solid var(--ru-muted);
          background: transparent; color: var(--ru-text);
          font-size:12px; white-space:nowrap; cursor:pointer;
        }
        .ru-suggest .ru-option:hover { filter: brightness(1.1); }
      `;
      document.head.appendChild(st);
    }catch(e){ log("style err", e); }
  }

  function findTablesWithRows(){
    return Array.from(document.querySelectorAll("table"))
      .filter(t => t && t.tBodies && t.tBodies[0] && t.tBodies[0].rows && t.tBodies[0].rows.length > 0);
  }
  function pickBestTable(){
    const all = findTablesWithRows();
    if (!all.length) return null;
    const scored = all.map(t=>({
      t,
      rows: t.tBodies[0].rows.length,
      cols: (t.tHead && t.tHead.rows && t.tHead.rows[0] && t.tHead.rows[0].cells ? t.tHead.rows[0].cells.length : (t.tBodies[0].rows[0]?.cells?.length || 0))
    })).sort((a,b)=> (b.rows*b.cols) - (a.rows*a.cols));
    return scored[0].t;
  }
  function headerCells(table){
    const head = Array.from(table.querySelectorAll("thead th, thead td"));
    if (head.length) return head;
    const tb = table.tBodies?.[0];
    if (tb?.rows?.length) return Array.from(tb.rows[0].cells||[]);
    return [];
  }
  function mapColumns(table){
    const m = {customer:-1, project:-1, province:-1, type:-1, circuit:-1, status:-1};
    try{
      const cells = headerCells(table);
      cells.forEach((c,i)=>{
        const text = norm((c.textContent||""));
        Object.entries(HEADER_MAP).forEach(([label,key])=>{
          if (m[key] >= 0) return;
          if (text === norm(label)) m[key] = i;
        });
      });
    }catch(e){ log("mapColumns err", e); }
    return m;
  }
  function extractRows(table, colMap){
    const out = [];
    try{
      const tb = table.tBodies[0];
      if (!tb) return out;
      let start = 0;
      if (!table.tHead || !table.tHead.rows || !table.tHead.rows.length) start = 1; // header-in-tbody
      const trs = Array.from(tb.rows).slice(start);
      for (const tr of trs){
        const tds = Array.from(tr.cells||[]);
        const cell = (ix)=> (ix>=0 && ix<tds.length) ? (tds[ix].textContent||"").replace(/[\u200B-\u200D\uFEFF]/g,"").trim() : "";
        out.push({
          __tr: tr,
          customer: cell(colMap.customer),
          project:  cell(colMap.project),
          province: cell(colMap.province),
          type:     cell(colMap.type),
          circuit:  cell(colMap.circuit),
          status:   cell(colMap.status),
        });
      }
    }catch(e){ log("extractRows err", e); }
    return out;
  }
  function isMatchedStatus(text) {
    const t = norm(text);
    if (!t) return null; // ถ้าไม่มีข้อความ ให้คืนค่าเป็น null
  
    if (POS_PATTERNS.some(p => t.includes(p))) {
      return true; // พบคำที่ตรงกับ Matched
    }
  
    if (NEG_PATTERNS.some(p => t.includes(p))) {
      return false; // พบคำที่ตรงกับ Unmatched
    }
  
    return null;
  }

  const btnStyle = ()=>({
    background: cssVar("--panel","var(--ru-panel)"),
    color: cssVar("--text","var(--ru-text)"),
    border: `1px solid ${cssVar("--muted","var(--ru-muted)")}`,
    padding: "8px 12px",
    borderRadius: "10px",
    cursor: "pointer"
  });
  const inputStyle = ()=>({
    border:`1px solid ${cssVar("--muted","var(--ru-muted)")}`,
    background:"transparent",
    color: cssVar("--text","var(--ru-text)"),
    padding:"8px 10px",
    borderRadius:"10px",
    width:"100%"
  });
  function barStyle(){ return {
    display:"grid",
    gridTemplateColumns:"minmax(240px,1fr) auto",
    gap:"8px",
    alignItems:"start",
    padding:"8px",
    background: cssVar("--panel","var(--ru-panel)"),
    border: `1px solid ${cssVar("--muted","var(--ru-muted)")}`,
    color: cssVar("--text","var(--ru-text)"),
    borderRadius:"12px",
    marginBottom:"8px"
  }; }
  function chipStyle(){ return {
    display:"inline-flex", alignItems:"center", gap:"6px",
    padding:"4px 8px", borderRadius:"999px",
    border:`1px solid ${cssVar("--muted","var(--ru-muted)")}`,
    background: cssVar("--panel","var(--ru-panel)"),
    margin:"2px 6px 0 0", fontSize:"12px"
  }; }
  function groupCard(title){
    return createEl("div", { class:"ru-card", style:{ border:`1px dashed ${cssVar("--muted","var(--ru-muted)")}`, borderRadius:"10px", padding:"8px" }}, [
      createEl("div", { style:{ fontSize:"12px", opacity:"0.8", marginBottom:"6px" }}, title),
    ]);
  }

  function insertFilterBar(table){
    const parent = table.parentElement || document.body;

    ensureStyle();

    parent.querySelector("#ru-filterbar")?.remove();
    parent.querySelector("#ru-footer")?.remove();

    const root = document.getElementById("ru-root") || createEl("div", { id:"ru-root" });
    if (!root.parentElement) parent.insertBefore(root, table);

    const bar = createEl("div", { id:"ru-filterbar", style: barStyle() });

    const left = createEl("div", { style:{ display:"grid", gap:"8px" }});
    const globalSearch = createEl("input", {
      id:"ru-search", type:"text",
      placeholder:"ค้นหา (ลูกค้า/จังหวัด/ประเภท/เลขวงจร/สถานะ/สาขา)…",
      style: inputStyle()
    });
    left.appendChild(globalSearch);

    function buildChipGroup(title, placeholder){
      const card = groupCard(title);
      const chipsRow = createEl("div", { class:"ru-chips" });

      const inputWrap = createEl("div", { class:"ru-input-wrap", style:{ display:"grid", gridTemplateColumns:"1fr auto", gap:"6px" }});
      const input = createEl("input", { type:"text", placeholder, style: inputStyle() });
      const addBtn = createEl("button", { style:{...btnStyle(), padding:"6px 10px"}, type:"button" }, "➕ เพิ่ม");
      const panel = createEl("div", { class:"ru-suggest", tabindex:"-1" });

      inputWrap.append(input, addBtn, panel);
      card.append(chipsRow, inputWrap);
      return { card, chipsRow, inputWrap, input, addBtn, panel };
    }
    const grpCustomer = buildChipGroup("ลูกค้า","พิมพ์หรือคลิกเพื่อเลือก");
    const grpProvince = buildChipGroup("จังหวัด","พิมพ์หรือคลิกเพื่อเลือก");
    const grpType     = buildChipGroup("ประเภท","พิมพ์หรือคลิกเพื่อเลือก");

    const row3 = createEl("div", { style:{ display:"grid", gridTemplateColumns:"repeat(3, minmax(200px,1fr))", gap:"8px" }});
    row3.append(grpCustomer.card, grpProvince.card, grpType.card);
    left.appendChild(row3);

    const right = createEl("div", { style:{ display:"grid", gap:"8px" }});
    const statusWrap = groupCard("สถานะ");
    const statusBar = createEl("div", { style:{ display:"flex", gap:"6px", flexWrap:"wrap" }});
    function sBtn(label,key){ return createEl("button",{ "data-status":key, style:{...btnStyle(), padding:"6px 10px"}, type:"button" },label); }
    const stAll = sBtn("ทั้งหมด","all");
    const stM   = sBtn("Matched","matched");
    const stU   = sBtn("Unmatched","unmatched");
    statusBar.append(stAll, stM, stU);
    statusWrap.append(statusBar);
    const btnReset = createEl("button", { id:"ru-reset", style: btnStyle(), type:"button" }, "ล้างตัวกรอง");
    right.append(statusWrap, btnReset);

    bar.append(left, right);
    root.appendChild(bar);

    let footer = parent.querySelector("#ru-footer");
    if (!footer){
      footer = createEl("div", { id:"ru-footer", style:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"8px" }}, [
        createEl("div", { id:"ru-count", style:{ opacity:"0.85" }}, ""),
        createEl("div", {}, [ createEl("button", { id:"ru-more", style: btnStyle(), type:"button" }, `โหลดเพิ่ม ${PAGE_SIZE} แถว`) ])
      ]);
      parent.insertBefore(footer, table.nextSibling);
    }

    return { globalSearch, grpCustomer, grpProvince, grpType, stAll, stM, stU, btnReset };
  }

  function attachSuggest(inputEl, panelEl, itemsProvider, onPick){
    let keepFocus = false;

    function open(){
      const items = itemsProvider();
      const qn = norm(inputEl.value);
      const filtered = qn ? items.filter(v=> includesNorm(v, qn)) : items;
      panelEl.innerHTML = "";
      filtered.slice(0,300).forEach(v=>{
        const chip = createEl("button", { class:"ru-option", type:"button" }, v);
        const pick = (e)=>{
          e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
          onPick(v);
          close();
          setTimeout(()=>{ try{ inputEl.focus(); }catch{} }, 0);
        };
        chip.addEventListener("pointerdown", pick, { passive:false });
        chip.addEventListener("touchstart",  pick, { passive:false });
        chip.addEventListener("click",       pick);
        panelEl.appendChild(chip);
      });
      if (filtered.length) panelEl.classList.add("open");
      else panelEl.classList.remove("open");
    }
    function close(){ panelEl.classList.remove("open"); }

    panelEl.addEventListener("pointerdown", (e)=>{
      keepFocus = true;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    }, { passive:false });

    inputEl.addEventListener("focus", open);
    inputEl.addEventListener("input", open);
    inputEl.addEventListener("keydown", (e)=>{
      if (e.key==="Escape"){ e.preventDefault(); close(); inputEl.blur(); }
      else if (e.key==="Enter" && inputEl.value.trim()){
        onPick(inputEl.value.trim()); inputEl.value=""; close();
      }
    });
    inputEl.addEventListener("blur", ()=>{
      if (keepFocus){
        keepFocus = false;
        setTimeout(()=>{ try{ inputEl.focus(); }catch{}; open(); }, 0);
        return;
      }
      close();
    });

    const wrapper = inputEl.closest(".ru-input-wrap");
    wrapper?.addEventListener("pointerdown", (e)=>{
      if (e.target!==inputEl && !panelEl.contains(e.target)) close();
    });
  }

  function controller(table){
    try{
      const colMap = mapColumns(table);
      const mappingValid = REQUIRED_KEYS.every(k => typeof colMap[k] === "number" && colMap[k] >= 0);

      const ui = insertFilterBar(table);
      let allRows = extractRows(table, colMap);

      let filters = { q:"", status:"all", customers:new Set(), provinces:new Set(), types:new Set() };
      let matches = [], shown = 0;
      
      const allCustomers = uniqSorted(allRows.map(r => r.customer));
      const allProvinces = uniqSorted(allRows.map(r => r.province));
      const allTypes     = uniqSorted(allRows.map(r => r.type));

      const sugg = {
        customers: () => uniqSorted(allRows.map(r=>r.customer)),
        provinces: () => uniqSorted(allRows.map(r=>r.province)),
        types:     () => uniqSorted(allRows.map(r=>r.type)),
      };      

      function renderChips(rowEl, values, onRemove){
        rowEl.innerHTML = "";
        values.forEach(v=>{
          const chip = createEl("span", { class:"ru-chip", style: chipStyle() }, [
            v,
            createEl("button", { style:{...btnStyle(), padding:"2px 6px"}, type:"button" }, "✕")
          ]);
          chip.querySelector("button").addEventListener("click", ()=> onRemove(v));
          rowEl.appendChild(chip);
        });
      }
      const renderCust = ()=> renderChips(ui.grpCustomer.chipsRow, Array.from(filters.customers), v=>{ filters.customers.delete(v); renderCust(); refresh(); });
      const renderProv = ()=> renderChips(ui.grpProvince.chipsRow, Array.from(filters.provinces), v=>{ filters.provinces.delete(v); renderProv(); refresh(); });
      const renderType = ()=> renderChips(ui.grpType.chipsRow,     Array.from(filters.types),     v=>{ filters.types.delete(v);     renderType(); refresh(); });

      function addFromInput(set, inputEl, renderFn){ const v=(inputEl.value||"").trim(); if(!v) return; set.add(v); inputEl.value=""; renderFn(); refresh(); }
      ui.grpCustomer.addBtn.addEventListener("click", ()=> addFromInput(filters.customers, ui.grpCustomer.input, renderCust));
      ui.grpProvince.addBtn.addEventListener("click", ()=> addFromInput(filters.provinces, ui.grpProvince.input, renderProv));
      ui.grpType.addBtn.addEventListener("click",     ()=> addFromInput(filters.types,     ui.grpType.input,     renderType));
      ui.grpCustomer.input.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); addFromInput(filters.customers, ui.grpCustomer.input, renderCust);} });
      ui.grpProvince.input.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); addFromInput(filters.provinces, ui.grpProvince.input, renderProv);} });
      ui.grpType.input.addEventListener("keydown",     e=>{ if(e.key==="Enter"){ e.preventDefault(); addFromInput(filters.types,     ui.grpType.input,     renderType);} });

      attachSuggest(ui.grpCustomer.input, ui.grpCustomer.panel, sugg.customers, (v)=>{
        filters.customers.add(v);
        renderCust();
        refresh();
        ui.grpCustomer.input.value = "";
      });
      
      attachSuggest(ui.grpProvince.input, ui.grpProvince.panel, sugg.provinces, (v)=>{
        filters.provinces.add(v);
        renderProv();
        refresh();
        ui.grpProvince.input.value = "";
      });
      
      attachSuggest(ui.grpType.input, ui.grpType.panel, sugg.types, (v)=>{
        filters.types.add(v);
        renderType();
        refresh();
        ui.grpType.input.value = "";
      });      

      const statusBtns = [ui.stAll, ui.stM, ui.stU];
      function markStatus(k){
        filters.status = k;
        statusBtns.forEach(b=>{
          const key=b.getAttribute("data-status");
          b.style.outline = key===k ? `2px solid ${cssVar("--muted","var(--ru-muted)")}` : "none";
          b.style.opacity = key===k ? "1" : "0.9";
        });
        refresh();
      }
      ui.stAll.addEventListener("click", ()=> markStatus("all"));
      ui.stM.addEventListener("click",  ()=> markStatus("matched"));
      ui.stU.addEventListener("click",  ()=> markStatus("unmatched"));
      markStatus("all");

      ui.globalSearch.addEventListener("input", debounce(()=>{ filters.q = ui.globalSearch.value||""; refresh(); }, 160));
      ui.btnReset.addEventListener("click", ()=>{
        filters = { q:"", status:"all", customers:new Set(), provinces:new Set(), types:new Set() };
        ui.globalSearch.value=""; markStatus("all");
        renderCust(); renderProv(); renderType(); refresh();
      });

      const btnMore = document.getElementById("ru-more");
      btnMore?.addEventListener("click", ()=>{ shown = Math.min(shown + PAGE_SIZE, matches.length); render(); });

      function applyFilter(rows){
        const q = norm(filters.q);
        const sMode = filters.status; // all|matched|unmatched
        const chipsC = Array.from(filters.customers);
        const chipsP = Array.from(filters.provinces);
        const chipsT = Array.from(filters.types);
      
        const keep = [];
        for (let i=0; i<rows.length; i++){
          const r = rows[i];
      
          if (sMode !== "all") {
            const m = isMatchedStatus(r.status);
            
            if (sMode === "matched" && m !== true) {
              continue;
            }
            
            if (sMode === "unmatched" && m !== false) {
              continue;
            }
          }
      
          if (chipsC.length && !chipsC.some(v => includesNorm(r.customer, v))) continue;
          if (chipsP.length && !chipsP.some(v => includesNorm(r.province, v))) continue;
          if (chipsT.length && !chipsT.some(v => includesNorm(r.type, v))) continue;
      
          if (q){
            const bucket = norm([r.customer, r.project, r.province, r.type, r.circuit, r.status].join(" "));
            if (!bucket.includes(q)) continue;
          }
          keep.push(i);
        }
        return keep;
      }

      function render(){
        const count = document.getElementById("ru-count");
        allRows.forEach(r=>{ if (r.__tr) r.__tr.style.display = "none"; });
        const N = Math.min(shown, matches.length);
        for (let k=0;k<N;k++){
          const idx = matches[k]; const r = allRows[idx];
          if (r?.__tr) r.__tr.style.display = "";
        }
        const left = matches.length - N;
        if (count) count.textContent = matches.length ? `แสดง ${N}/${matches.length} รายการ` : "ไม่พบข้อมูลตามตัวกรอง";
        const btn = document.getElementById("ru-more");
        if (btn){ btn.disabled = left<=0; btn.textContent = left>0 ? `โหลดเพิ่ม ${Math.min(PAGE_SIZE,left)} แถว` : "ครบแล้ว"; }
      }
      function refresh(){
        if (!mappingValid || allRows.length===0){
          const count = document.getElementById("ru-count");
          if (count) count.textContent = "พร้อมใช้งาน (หัวตารางไม่ครบ—แสดงตารางเต็ม)";
          return;
        }
        matches = applyFilter(allRows);
        shown = Math.min(PAGE_SIZE, matches.length);
        render();
      }

      renderCust(); renderProv(); renderType();
      refresh();

      const tbody = table.tBodies?.[0];
      if (tbody){
        const reindex = debounce(()=>{
          try{
            allRows = extractRows(table, colMap);
            refresh();
          }catch(e){ log("reindex err", e); }
        }, 150);
        const mo = new MutationObserver(reindex);
        mo.observe(tbody, { childList:true, subtree:true });
      }
    }catch(e){
      log("controller err", e);
    }
  }

  function tryMountOnce(){
    try{
      const table = pickBestTable();
      if (!table) { log("no table yet"); return false; }
      controller(table);
      log("mounted");
      return true;
    }catch(e){
      log("mount err", e);
      return false;
    }
  }

  function start(){
    ensureStyle();

    if (tryMountOnce()) return;

    const check = debounce(()=> { tryMountOnce(); }, 150);
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement || document.body, { childList:true, subtree:true });

    const t0 = Date.now();
    const poll = setInterval(()=>{
      if (tryMountOnce()){
        clearInterval(poll); mo.disconnect();
      } else if (Date.now() - t0 > 60000){
        clearInterval(poll); mo.disconnect();
        log("timeout: table not found in 60s (UI not removed)");
      }
    }, 500);
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", start);
  else start();

})(window);
