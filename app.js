/* =========================
   Diario Cefalea - app.js (COMPLETO, aggiornato)
   - Report: azioni giorno per giorno (＋ Aggiungi / Apri)
   - Tap su giorno: porta su Diario con data pronta
   - PDF/Print: tabella pulita + grafici inclusi (stampa HTML)
   - NOVITÀ: Genera un PDF VERO e lo condivide (WhatsApp incluso) via Share Sheet
   ========================= */

const KEY = "cefalea_attacks_v2";
const KEY_NAME = "cefalea_patient_name_v2";
const KEY_THEME = "cefalea_theme_v1";

const el = (id) => document.getElementById(id);

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

const btnPrintReportTop = el("btnPrintReportTop");
const btnPrintReportBottom = el("btnPrintReportBottom");

/* NEW: share PDF buttons */
const btnSharePDFTop = el("btnSharePDFTop");
const btnSharePDFBottom = el("btnSharePDFBottom");

const patientNameInput = el("patientName");

const stress = el("stress");
const stressVal = el("stressVal");

const themeSelect = el("themeSelect");
const chartIntensity = el("chartIntensity");
const chartTriggers = el("chartTriggers");
const chartMeds = el("chartMeds");

/* PWA install */
let deferredPrompt = null;
const btnInstall = el("btnInstall");

/* Edit state */
let EDIT_ID = null;

