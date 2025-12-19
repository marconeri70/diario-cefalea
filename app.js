/* =========================
   STORAGE KEYS
   ========================= */
const KEY = "cefalea_attacks_v2";
const KEY_NAME = "cefalea_patient_name_v2";
const KEY_THEME = "cefalea_theme_v1";

const el = (id) => document.getElementById(id);

/* UI */
const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  diario: el("view-diario"),
  statistiche: el("view-statistiche"),
  report: el("view-report"),
  impostazioni: el("view-impostazioni"),
};

const form = el("attackForm");
const rows = el("rows");
const cards = el("cards");
const stats = el("stats");

const month = el("month");
const onlyWeekend = el("onlyWeekend");
const q = el("q");

const statsMonth = el("statsMonth");
const btnRefreshCharts = el("btnRefreshCharts");

const printMonth = el("printMonth");
const monthlyRows = el("monthlyRows");

const btnExportMonth = el("btnExportMonth");
const btnExportAll = el("btnExportAll");
const btnDeleteAll = el("btnDeleteAll");
const btnClear = el("btnClear");

const btnBackup = el("btnBackup");
const fileImport = el("fileImport");

const btnPrintReport = el("btnPrintReport");
const printArea = el("printArea");

const patientNameInput = el("patientName");

const stress = el("stress");
const stressVal = el("stressVal");

const themeSelect = el("themeSelect");

let deferredPrompt = null;
const btnInstall = el("btnInstall");

/* Charts */
const chartIntensity = el("chartIntensity");
const chartTriggers = el("chartTriggers");
const chartMeds = el("chartMeds");

/* =========================
   HELPERS
   ========================= */
function load(){
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function save(list){
  localStorage.setItem(KEY, JSON.stringify(list));
}
function getPatientName(){
  return (localStorage.getItem(KEY_NAME) || "").trim();
}
function setPatientName(v){
  localStorage.setItem(KEY_NAME, (v || "").trim());
}
function getTheme(){
  return (localStorage.getItem(KEY_THEME) || "auto").trim();
}
function setTheme(v){
  localStorage.setItem(KEY_THEME, (v || "auto").trim());
  document.documentElement.setAttribute("data-theme", v || "auto");
}
function isoToday(){
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0,10);
}
function monthNow(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${d.getFullYear()}-${m}`;
}
function isWeekend(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}
function fmtDate(dateISO, timeHHMM){
  const d = new Date(dateISO + "T00:00:00");
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yyyy = d.getFullYear();
  return timeHHMM ? `${dd}/${mm}/${yyyy} ${timeHHMM}` : `${dd}/${mm}/${yyyy}`;
}
function monthLabel(yyyyMM){
  const [yy, mm] = yyyyMM.split("-");
  const d = new Date(`${yy}-${mm}-01T00:00:00`);
  return d.toLocaleDateString("it-IT", { month:"long", year:"numeric" });
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function getSelectedMeds(){
  return Array.from(el("meds").selectedOptions).map(o => o.value);
}
function getSelectedTriggers(){
  const chips = document.querySelectorAll("#triggerChips input[type=checkbox]");
  return Array.from(chips).filter(x => x.checked).map(x => x.value);
}
function clearTriggers(){
  const chips = document.querySelectorAll("#triggerChips input[type=checkbox]");
  chips.forEach(x => x.checked = false);
}

/* =========================
   FILTERS
   ========================= */
function listForMonth(yyyyMM){
  const list = load();
  const [yy, mm] = yyyyMM.split("-");
  const start = `${yy}-${mm}-01`;
  const endDate = new Date(`${yy}-${mm}-01T00:00:00`);
  endDate.setMonth(endDate.getMonth()+1);
  const end = endDate.toISOString().slice(0,10);
  return list.filter(a => a.date >= start && a.date < end);
}

function filteredList(){
  const list = load();
  const m = month.value || monthNow();
  let out = listForMonth(m);

  const w = onlyWeekend.value;
  if (w === "weekend") out = out.filter(a => isWeekend(a.date));
  if (w === "weekday") out = out.filter(a => !isWeekend(a.date));

  const query = (q.value || "").trim().toLowerCase();
  if (query){
    out = out.filter(a => {
      const meds = (a.meds || []).join(" ").toLowerCase();
      const notes = (a.notes || "").toLowerCase();
      const trig = (a.triggers || []).join(" ").toLowerCase();
      const foods = (a.foods || "").toLowerCase();
      const weather = (a.weather || "").toLowerCase();
      return meds.includes(query) || notes.includes(query) || trig.includes(query) || foods.includes(query) || weather.includes(query);
    });
  }

  out.sort((x,y) => (y.date+(y.time||"")).localeCompare(x.date+(x.time||"")));
  return out;
}

/* =========================
   CRUD
   ========================= */
function addAttack(a){
  const list = load();
  list.push(a);
  list.sort((x,y) => (y.date+(y.time||"")).localeCompare(x.date+(x.time||"")));
  save(list);
}
function removeAttack(id){
  const list = load().filter(x => x.id !== id);
  save(list);
}

/* =========================
   RENDER: REGISTRO
   ========================= */
function render(){
  const list = filteredList();

  // desktop table
  rows.innerHTML = list.map(a => {
    const meds = (a.meds && a.meds.length) ? a.meds.join(", ") : "—";
    const note = a.notes?.trim() ? a.notes : "—";
    const trig = (a.triggers && a.triggers.length) ? a.triggers.join(", ") : "—";
    const wk = isWeekend(a.date) ? " • Weekend" : "";
    return `
      <tr>
        <td>${fmtDate(a.date, a.time)}<div class="muted" style="font-size:12px">${wk}</div></td>
        <td><strong>${a.intensity}</strong>/10</td>
        <td>${a.duration} h</td>
        <td>${escapeHtml(meds)}</td>
        <td>${escapeHtml(a.efficacy)}</td>
        <td>${escapeHtml(trig)}</td>
        <td>${escapeHtml(note)}</td>
        <td style="text-align:right">
          <button class="iconbtn" data-del="${a.id}" title="Elimina">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");

  // mobile cards
  cards.innerHTML = list.map(a => {
    const meds = (a.meds && a.meds.length) ? a.meds.join(", ") : "—";
    const note = a.notes?.trim() ? a.notes : "—";
    const trig = (a.triggers && a.triggers.length) ? a.triggers.join(", ") : "—";
    const wk = isWeekend(a.date) ? "Weekend" : "Feriale";
    const extras = compactExtras(a);
    return `
      <div class="card-row">
        <div class="top">
          <div>
            <div style="font-weight:900">${fmtDate(a.date, a.time)} <span class="muted">• ${wk}</span></div>
            <div class="small">${escapeHtml(extras)}</div>
          </div>
          <div class="badge">${a.intensity}/10</div>
        </div>
        <div class="small" style="margin-top:8px"><strong>Durata:</strong> ${a.duration} h</div>
        <div class="small"><strong>Farmaci:</strong> ${escapeHtml(meds)}</div>
        <div class="small"><strong>Efficacia:</strong> ${escapeHtml(a.efficacy)}</div>
        <div class="small"><strong>Trigger:</strong> ${escapeHtml(trig)}</div>
        <div class="small"><strong>Note:</strong> ${escapeHtml(note)}</div>
        <div style="display:flex; justify-content:flex-end; margin-top:10px">
          <button class="iconbtn" data-del="${a.id}">Elimina</button>
        </div>
      </div>
    `;
  }).join("");

  // delete events
  document.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-del");
      removeAttack(id);
      render();
      renderMonthlyTable();
      drawChartsFor(statsMonth.value || monthNow());
    });
  });

  renderStats(list);
  renderMonthlyTable();
}

function compactExtras(a){
  const parts = [];
  if (typeof a.stress === "number" && a.stress > 0) parts.push(`Stress ${a.stress}/10`);
  if (typeof a.sleepHours === "number" && a.sleepHours >= 0) parts.push(`Sonno ${a.sleepHours}h`);
  if (a.weather) parts.push(a.weather);
  if (a.foods) parts.push(`Alimenti: ${a.foods}`);
  return parts.length ? parts.join(" • ") : "—";
}