/* =========================
   Storage helpers
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
  const t = (v || "auto").trim();
  localStorage.setItem(KEY_THEME, t);
  document.documentElement.setAttribute("data-theme", t);
}

/* =========================
   Date helpers
   ========================= */
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
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function cryptoId(){
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

/* =========================
   Form helpers
   ========================= */
function getSelectedMeds(){
  const s = el("meds");
  if (!s) return [];
  return Array.from(s.selectedOptions).map(o => o.value);
}
function setSelectedMeds(list){
  const s = el("meds");
  if (!s) return;
  const set = new Set(list || []);
  Array.from(s.options).forEach(o => o.selected = set.has(o.value));
}
function getSelectedTriggers(){
  const chips = document.querySelectorAll("#triggerChips input[type=checkbox]");
  return Array.from(chips).filter(x => x.checked).map(x => x.value);
}
function setSelectedTriggers(list){
  const set = new Set(list || []);
  const chips = document.querySelectorAll("#triggerChips input[type=checkbox]");
  chips.forEach(x => x.checked = set.has(x.value));
}
function clearTriggers(){
  const chips = document.querySelectorAll("#triggerChips input[type=checkbox]");
  chips.forEach(x => x.checked = false);
}
function setDateField(dateISO){
  const d1 = el("date");
  if (d1){ d1.value = dateISO; return true; }
  const d2 = document.querySelector('input[type="date"]');
  if (d2){ d2.value = dateISO; return true; }
  return false;
}
function resetFormFields(){
  if (el("time")) el("time").value = "";
  if (el("intensity")) el("intensity").value = "";
  if (el("duration")) el("duration").value = "";
  if (el("notes")) el("notes").value = "";
  if (el("sleepHours")) el("sleepHours").value = "";
  if (el("weather")) el("weather").value = "";
  if (el("foods")) el("foods").value = "";
  if (stress){ stress.value = "0"; }
  if (stressVal){ stressVal.textContent = "0"; }
  clearTriggers();
  const medsSel = el("meds");
  if (medsSel) Array.from(medsSel.options).forEach(o => o.selected = false);
}

/* =========================
   Deduced triggers
   ========================= */
function deducedTriggers({stress, sleepHours, weather, foods}){
  const out = [];
  if (typeof stress === "number" && stress >= 7) out.push("Stress alto");
  if (typeof sleepHours === "number" && sleepHours > 0 && sleepHours < 6) out.push("Poco sonno");
  if (weather && weather.trim()) out.push("Meteo");
  if (foods && foods.trim()) out.push("Alimenti");
  return out;
}
function compactExtras(a){
  const parts = [];
  if (typeof a.stress === "number" && a.stress > 0) parts.push(`Stress ${a.stress}/10`);
  if (typeof a.sleepHours === "number") parts.push(`Sonno ${a.sleepHours}h`);
  if (a.weather) parts.push(a.weather);
  if (a.foods) parts.push(`Alimenti: ${a.foods}`);
  return parts.length ? parts.join(" • ") : "—";
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
function updateAttack(id, patch){
  const list = load();
  const idx = list.findIndex(x => x.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...patch };
  list.sort((x,y) => (y.date+(y.time||"")).localeCompare(x.date+(x.time||"")));
  save(list);
  return true;
}
function removeAttack(id){
  const list = load().filter(x => x.id !== id);
  save(list);
}
function getAttackById(id){
  return load().find(x => x.id === id) || null;
}

/* =========================
   Month helpers
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

/* =========================
   Filters
   ========================= */
function filteredList(){
  const m = (month?.value || monthNow()).trim();
  let out = listForMonth(m);

  const w = onlyWeekend?.value || "all";
  if (w === "weekend") out = out.filter(a => isWeekend(a.date));
  if (w === "weekday") out = out.filter(a => !isWeekend(a.date));

  const query = (q?.value || "").trim().toLowerCase();
  if (query){
    out = out.filter(a => {
      const meds = (a.meds || []).join(" ").toLowerCase();
      const notes = (a.notes || "").toLowerCase();
      const trig = (a.triggers || []).join(" ").toLowerCase();
      const foods = (a.foods || "").toLowerCase();
      const weather = (a.weather || "").toLowerCase();
      const date = (a.date || "").toLowerCase();
      return meds.includes(query) || notes.includes(query) || trig.includes(query) || foods.includes(query) || weather.includes(query) || date.includes(query);
    });
  }

  out.sort((x,y) => (y.date+(y.time||"")).localeCompare(x.date+(x.time||"")));
  return out;
}

/* =========================
   Tabs
   ========================= */
function switchTo(viewKey){
  tabs.forEach(x => x.classList.remove("active"));
  const tab = tabs.find(t => t.getAttribute("data-view") === viewKey);
  tab?.classList.add("active");
  Object.values(views).forEach(s => s?.classList.remove("active"));
  views[viewKey]?.classList.add("active");

  if (viewKey === "statistiche") drawChartsFor(statsMonth?.value || monthNow());
  if (viewKey === "report") renderMonthlyTable();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   Stats pills
   ========================= */
function renderStats(list){
  if (!stats) return;
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
   Edit
   ========================= */
function setSubmitLabel(){
  const btn = form?.querySelector("button[type=submit]");
  if (!btn) return;
  btn.textContent = EDIT_ID ? "Salva modifica" : "Salva attacco";
}
function startEdit(id){
  const a = getAttackById(id);
  if (!a) return;

  EDIT_ID = id;
  setDateField(a.date || isoToday());
  if (el("time")) el("time").value = a.time || "";
  if (el("intensity")) el("intensity").value = a.intensity ?? "";
  if (el("duration")) el("duration").value = a.duration ?? "";
  if (el("efficacy")) el("efficacy").value = a.efficacy || "Parziale";
  if (el("notes")) el("notes").value = a.notes || "";
  if (el("sleepHours")) el("sleepHours").value = (a.sleepHours ?? "") === null ? "" : (a.sleepHours ?? "");
  if (el("weather")) el("weather").value = a.weather || "";
  if (el("foods")) el("foods").value = a.foods || "";
  if (stress){ stress.value = String(a.stress ?? 0); }
  if (stressVal){ stressVal.textContent = String(a.stress ?? 0); }

  setSelectedMeds(a.meds || []);
  setSelectedTriggers(a.triggers || []);

  setSubmitLabel();
  switchTo("diario");
  el("card-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function cancelEdit(){
  EDIT_ID = null;
  setSubmitLabel();
  resetFormFields();
}

/* =========================
   Render list
   ========================= */
function render(){
  const list = filteredList();

  if (rows){
    rows.innerHTML = list.map(a => {
      const meds = (a.meds && a.meds.length) ? a.meds.join(", ") : "—";
      const note = a.notes?.trim() ? a.notes : "—";
      const trig = (a.triggers && a.triggers.length) ? a.triggers.join(", ") : "—";
      const wk = isWeekend(a.date) ? "Weekend" : "Feriale";
      return `
        <tr>
          <td>${fmtDate(a.date, a.time)}<div class="muted small">${wk}</div></td>
          <td><strong>${a.intensity}</strong>/10</td>
          <td>${a.duration} h</td>
          <td>${escapeHtml(meds)}</td>
          <td>${escapeHtml(a.efficacy)}</td>
          <td>${escapeHtml(trig)}</td>
          <td>${escapeHtml(note)}</td>
          <td style="text-align:right; white-space:nowrap">
            <button class="iconbtn" data-edit="${a.id}" title="Modifica">✏️</button>
            <button class="iconbtn" data-del="${a.id}" title="Elimina">🗑️</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  if (cards){
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
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px">
            <button class="iconbtn" data-edit="${a.id}">Modifica</button>
            <button class="iconbtn" data-del="${a.id}">Elimina</button>
          </div>
        </div>
      `;
    }).join("");
  }

  document.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-del");
      if (EDIT_ID === id) cancelEdit();
      removeAttack(id);
      render();
      renderMonthlyTable();
      drawChartsFor(statsMonth?.value || monthNow());
    });
  });

  document.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-edit");
      startEdit(id);
    });
  });

  renderStats(list);
  renderMonthlyTable();
}

/* =========================
   Report helpers
   ========================= */
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

function goToDiaryWithDate(dateISO){
  if (EDIT_ID) cancelEdit();
  switchTo("diario");
  setDateField(dateISO);
  el("card-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => el("intensity")?.focus(), 250);
}

function goToDiaryOpenDay(dateISO){
  const m = dateISO.slice(0,7);
  if (month) month.value = m;
  if (q) q.value = dateISO;
  if (onlyWeekend) onlyWeekend.value = "all";
  render();
  switchTo("diario");
  el("card-registro")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindReportActions(){
  document.querySelectorAll("[data-add-date]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dateISO = btn.getAttribute("data-add-date");
      if (dateISO) goToDiaryWithDate(dateISO);
    });
  });

  document.querySelectorAll("[data-open-date]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dateISO = btn.getAttribute("data-open-date");
      if (dateISO) goToDiaryOpenDay(dateISO);
    });
  });

  document.querySelectorAll("[data-dayrow]").forEach(tr => {
    tr.addEventListener("click", () => {
      const dateISO = tr.getAttribute("data-dayrow");
      if (dateISO) goToDiaryWithDate(dateISO);
    });
  });
}

/* =========================
   Report monthly table (UI)
   ========================= */
function renderMonthlyTable(){
  if (!monthlyRows || !printMonth) return;

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
        <tr data-dayrow="${iso}">
          <td>${String(day).padStart(2,"0")}/${m.slice(5,7)} (${dow})${wk}</td>
          <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
          <td style="white-space:nowrap; text-align:right">
            <button class="btn btn-primary" type="button" data-add-date="${iso}">＋ Aggiungi</button>
          </td>
        </tr>
      `;
      continue;
    }

    const s = summarizeDayAttacks(dayAttacks);
    html += `
      <tr data-dayrow="${iso}">
        <td>${String(day).padStart(2,"0")}/${m.slice(5,7)} (${dow})${wk}</td>
        <td><strong>${s.maxInt}</strong>/10</td>
        <td>${s.sumDur} h</td>
        <td>${escapeHtml(s.meds || "—")}</td>
        <td>${escapeHtml(s.worstEff || "—")}</td>
        <td>${escapeHtml(s.trigNote || "—")}</td>
        <td style="white-space:nowrap; text-align:right">
          <button class="btn btn-primary" type="button" data-add-date="${iso}">＋ Aggiungi</button>
          <button class="btn btn-ghost" type="button" data-open-date="${iso}">Apri</button>
        </td>
      </tr>
    `;
  }

  monthlyRows.innerHTML = html;
  bindReportActions();
}

/* =========================
   CSV export
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
   Backup/Import
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
      drawChartsFor(statsMonth?.value || monthNow());
      alert("Import completato ✅");
    }catch(e){
      alert("Import non riuscito: file non valido");
    }
  };
  reader.readAsText(file);
}

/* =========================
   Charts (canvas)
   ========================= */
function cssColor(varName, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}
function ensureCanvasSize(canvas){
  if (!canvas) return { cssW: 0, cssH: 0, dpr: 1 };
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = Math.max(720, Math.floor(canvas.clientWidth || 0) || 0);
  const cssH = Math.max(320, Math.floor(canvas.clientHeight || 0) || 0);

  const needW = Math.floor(cssW * dpr);
  const needH = Math.floor(cssH * dpr);

  if (canvas.width !== needW) canvas.width = needW;
  if (canvas.height !== needH) canvas.height = needH;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH, dpr };
}

function drawBarChart(canvas, labels, values, options){
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { cssW: W, cssH: H } = ensureCanvasSize(canvas);

  ctx.fillStyle = options.bgColor;
  ctx.fillRect(0,0,W,H);

  const padL = 52, padR = 14, padT = 16, padB = 72;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxV = Math.max(1, ...values);
  ctx.strokeStyle = options.gridColor;
  ctx.fillStyle = options.textColor;
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
    ctx.fillText(String(val), padL - 10, y);
  }

  const n = labels.length;
  const gap = 3;
  const barW = n ? Math.max(3, (plotW / n) - gap) : plotW;

  for (let i=0;i<n;i++){
    const v = values[i];
    const x = padL + i*(barW+gap);
    const h = (v / maxV) * plotH;
    const y = padT + (plotH - h);
    ctx.fillStyle = options.barColor;
    ctx.fillRect(x, y, barW, h);
  }

  ctx.fillStyle = options.textColor;

  const smallFont = n > 25 ? 9 : 11;
  ctx.font = `${smallFont}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let i=0;i<n;i++){
    const x = padL + i*(barW+gap) + barW/2;
    const y = H - padB + 24;
    if (n > 25 && (i+1) % 2 === 0) continue;
    ctx.fillText(labels[i], x, y);
  }
}