function renderStats(list){
  if (!list.length){
    stats.innerHTML = `<span class="stat-pill">Nessun dato nel filtro selezionato</span>`;
    return;
  }

  const daysWithAttack = new Set(list.map(a => a.date)).size;
  const avgIntensity = (list.reduce((s,a)=>s + Number(a.intensity||0), 0) / list.length).toFixed(1);
  const avgDuration = (list.reduce((s,a)=>s + Number(a.duration||0), 0) / list.length).toFixed(1);

  const weekend = list.filter(a => isWeekend(a.date));
  const weekday = list.filter(a => !isWeekend(a.date));

  const avgWk = weekend.length ? (weekend.reduce((s,a)=>s+Number(a.intensity||0),0)/weekend.length).toFixed(1) : "—";
  const avgWd = weekday.length ? (weekday.reduce((s,a)=>s+Number(a.intensity||0),0)/weekday.length).toFixed(1) : "—";

  stats.innerHTML = `
    <span class="stat-pill">Attacchi: <strong>${list.length}</strong></span>
    <span class="stat-pill">Giorni con attacco: <strong>${daysWithAttack}</strong></span>
    <span class="stat-pill">Intensità media: <strong>${avgIntensity}</strong>/10</span>
    <span class="stat-pill">Durata media: <strong>${avgDuration}</strong> h</span>
    <span class="stat-pill">Media Weekend: <strong>${avgWk}</strong>/10</span>
    <span class="stat-pill">Media Feriali: <strong>${avgWd}</strong>/10</span>
  `;
}

/* =========================
   MONTHLY TABLE (REPORT VIEW)
   ========================= */