function topCounts(items){
  const m = new Map();
  for (const it of items){
    if (!it) continue;
    m.set(it, (m.get(it)||0)+1);
  }
  return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
}

function drawChartsFor(yyyyMM){
  const list = listForMonth(yyyyMM);
  const dcount = daysInMonth(yyyyMM);

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
  const bar = cssColor("--primary", "#2b6cff");

  drawBarChart(chartIntensity, labels, vals, { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar });

  const allTrig = [];
  for (const a of list){
    const t = new Set([...(a.triggers||[]), ...deducedTriggers(a)]);
    t.forEach(x => allTrig.push(x));
  }
  const trigCounts = topCounts(allTrig).slice(0, 10);
  drawBarChart(
    chartTriggers,
    trigCounts.map(x=>x[0]),
    trigCounts.map(x=>x[1]),
    { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar }
  );

  const allMeds = [];
  for (const a of list){
    (a.meds||[]).forEach(x => allMeds.push(x));
  }
  const medsCounts = topCounts(allMeds).slice(0, 10);
  drawBarChart(
    chartMeds,
    medsCounts.map(x=>x[0].replace(" (FANS)","")),
    medsCounts.map(x=>x[1]),
    { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar }
  );
}

/* =========================
   PRINT / PDF (HTML print)
   ========================= */
function buildMonthlyTableHTML_ForPrint(yyyyMM){
  const dcount = daysInMonth(yyyyMM);
  const map = attacksByDayForMonth(yyyyMM);

  let body = "";
  for (let day=1; day<=dcount; day++){
    const iso = isoOfDay(yyyyMM, day);
    const d = new Date(iso + "T00:00:00");
    const dow = d.toLocaleDateString("it-IT", { weekday:"short" });
    const wk = isWeekend(iso) ? " (weekend)" : "";

    const dayAttacks = map.get(iso) || [];

    if (dayAttacks.length === 0){
      body += `
        <tr>
          <td>${String(day).padStart(2,"0")}/${yyyyMM.slice(5,7)} (${dow})${wk}</td>
          <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
        </tr>
      `;
      continue;
    }

    const s = summarizeDayAttacks(dayAttacks);
    body += `
      <tr>
        <td>${String(day).padStart(2,"0")}/${yyyyMM.slice(5,7)} (${dow})${wk}</td>
        <td><strong>${s.maxInt}</strong>/10</td>
        <td>${s.sumDur} h</td>
        <td>${escapeHtml(s.meds || "—")}</td>
        <td>${escapeHtml(s.worstEff || "—")}</td>
        <td>${escapeHtml(s.trigNote || "—")}</td>
      </tr>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Giorno</th>
          <th>Intensità</th>
          <th>Durata</th>
          <th>Farmaci</th>
          <th>Risposta</th>
          <th>Note / Trigger</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function buildPrintHTML(yyyyMM){
  renderMonthlyTable();
  drawChartsFor(yyyyMM);

  const imgInt = chartIntensity ? chartIntensity.toDataURL("image/png") : "";
  const imgTrig = chartTriggers ? chartTriggers.toDataURL("image/png") : "";
  const imgMeds = chartMeds ? chartMeds.toDataURL("image/png") : "";

  const monthList = listForMonth(yyyyMM);
  const hasAnyData = monthList.length > 0;

  const label = monthLabel(yyyyMM);
  const nome = getPatientName() || "__________________________";

  const tableHTMLPrint = buildMonthlyTableHTML_ForPrint(yyyyMM);

  const printCSS = `
    @page { size: A4; margin: 12mm; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; }
    img{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ptv-head{ display:flex; justify-content:space-between; gap:12px; margin-bottom: 8px; }
    .ptv-title{ font-weight: 900; letter-spacing:.08em; font-size: 12px; }
    .ptv-sub{ font-weight: 800; letter-spacing:.04em; font-size: 11px; color:#333; margin-top: 2px; }
    h1{ margin:10px 0 8px 0; font-size:16px; }
    h3{ margin:10px 0 6px 0; font-size:13px; }
    .ptv-meta{ display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; font-size:11px; margin: 6px 0 8px 0; }
    .ptv-instr{ margin: 0 0 8px 0; font-size:11px; color:#333; }
    .chart{ border:1px solid #ddd; border-radius:10px; padding: 6mm; margin: 6mm 0; break-inside: avoid; page-break-inside: avoid; }
    .chart img{ display:block; width:100%; height:auto; max-height:85mm; object-fit:contain; }
    .page-break{ break-before: page; page-break-before: always; }
    table{ width:100%; border-collapse:collapse; font-size:10px; }
    th, td{ border:1px solid #bbb; padding:6px; vertical-align:top; white-space:normal; }
    th{ background:#f2f2f2; text-transform:uppercase; letter-spacing:.04em; }
  `;

  return `
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Report Cefalea</title>
        <style>${printCSS}</style>
      </head>
      <body>
        <div class="ptv-head">
          <div>
            <div class="ptv-title">FONDAZIONE PTV</div>
            <div class="ptv-sub">POLICLINICO TOR VERGATA</div>
          </div>
          <div class="ptv-sub">Centro Cefalee</div>
        </div>

        <h1>Report Cefalea – ${escapeHtml(label)}</h1>

        <div class="ptv-meta">
          <div><strong>Nome e Cognome:</strong> ${escapeHtml(nome)}</div>
          <div><strong>Referente Centro Cefalee:</strong> Dr.ssa Maria Albanese</div>
          <div><strong>Data generazione:</strong> ${new Date().toLocaleDateString("it-IT")}</div>
        </div>

        <p class="ptv-instr">Compila ogni riga indicando la frequenza, intensità, durata e risposta ai farmaci.</p>

        <div class="chart">
          <h3>Intensità (max) giorno per giorno</h3>
          ${hasAnyData && imgInt ? `<img src="${imgInt}" alt="Grafico Intensità">`
          : `<p class="ptv-instr">Nessun dato registrato nel mese.</p>`}
        </div>

        <div class="chart">
          <h3>Trigger più frequenti</h3>
          ${hasAnyData && imgTrig ? `<img src="${imgTrig}" alt="Grafico Trigger">`
          : `<p class="ptv-instr">Nessun dato registrato nel mese.</p>`}
        </div>

        <div class="chart">
          <h3>Farmaci più usati</h3>
          ${hasAnyData && imgMeds ? `<img src="${imgMeds}" alt="Grafico Farmaci">`
          : `<p class="ptv-instr">Nessun dato registrato nel mese.</p>`}
        </div>

        <div class="page-break"></div>

        <h3>Tabella giornaliera</h3>
        ${tableHTMLPrint}
      </body>
    </html>
  `;
}

async function printReport(){
  try{
    const m = (printMonth?.value || monthNow()).trim();
    const html = buildPrintHTML(m);

    const w = window.open("", "_blank");
    if (!w){
      alert("Impossibile aprire la stampa: popup bloccato. Prova da Chrome.");
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();

    const waitImages = () => {
      const imgs = Array.from(w.document.images || []);
      if (!imgs.length) return Promise.resolve();
      return Promise.all(imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(res => {
          img.onload = () => res();
          img.onerror = () => res();
        });
      }));
    };

    w.onload = async () => {
      try{
        await waitImages();
        setTimeout(() => {
          w.focus();
          w.print();
        }, 250);
      }catch{
        setTimeout(() => {
          w.focus();
          w.print();
        }, 300);
      }
    };

  }catch(err){
    alert("Errore stampa/PDF: " + (err?.message || err));
    console.error(err);
  }
}

/* =========================
   NEW: PDF vero + Condivisione (WhatsApp)
   ========================= */

function buildMonthlyTableRowsForPDF(yyyyMM){
  const dcount = daysInMonth(yyyyMM);
  const map = attacksByDayForMonth(yyyyMM);
  const rows = [];

  for (let day=1; day<=dcount; day++){
    const iso = isoOfDay(yyyyMM, day);
    const d = new Date(iso + "T00:00:00");
    const dow = d.toLocaleDateString("it-IT", { weekday:"short" });
    const wk = isWeekend(iso) ? " (weekend)" : "";

    const dayAttacks = map.get(iso) || [];
    const dayLabel = `${String(day).padStart(2,"0")}/${yyyyMM.slice(5,7)} (${dow})${wk}`;

    if (!dayAttacks.length){
      rows.push([dayLabel, "—", "—", "—", "—", "—"]);
      continue;
    }

    const s = summarizeDayAttacks(dayAttacks);
    rows.push([
      dayLabel,
      `${s.maxInt}/10`,
      `${s.sumDur} h`,
      s.meds || "—",
      s.worstEff || "—",
      s.trigNote || "—"
    ]);
  }

  return rows;
}

async function fetchImageAsDataURL(url){
  try{
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  }catch{
    return null;
  }
}

function ensurePDFLib(){
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) return null;
  return jsPDF;
}

async function generateReportPDFBlob(yyyyMM){
  const jsPDF = ensurePDFLib();
  if (!jsPDF) throw new Error("Libreria PDF non caricata. Ricarica la pagina e riprova.");

  // rigenera grafici prima di catturarli
  drawChartsFor(yyyyMM);

  const label = monthLabel(yyyyMM);
  const nome = getPatientName() || "__________________________";
  const today = new Date().toLocaleDateString("it-IT");

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const margin = 12;
  const pageW = 210;
  const pageH = 297;
  const contentW = pageW - margin*2;

  const title = `Report Cefalea – ${label}`;

  // Logo opzionale (se esiste)
  const ptvLogo = await fetchImageAsDataURL("./assets/ptv.png");

  // Header
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);

  let y = margin;

  if (ptvLogo){
    // logo a sinistra
    doc.addImage(ptvLogo, "PNG", margin, y, 18, 18);
    doc.text("FONDAZIONE PTV", margin + 22, y + 7);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("POLICLINICO TOR VERGATA", margin + 22, y + 13);
    y += 22;
  } else {
    doc.text("FONDAZIONE PTV", margin, y + 6);
    doc.setFontSize(10);
    doc.text("POLICLINICO TOR VERGATA", margin, y + 12);
    y += 16;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Centro Cefalee", pageW - margin, margin + 6, { align: "right" });

  y += 2;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nome e Cognome: ${nome}`, margin, y); y += 6;
  doc.text(`Referente Centro Cefalee: Dr.ssa Maria Albanese`, margin, y); y += 6;
  doc.text(`Data generazione: ${today}`, margin, y); y += 8;

  doc.setFontSize(10);
  doc.setTextColor(70);
  doc.text("Compila ogni riga indicando la frequenza, intensità, durata e risposta ai farmaci.", margin, y);
  doc.setTextColor(20);

  // Charts pages
  const hasAnyData = listForMonth(yyyyMM).length > 0;

  const imgInt = (hasAnyData && chartIntensity) ? chartIntensity.toDataURL("image/png", 1.0) : null;
  const imgTrig = (hasAnyData && chartTriggers) ? chartTriggers.toDataURL("image/png", 1.0) : null;
  const imgMeds = (hasAnyData && chartMeds) ? chartMeds.toDataURL("image/png", 1.0) : null;

  const chartH = 85;

  // Page 1 chart intensity
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Intensità (max) giorno per giorno", margin, y);
  y += 6;

  doc.setDrawColor(220);
  doc.rect(margin, y, contentW, chartH);

  if (imgInt){
    doc.addImage(imgInt, "PNG", margin + 2, y + 2, contentW - 4, chartH - 4, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text("Nessun dato registrato nel mese.", margin + 6, y + 12);
    doc.setTextColor(20);
  }

  // Page 2: trigger + meds
  doc.addPage();
  y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Trigger più frequenti", margin, y); y += 6;
  doc.setDrawColor(220);
  doc.rect(margin, y, contentW, chartH);

  if (imgTrig){
    doc.addImage(imgTrig, "PNG", margin + 2, y + 2, contentW - 4, chartH - 4, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text("Nessun dato registrato nel mese.", margin + 6, y + 12);
    doc.setTextColor(20);
  }

  y += chartH + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Farmaci più usati", margin, y); y += 6;
  doc.setDrawColor(220);
  doc.rect(margin, y, contentW, chartH);

  if (imgMeds){
    doc.addImage(imgMeds, "PNG", margin + 2, y + 2, contentW - 4, chartH - 4, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text("Nessun dato registrato nel mese.", margin + 6, y + 12);
    doc.setTextColor(20);
  }

  // Page 3: table
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Tabella giornaliera", margin, margin);

  const tableRows = buildMonthlyTableRowsForPDF(yyyyMM);

  // AutoTable (plugin caricato da CDN)
  doc.autoTable({
    startY: margin + 6,
    head: [[ "Giorno", "Intensità", "Durata", "Farmaci", "Risposta", "Note / Trigger" ]],
    body: tableRows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top"
    },
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: [30, 30, 30],
      fontStyle: "bold"
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 18 },
      2: { cellWidth: 16 },
      3: { cellWidth: 42 },
      4: { cellWidth: 20 },
      5: { cellWidth: contentW - (34+18+16+42+20) }
    },
    margin: { left: margin, right: margin }
  });

  const blob = doc.output("blob");
  return blob;
}

async function shareReportPDF(){
  const m = (printMonth?.value || monthNow()).trim();

  try{
    // piccolo feedback
    const oldTextTop = btnSharePDFTop?.textContent;
    const oldTextBottom = btnSharePDFBottom?.textContent;
    if (btnSharePDFTop) btnSharePDFTop.textContent = "⏳ Preparazione PDF...";
    if (btnSharePDFBottom) btnSharePDFBottom.textContent = "⏳ Preparazione PDF...";

    const blob = await generateReportPDFBlob(m);
    const filename = `Report_Cefalea_${m}.pdf`;
    const file = new File([blob], filename, { type: "application/pdf" });

    const canShareFiles = !!navigator.canShare && navigator.canShare({ files: [file] });

    if (navigator.share && canShareFiles){
      await navigator.share({
        title: "Report Cefalea",
        text: `Report mensile (${monthLabel(m)})`,
        files: [file]
      });
      // dopo la condivisione, tutto ok
    } else {
      // fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert("Il tuo browser non supporta la condivisione diretta.\nHo avviato il download del PDF.");
    }

    if (btnSharePDFTop) btnSharePDFTop.textContent = oldTextTop || "📲 Invia PDF (WhatsApp)";
    if (btnSharePDFBottom) btnSharePDFBottom.textContent = oldTextBottom || "📲 Invia PDF (WhatsApp)";

  }catch(err){
    if (btnSharePDFTop) btnSharePDFTop.textContent = "📲 Invia PDF (WhatsApp)";
    if (btnSharePDFBottom) btnSharePDFBottom.textContent = "📲 Invia PDF (WhatsApp)";
    alert("Errore nella creazione/condivisione del PDF: " + (err?.message || err));
    console.error(err);
  }
}

/* =========================
   Events
   ========================= */
if (form){
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();

    const date = el("date")?.value;
    if (!date) return alert("Inserisci la data");

    const intensity = Number(el("intensity")?.value);
    const duration = Number(el("duration")?.value);

    if (!Number.isFinite(intensity) || intensity < 1 || intensity > 10) return alert("Inserisci intensità 1–10");
    if (!Number.isFinite(duration) || duration <= 0) return alert("Inserisci durata (ore)");

    const time = el("time")?.value || "";
    const meds = getSelectedMeds();
    const efficacy = el("efficacy")?.value || "Parziale";
    const notes = el("notes")?.value || "";

    const stressValNum = Number(stress?.value || 0);
    const sleepHoursVal = (el("sleepHours")?.value === "" || el("sleepHours") == null) ? null : Number(el("sleepHours").value);
    const weatherVal = el("weather")?.value || "";
    const foodsVal = el("foods")?.value || "";
    const triggersManual = getSelectedTriggers();

    const trig = new Set([
      ...triggersManual,
      ...deducedTriggers({
        stress: stressValNum,
        sleepHours: sleepHoursVal ?? undefined,
        weather: weatherVal,
        foods: foodsVal
      })
    ]);

    const payload = {
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

    if (EDIT_ID){
      updateAttack(EDIT_ID, payload);
      cancelEdit();
    } else {
      addAttack({ id: cryptoId(), ...payload });
      resetFormFields();
      setDateField(date);
    }

    render();
    drawChartsFor(statsMonth?.value || monthNow());
  });
}

btnClear?.addEventListener("click", () => {
  if (EDIT_ID) cancelEdit();
  else resetFormFields();
});

btnDeleteAll?.addEventListener("click", () => {
  const ok = confirm("Vuoi cancellare TUTTI i dati salvati in questa app?");
  if (!ok) return;
  localStorage.removeItem(KEY);
  cancelEdit();
  render();
  drawChartsFor(statsMonth?.value || monthNow());
});

month?.addEventListener("change", render);
onlyWeekend?.addEventListener("change", render);
q?.addEventListener("input", () => {
  clearTimeout(window.__qT);
  window.__qT = setTimeout(render, 150);
});

btnExportMonth?.addEventListener("click", () => exportCSV(month?.value || monthNow(), "month"));
btnExportAll?.addEventListener("click", () => exportCSV(monthNow(), "all"));

btnBackup?.addEventListener("click", backupJSON);
fileImport?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) importJSON(file);
  fileImport.value = "";
});

btnPrintReportTop?.addEventListener("click", () => {
  if (printMonth && month?.value) printMonth.value = month.value;
  printReport();
});
btnPrintReportBottom?.addEventListener("click", () => printReport());

/* NEW: share PDF */
btnSharePDFTop?.addEventListener("click", () => shareReportPDF());
btnSharePDFBottom?.addEventListener("click", () => shareReportPDF());

patientNameInput?.addEventListener("input", () => setPatientName(patientNameInput.value));

stress?.addEventListener("input", () => {
  if (stressVal) stressVal.textContent = stress.value;
});

btnRefreshCharts?.addEventListener("click", () => drawChartsFor(statsMonth?.value || monthNow()));
statsMonth?.addEventListener("change", () => drawChartsFor(statsMonth?.value || monthNow()));
printMonth?.addEventListener("change", renderMonthlyTable);

themeSelect?.addEventListener("change", () => setTheme(themeSelect.value));

tabs.forEach(t => {
  t.addEventListener("click", () => switchTo(t.getAttribute("data-view")));
});

/* PWA install */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstall) btnInstall.hidden = false;
});
btnInstall?.addEventListener("click", async () => {
  if (!deferredPrompt) {
    alert("Installazione non disponibile ora.\nApri questo link in Chrome → menu ⋮ → 'Installa app' / 'Aggiungi a schermata Home'.");
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (btnInstall) btnInstall.hidden = true;
});

/* =========================
   Init
   ========================= */
(function init(){
  const th = getTheme();
  if (themeSelect) themeSelect.value = th;
  setTheme(th);

  setDateField(isoToday());
  if (month) month.value = monthNow();
  if (statsMonth) statsMonth.value = monthNow();
  if (printMonth) printMonth.value = monthNow();

  if (patientNameInput) patientNameInput.value = getPatientName();
  if (stressVal && stress) stressVal.textContent = stress.value;

  setSubmitLabel();

  render();
  drawChartsFor(statsMonth?.value || monthNow());

  window.addEventListener("resize", () => {
    drawChartsFor(statsMonth?.value || monthNow());
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }
})();