function daysInMonth(yyyyMM){
  const [yy, mm] = yyyyMM.split("-");
  const start = new Date(`${yy}-${mm}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth()+1);
  end.setDate(0);
  return end.getDate();
}
function isoOfDay(yyyyMM, day){
  const [yy, mm] = yyyyMM.split("-");
  const dd = String(day).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}
function attacksByDayForMonth(yyyyMM){
  const monthAttacks = listForMonth(yyyyMM);
  const map = new Map();
  for (const a of monthAttacks){
    const arr = map.get(a.date) || [];
    arr.push(a);
    map.set(a.date, arr);
  }
  for (const [k, arr] of map.entries()){
    arr.sort((x,y)=> (x.time||"").localeCompare(y.time||""));
  }
  return map;
}

function summarizeDayAttacks(dayAttacks){
  const maxInt = Math.max(...dayAttacks.map(a => Number(a.intensity||0)));
  const sumDur = (dayAttacks.reduce((s,a)=> s + Number(a.duration||0), 0)).toFixed(1);

  const medsSet = new Set();
  dayAttacks.forEach(a => (a.meds||[]).forEach(m => medsSet.add(m)));
  const meds = Array.from(medsSet).join(", ");

  const trigSet = new Set();
  dayAttacks.forEach(a => (a.triggers||[]).forEach(t => trigSet.add(t)));
  const trig = Array.from(trigSet).join(", ");

  const order = ["Nessuna","Parziale","Buona","Ottima"];
  const worstEff = dayAttacks
    .map(a => a.efficacy || "Parziale")
    .sort((a,b)=> order.indexOf(a) - order.indexOf(b))[0];

  const notes = dayAttacks.map(a => {
    const t = a.time ? a.time + " " : "";
    const n = (a.notes||"").trim();
    return n ? `${t}${n}` : (t ? `${t}attacco` : "attacco");
  }).join(" • ");

  const extras = dayAttacks.map(a => compactExtras(a)).filter(x => x && x !== "—").join(" • ");

  const trigNote = [trig ? `Trigger: ${trig}` : "", extras ? extras : "", notes ? `Note: ${notes}` : ""]
    .filter(Boolean)
    .join(" — ");

  return { maxInt, sumDur, meds, worstEff, trigNote };
}

function renderMonthlyTable(){
  const m = printMonth.value || monthNow();
  printMonth.value = m;

  const dcount = daysInMonth(m);
  const map = attacksByDayForMonth(m);

  let html = "";
  for (let day=1; day<=dcount; day++){
    const iso = isoOfDay(m, day);
    const d = new Date(iso + "T00:00:00");
    const dow = d.toLocaleDateString("it-IT", { weekday:"short" });
    const wk = isWeekend(iso) ? " (weekend)" : "";

    const dayAttacks = map.get(iso) || [];
    if (dayAttacks.length === 0){
      html += `
        <tr>
          <td>${String(day).padStart(2,"0")}/${m.slice(5,7)} (${dow})${wk}</td>
          <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
        </tr>
      `;
      continue;
    }

    const s = summarizeDayAttacks(dayAttacks);

    html += `
      <tr>
        <td>${String(day).padStart(2,"0")}/${m.slice(5,7)} (${dow})${wk}</td>
        <td><strong>${s.maxInt}</strong>/10</td>
        <td>${s.sumDur} h</td>
        <td>${escapeHtml(s.meds || "—")}</td>
        <td>${escapeHtml(s.worstEff || "—")}</td>
        <td>${escapeHtml(s.trigNote || "—")}</td>
      </tr>
    `;
  }
  monthlyRows.innerHTML = html;
}

/* =========================
   CSV EXPORT
   ========================= */
function exportCSV(yyyyMM, mode){
  const list = mode === "all" ? load() : listForMonth(yyyyMM);
  const header = [
    "Data","Ora","Intensità","Durata_ore","Farmaci","Efficacia","Trigger",
    "Stress_0_10","Ore_sonno","Meteo","Alimenti","Note","Weekend"
  ];
  const lines = [header.join(";")];

  for (const a of list){
    const meds = (a.meds && a.meds.length) ? a.meds.join(", ") : "";
    const trig = (a.triggers && a.triggers.length) ? a.triggers.join(", ") : "";
    const row = [
      a.date,
      a.time || "",
      a.intensity,
      a.duration,
      meds,
      a.efficacy,
      trig,
      (typeof a.stress === "number" ? a.stress : ""),
      (typeof a.sleepHours === "number" ? a.sleepHours : ""),
      a.weather || "",
      a.foods || "",
      (a.notes||"").replaceAll("\n"," ").trim(),
      isWeekend(a.date) ? "SI" : "NO"
    ].map(v => `"${String(v).replaceAll('"','""')}"`);
    lines.push(row.join(";"));
  }

  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = mode === "all"
    ? `diario-cefalea_TUTTO.csv`
    : `diario-cefalea_${yyyyMM}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
   BACKUP / IMPORT
   ========================= */
function backupJSON(){
  const blob = new Blob([localStorage.getItem(KEY) || "[]"], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_diario_cefalea.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function importJSON(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("Formato non valido");
      const current = load();
      const map = new Map(current.map(x => [x.id, x]));
      parsed.forEach(x => { if (x && x.id) map.set(x.id, x); });
      const merged = Array.from(map.values());
      merged.sort((x,y) => (y.date+(y.time||"")).localeCompare(x.date+(x.time||"")));
      save(merged);
      render();
      drawChartsFor(statsMonth.value || monthNow());
      alert("Import completato ✅");
    }catch(e){
      alert("Import non riuscito: file non valido");
    }
  };
  reader.readAsText(file);
}

/* =========================
   TRIGGERS “DEDUCED”
   ========================= */
function deducedTriggers({stress, sleepHours, weather, foods}){
  const out = [];
  if (typeof stress === "number" && stress >= 7) out.push("Stress alto");
  if (typeof sleepHours === "number" && sleepHours > 0 && sleepHours < 6) out.push("Poco sonno");
  if (weather) out.push("Meteo");
  if (foods && foods.trim()) out.push("Alimenti");
  return out;
}

/* =========================
   SIMPLE CANVAS CHARTS
   ========================= */
function clearCanvas(c){
  const ctx = c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
  return ctx;
}
function cssColor(varName, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function drawBarChart(canvas, labels, values, options){
  const ctx = clearCanvas(canvas);
  const W = canvas.width, H = canvas.height;

  const padL = 44, padR = 12, padT = 14, padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxV = Math.max(1, ...values);
  const gridColor = options.gridColor;
  const textColor = options.textColor;
  const barColor = options.barColor;

  // background
  ctx.fillStyle = options.bgColor;
  ctx.fillRect(0,0,W,H);

  // grid + y labels
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.lineWidth = 1;

  const steps = 4;
  for (let i=0;i<=steps;i++){
    const y = padT + (plotH * i/steps);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W-padR, y);
    ctx.stroke();
    const val = Math.round(maxV * (1 - i/steps));
    ctx.font = "12px system-ui";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(val), padL - 8, y);
  }

  // bars
  const n = labels.length;
  const gap = 4;
  const barW = n ? Math.max(2, (plotW / n) - gap) : plotW;

  for (let i=0;i<n;i++){
    const v = values[i];
    const x = padL + i*(barW+gap);
    const h = (v / maxV) * plotH;
    const y = padT + (plotH - h);
    ctx.fillStyle = barColor;
    ctx.fillRect(x, y, barW, h);
  }

  // x labels (sparse)
  ctx.fillStyle = textColor;
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const every = n > 18 ? 3 : 1;
  for (let i=0;i<n;i+=every){
    const x = padL + i*(barW+gap) + barW/2;
    ctx.fillText(labels[i], x, H - padB + 10);
  }
}

function topCounts(items){
  const m = new Map();
  for (const it of items){
    if (!it) continue;
    m.set(it, (m.get(it)||0)+1);
  }
  const arr = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
  return arr;
}

/* =========================
   BUILD CHART DATA
   ========================= */
function drawChartsFor(yyyyMM){
  const list = listForMonth(yyyyMM);
  const dcount = daysInMonth(yyyyMM);

  // intensity per day (max)
  const byDay = attacksByDayForMonth(yyyyMM);
  const labels = [];
  const vals = [];
  for (let day=1; day<=dcount; day++){
    const iso = isoOfDay(yyyyMM, day);
    labels.push(String(day));
    const dayAttacks = byDay.get(iso) || [];
    if (!dayAttacks.length){ vals.push(0); continue; }
    const maxInt = Math.max(...dayAttacks.map(a => Number(a.intensity||0)));
    vals.push(maxInt);
  }

  const bg = cssColor("--card", "#111a2d");
  const grid = cssColor("--line", "#24314f");
  const txt = cssColor("--muted", "#a6b3d1");
  const bar = cssColor("--btn", "#2b6cff");

  drawBarChart(chartIntensity, labels, vals, {
    bgColor: bg,
    gridColor: grid,
    textColor: txt,
    barColor: bar,
  });

  // triggers counts
  const allTrig = [];
  for (const a of list){
    const t = new Set([...(a.triggers||[]), ...deducedTriggers(a)]);
    t.forEach(x => allTrig.push(x));
  }
  const trigCounts = topCounts(allTrig).slice(0, 10);
  drawBarChart(chartTriggers,
    trigCounts.map(x=>x[0]),
    trigCounts.map(x=>x[1]),
    { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar }
  );

  // meds counts
  const allMeds = [];
  for (const a of list){
    (a.meds||[]).forEach(x => allMeds.push(x));
  }
  const medsCounts = topCounts(allMeds).slice(0, 10);
  drawBarChart(chartMeds,
    medsCounts.map(x=>x[0].replace(" (FANS)","")),
    medsCounts.map(x=>x[1]),
    { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar }
  );
}

/* =========================
   REPORT PDF / PRINT
   ========================= */
function kpiReport(yyyyMM){
  const list = listForMonth(yyyyMM);
  const daysWithAttack = new Set(list.map(a => a.date)).size;
  const avgIntensity = list.length ? (list.reduce((s,a)=>s + Number(a.intensity||0),0)/list.length).toFixed(1) : "—";
  const avgDuration = list.length ? (list.reduce((s,a)=>s + Number(a.duration||0),0)/list.length).toFixed(1) : "—";

  const weekend = list.filter(a => isWeekend(a.date));
  const weekday = list.filter(a => !isWeekend(a.date));
  const avgWk = weekend.length ? (weekend.reduce((s,a)=>s+Number(a.intensity||0),0)/weekend.length).toFixed(1) : "—";
  const avgWd = weekday.length ? (weekday.reduce((s,a)=>s+Number(a.intensity||0),0)/weekday.length).toFixed(1) : "—";

  // top triggers
  const allTrig = [];
  for (const a of list){
    const t = new Set([...(a.triggers||[]), ...deducedTriggers(a)]);
    t.forEach(x => allTrig.push(x));
  }
  const trigCounts = topCounts(allTrig).slice(0, 4)
    .map(([k,v]) => `${k} (${v})`)
    .join(", ") || "—";

  // meds top
  const allMeds = [];
  for (const a of list){ (a.meds||[]).forEach(x => allMeds.push(x)); }
  const medsCounts = topCounts(allMeds).slice(0, 4)
    .map(([k,v]) => `${k.replace(" (FANS)","")} (${v})`)
    .join(", ") || "—";

  return {
    total: list.length,
    daysWithAttack,
    avgIntensity,
    avgDuration,
    avgWk,
    avgWd,
    topTriggers: trigCounts,
    topMeds: medsCounts
  };
}

function cloneCanvasScaled(source, targetW, targetH){
  const c = document.createElement("canvas");
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return c;
}

function printReport(){
  const m = printMonth.value || monthNow();
  const label = monthLabel(m);
  const nome = getPatientName() || "__________________________";

  // ensure table and charts are fresh
  renderMonthlyTable();
  drawChartsFor(m);

  const kpi = kpiReport(m);

  // Build print DOM
  // Optional logo (if you add ./assets/ptv.png with permission): it will show, otherwise removed.
  printArea.innerHTML = `
    <div class="print-sheet">
      <div class="ptv-head">
        <div class="ptv-left">
          <div class="ptv-title">FONDAZIONE PTV</div>
          <div class="ptv-sub">POLICLINICO TOR VERGATA</div>
        </div>
        <img class="ptv-logo" src="./assets/ptv.png" alt="Logo" onerror="this.remove()">
      </div>

      <h1>Report Cefalea – ${escapeHtml(label)}</h1>

      <div class="ptv-meta">
        <div><strong>Nome e Cognome:</strong> ${escapeHtml(nome)}</div>
        <div><strong>Referente Centro Cefalee:</strong> Dr.ssa Maria Albanese</div>
        <div><strong>Data generazione:</strong> ${new Date().toLocaleDateString("it-IT")}</div>
        <div><strong>Sito/app:</strong> Diario Cefalea (PWA)</div>
      </div>

      <p class="ptv-instr">Compila ogni riga indicando la frequenza, intensità, durata e risposta ai farmaci.</p>

      <div class="report-grid">
        <div class="report-box">
          <h3>Riepilogo</h3>
          <div class="kpi">
            <div><strong>Attacchi:</strong> ${kpi.total}</div>
            <div><strong>Giorni con attacco:</strong> ${kpi.daysWithAttack}</div>
            <div><strong>Intensità media:</strong> ${kpi.avgIntensity}/10</div>
            <div><strong>Durata media:</strong> ${kpi.avgDuration} h</div>
            <div><strong>Media weekend:</strong> ${kpi.avgWk}/10</div>
            <div><strong>Media feriali:</strong> ${kpi.avgWd}/10</div>
          </div>
        </div>

        <div class="report-box">
          <h3>Focus clinico</h3>
          <div class="kpi" style="grid-template-columns: 1fr;">
            <div><strong>Trigger principali:</strong> ${escapeHtml(kpi.topTriggers)}</div>
            <div><strong>Farmaci più usati:</strong> ${escapeHtml(kpi.topMeds)}</div>
          </div>
        </div>
      </div>

      <div class="print-chart">
        <h3>Intensità (max) per giorno</h3>
        <div id="printChartIntensity"></div>
      </div>

      <div class="print-chart">
        <h3>Trigger più frequenti</h3>
        <div id="printChartTriggers"></div>
      </div>

      <div class="print-chart">
        <h3>Farmaci più usati</h3>
        <div id="printChartMeds"></div>
      </div>

      <div class="print-chart">
        <h3>Tabella giornaliera</h3>
        ${el("monthlyTable").outerHTML}
      </div>

      <p class="print-foot">Documento generato dall’app Diario Cefalea</p>
    </div>
  `;

  // inject canvases into print DOM
  const p1 = printArea.querySelector("#printChartIntensity");
  const p2 = printArea.querySelector("#printChartTriggers");
  const p3 = printArea.querySelector("#printChartMeds");

  p1.appendChild(cloneCanvas(chartIntensity));
  p2.appendChild(cloneCanvas(chartTriggers));
  p3.appendChild(cloneCanvas(chartMeds));

  window.print();
}

/* =========================
   FORM
   ========================= */
function resetFormFields(){
  el("time").value = "";
  el("intensity").value = "";
  el("duration").value = "";
  el("notes").value = "";
  el("sleepHours").value = "";
  el("weather").value = "";
  el("foods").value = "";
  stress.value = "0";
  stressVal.textContent = "0";
  clearTriggers();
  Array.from(el("meds").options).forEach(o => o.selected = false);
}

form.addEventListener("submit", (ev) => {
  ev.preventDefault();

  const date = el("date").value;
  const time = el("time").value || "";
  const intensity = Number(el("intensity").value);
  const duration = Number(el("duration").value);

  const meds = getSelectedMeds();
  const efficacy = el("efficacy").value;
  const notes = el("notes").value || "";

  const stressValNum = Number(stress.value);
  const sleepHoursVal = el("sleepHours").value === "" ? null : Number(el("sleepHours").value);
  const weatherVal = el("weather").value || "";
  const foodsVal = el("foods").value || "";
  const triggersManual = getSelectedTriggers();

  // merge triggers: manual + deduced (no duplicates)
  const trig = new Set([...triggersManual, ...deducedTriggers({
    stress: stressValNum,
    sleepHours: sleepHoursVal ?? undefined,
    weather: weatherVal,
    foods: foodsVal
  })]);

  const a = {
    id: crypto.randomUUID(),
    date,
    time,
    intensity,
    duration,
    meds,
    efficacy,
    triggers: Array.from(trig),
    stress: stressValNum,
    sleepHours: sleepHoursVal,
    weather: weatherVal,
    foods: foodsVal,
    notes
  };

  addAttack(a);
  render();
  drawChartsFor(statsMonth.value || monthNow());

  // keep date, reset rest
  resetFormFields();
});

btnClear.addEventListener("click", resetFormFields);

/* =========================
   EVENTS: FILTERS / BUTTONS
   ========================= */
btnDeleteAll.addEventListener("click", () => {
  const ok = confirm("Vuoi cancellare TUTTI i dati salvati in questa app?");
  if (!ok) return;
  localStorage.removeItem(KEY);
  render();
  drawChartsFor(statsMonth.value || monthNow());
});

month.addEventListener("change", render);
onlyWeekend.addEventListener("change", render);
q.addEventListener("input", () => {
  clearTimeout(window.__qT);
  window.__qT = setTimeout(render, 150);
});

btnExportMonth.addEventListener("click", () => exportCSV(month.value || monthNow(), "month"));
btnExportAll.addEventListener("click", () => exportCSV(monthNow(), "all"));

btnBackup.addEventListener("click", backupJSON);
fileImport.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) importJSON(file);
  fileImport.value = "";
});

btnPrintReport.addEventListener("click", printReport);

/* patient name */
patientNameInput.addEventListener("input", () => setPatientName(patientNameInput.value));

/* stress slider */
stress.addEventListener("input", () => {
  stressVal.textContent = stress.value;
});

/* theme */
themeSelect.addEventListener("change", () => setTheme(themeSelect.value));

/* tabs */
tabs.forEach(t => {
  t.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    const v = t.getAttribute("data-view");
    Object.values(views).forEach(s => s.classList.remove("active"));
    views[v].classList.add("active");
    if (v === "statistiche") drawChartsFor(statsMonth.value || monthNow());
    if (v === "report") renderMonthlyTable();
  });
});

/* charts refresh */
btnRefreshCharts.addEventListener("click", () => drawChartsFor(statsMonth.value || monthNow()));
statsMonth.addEventListener("change", () => drawChartsFor(statsMonth.value || monthNow()));
printMonth.addEventListener("change", renderMonthlyTable);

/* Install PWA */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.hidden = false;
});
btnInstall.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstall.hidden = true;
});

/* Init */
(function init(){
  // theme
  const th = getTheme();
  themeSelect.value = th;
  setTheme(th);

  // date defaults
  el("date").value = isoToday();
  month.value = monthNow();
  statsMonth.value = monthNow();
  printMonth.value = monthNow();

  // patient name
  patientNameInput.value = getPatientName();

  // stress display
  stressVal.textContent = stress.value;

  render();
  drawChartsFor(statsMonth.value || monthNow());

  // Service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }
})();
