/* =========================
   Diario Cefalea - app.js (COMPLETO, aggiornato)
   - Data globale: sincronizza tutte le schede (Diario/Statistiche/Report)
   - Report: azioni giorno per giorno (＋ Aggiungi / Apri)
   - Tap su giorno: porta su Diario con data pronta ✅
   - PDF/Print: report + grafici + riquadro note medico
   - Condivisione PDF (WhatsApp): Web Share API + fallback download
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
const globalDate = el("globalDate");

const onlyWeekend = el("onlyWeekend");
const q = el("q");

const btnRefreshCharts = el("btnRefreshCharts");

const monthlyRows = el("monthlyRows");

const btnExportMonth = el("btnExportMonth");
const btnExportAll = el("btnExportAll");
const btnDeleteAll = el("btnDeleteAll");
const btnClear = el("btnClear");

const btnBackup = el("btnBackup");
const fileImport = el("fileImport");

const btnPrintReportTop = el("btnPrintReportTop");
const btnPrintReportBottom = el("btnPrintReportBottom");

const btnSharePdfTop = el("btnSharePdfTop");
const btnSharePdfBottom = el("btnSharePdfBottom");

const patientNameInput = el("patientName");

const stress = el("stress");
const stressVal = el("stressVal");

const themeSelect = el("themeSelect");
const chartIntensity = el("chartIntensity");
const chartTriggers = el("chartTriggers");
const chartMeds = el("chartMeds");

/* PWA install (Android/desktop) */
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
function monthFromISO(dateISO){
  return (dateISO || "").slice(0,7);
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
   Global date + month sync (❤️)
   ========================= */
function getSelectedMonth(){
  return (month?.value || monthNow()).trim();
}
function setSelectedMonth(yyyyMM, {silent=false} = {}){
  if (!month) return;
  month.value = yyyyMM;
  if (!silent){
    render();
    drawChartsFor(getSelectedMonth());
    renderMonthlyTable();
  }
}
function setGlobalDate(dateISO, {silent=false} = {}){
  if (globalDate) globalDate.value = dateISO;
  setDateField(dateISO);

  const m = monthFromISO(dateISO) || monthNow();
  if (month) month.value = m;

  if (!silent){
    render();
    drawChartsFor(getSelectedMonth());
    renderMonthlyTable();
  }
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
  const m = getSelectedMonth();
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

  if (viewKey === "statistiche") drawChartsFor(getSelectedMonth());
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

  setGlobalDate(a.date || isoToday(), {silent:true});
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
      drawChartsFor(getSelectedMonth());
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
  setGlobalDate(dateISO);
  switchTo("diario");
  el("card-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => el("intensity")?.focus(), 250);
}

function goToDiaryOpenDay(dateISO){
  setGlobalDate(dateISO);
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
  if (!monthlyRows) return;

  const m = getSelectedMonth();
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
      drawChartsFor(getSelectedMonth());
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
  const cssW = Math.max(820, Math.floor(canvas.clientWidth || 0) || 0);
  const cssH = Math.max(360, Math.floor(canvas.clientHeight || 0) || 0);

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

  const padL = 54, padR = 16, padT = 16, padB = 78;
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
    const y = H - padB + 26;
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
  const bar = cssColor("--btn", "#2b6cff");

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
   PRINT (HTML) - sempre con tabella report
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

    .head{
      display:flex; justify-content:space-between; align-items:flex-start;
      gap:10px; margin-bottom: 8px; padding-bottom: 6px; border-bottom:1px solid #ddd;
    }
    .head-left{ display:flex; gap:10px; align-items:center; }
    .logo{ width:38px; height:38px; object-fit:contain; }
    .ptv-title{ font-weight: 900; letter-spacing:.08em; font-size: 12px; line-height:1.1; }
    .ptv-sub{ font-weight: 800; letter-spacing:.04em; font-size: 11px; color:#333; margin-top: 2px; }
    .head-right{ text-align:right; font-size:11px; color:#333; font-weight:800; }

    h1{ margin:10px 0 6px 0; font-size:16px; }
    h3{ margin:10px 0 6px 0; font-size:13px; }

    .meta{
      display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;
      font-size:11px; margin: 6px 0 8px 0;
    }

    .instr{ margin: 0 0 8px 0; font-size:11px; color:#333; }

    .box-med{
      border:1px solid #999; border-radius:10px; padding:10px; margin: 8px 0 10px 0;
    }
    .box-med .t{ font-weight:900; font-size:11px; margin-bottom:6px; }
    .box-med .lines{ height:48mm; border:1px dashed #ddd; border-radius:8px; }

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
        <div class="head">
          <div class="head-left">
            <img class="logo" src="./assets/ptv.png" alt="PTV" />
            <div>
              <div class="ptv-title">FONDAZIONE PTV</div>
              <div class="ptv-sub">POLICLINICO TOR VERGATA</div>
            </div>
          </div>
          <div class="head-right">Centro Cefalee</div>
        </div>

        <h1>Report Cefalea – ${escapeHtml(label)}</h1>

        <div class="meta">
          <div><strong>Nome e Cognome:</strong> ${escapeHtml(nome)}</div>
          <div><strong>Referente Centro Cefalee:</strong> Dr.ssa Maria Albanese</div>
          <div><strong>Data generazione:</strong> ${new Date().toLocaleDateString("it-IT")}</div>
        </div>

        <p class="instr">Compila ogni riga indicando la frequenza, intensità, durata e risposta ai farmaci.</p>

        <div class="box-med">
          <div class="t">NOTE DEL MEDICO (spazio riservato)</div>
          <div class="lines"></div>
        </div>

        <div class="chart">
          <h3>Intensità (max) giorno per giorno</h3>
          ${hasAnyData && imgInt ? `<img src="${imgInt}" alt="Grafico Intensità">`
          : `<p class="instr">Nessun dato registrato nel mese.</p>`}
        </div>

        <div class="chart">
          <h3>Trigger più frequenti</h3>
          ${hasAnyData && imgTrig ? `<img src="${imgTrig}" alt="Grafico Trigger">`
          : `<p class="instr">Nessun dato registrato nel mese.</p>`}
        </div>

        <div class="chart">
          <h3>Farmaci più usati</h3>
          ${hasAnyData && imgMeds ? `<img src="${imgMeds}" alt="Grafico Farmaci">`
          : `<p class="instr">Nessun dato registrato nel mese.</p>`}
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
    const m = getSelectedMonth();
    const html = buildPrintHTML(m);

    const w = window.open("", "_blank");
    if (!w){
      alert("Impossibile aprire la stampa: popup bloccato. Prova da Chrome/Safari.");
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
      await waitImages().catch(()=>{});
      setTimeout(() => {
        w.focus();
        w.print();
      }, 250);
    };

  }catch(err){
    alert("Errore stampa/PDF: " + (err?.message || err));
    console.error(err);
  }
}

/* =========================
   PDF “reale” con jsPDF (per WhatsApp)
   ========================= */
async function fetchAsDataURL(url){
  try{
    const r = await fetch(url, { cache: "force-cache" });
    const b = await r.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(b);
    });
  }catch{
    return null;
  }
}

function mmToPt(mm){ return mm * 2.83464567; }

async function generatePDFBlob(yyyyMM){
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error("jsPDF non disponibile");

  renderMonthlyTable();
  drawChartsFor(yyyyMM);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  const label = monthLabel(yyyyMM);
  const nome = getPatientName() || "__________________________";

  // header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Report Cefalea – ${label}`, margin, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nome e Cognome: ${nome}`, margin, 80);
  doc.text(`Referente Centro Cefalee: Dr.ssa Maria Albanese`, margin, 95);
  doc.text(`Data generazione: ${new Date().toLocaleDateString("it-IT")}`, margin, 110);

  // logo (se disponibile)
  const logo = await fetchAsDataURL("./assets/ptv.png");
  if (logo){
    try{
      doc.addImage(logo, "PNG", pageW - margin - 42, 40, 42, 42);
    }catch{}
  }

  // riquadro note medico
  doc.setDrawColor(120);
  doc.setLineWidth(1);
  doc.roundedRect(margin, 125, pageW - margin*2, 110, 10, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NOTE DEL MEDICO (spazio riservato)", margin + 12, 145);
  doc.setDrawColor(210);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin + 12, 155, pageW - margin*2 - 24, 70, 8, 8);

  let y = 255;

  // charts as images
  const imgInt = chartIntensity?.toDataURL("image/png");
  const imgTrig = chartTriggers?.toDataURL("image/png");
  const imgMeds = chartMeds?.toDataURL("image/png");

  const addChart = (title, img) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, margin, y);
    y += 10;

    const maxW = pageW - margin*2;
    const h = 190;

    if (img){
      try{
        doc.setDrawColor(230);
        doc.roundedRect(margin, y, maxW, h, 10, 10);
        doc.addImage(img, "PNG", margin + 10, y + 10, maxW - 20, h - 20);
      }catch{
        doc.setFont("helvetica", "normal");
        doc.text("Grafico non disponibile.", margin, y + 20);
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.text("Nessun dato nel mese.", margin, y + 20);
    }
    y += h + 18;
  };

  addChart("Intensità (max) giorno per giorno", imgInt);
  if (y > pageH - 220){ doc.addPage(); y = 60; }
  addChart("Trigger più frequenti", imgTrig);
  if (y > pageH - 220){ doc.addPage(); y = 60; }
  addChart("Farmaci più usati", imgMeds);

  // new page for table
  doc.addPage();
  y = 60;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Tabella giornaliera", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const dcount = daysInMonth(yyyyMM);
  const map = attacksByDayForMonth(yyyyMM);

  const col1 = margin;
  const col2 = margin + 120;
  const col3 = margin + 175;
  const col4 = margin + 235;
  const col5 = margin + 355;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Giorno", col1, y);
  doc.text("Int", col2, y);
  doc.text("Dur", col3, y);
  doc.text("Farmaci/Risposta", col4, y);
  doc.text("Note/Trigger", col5, y);
  doc.setFont("helvetica", "normal");

  y += 8;
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  const wrapW = (pageW - margin) - col5;

  for (let day=1; day<=dcount; day++){
    const iso = isoOfDay(yyyyMM, day);
    const d = new Date(iso + "T00:00:00");
    const dow = d.toLocaleDateString("it-IT", { weekday:"short" });

    const dayAttacks = map.get(iso) || [];
    let dayTxt = `${String(day).padStart(2,"0")}/${yyyyMM.slice(5,7)} (${dow})${isWeekend(iso) ? "*" : ""}`;

    let intTxt = "—";
    let durTxt = "—";
    let medsTxt = "—";
    let noteTxt = "—";

    if (dayAttacks.length){
      const s = summarizeDayAttacks(dayAttacks);
      intTxt = `${s.maxInt}/10`;
      durTxt = `${s.sumDur}h`;
      medsTxt = `${(s.meds||"—")} • ${s.worstEff||"—"}`;
      noteTxt = s.trigNote || "—";
    }

    const noteLines = doc.splitTextToSize(noteTxt, wrapW);
    const medsLines = doc.splitTextToSize(medsTxt, (col5 - 10) - col4);

    const lines = Math.max(noteLines.length, medsLines.length, 1);
    const rowH = 12 + (lines-1)*10;

    if (y + rowH > pageH - 40){
      doc.addPage();
      y = 60;
    }

    doc.text(dayTxt, col1, y);
    doc.text(intTxt, col2, y);
    doc.text(durTxt, col3, y);

    doc.text(medsLines, col4, y);
    doc.text(noteLines, col5, y);

    y += rowH;
    doc.setDrawColor(235);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  }

  // footer note
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text("* weekend", margin, pageH - 20);
  doc.setTextColor(0);

  return doc.output("blob");
}

async function sharePDF(){
  try{
    const m = getSelectedMonth();
    const blob = await generatePDFBlob(m);
    const file = new File([blob], `Report_Cefalea_${m}.pdf`, { type: "application/pdf" });

    // Web Share (Android/iOS moderni)
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share){
      await navigator.share({
        title: "Report Cefalea",
        text: `Report mensile ${monthLabel(m)}`,
        files: [file]
      });
      return;
    }

    // fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Report_Cefalea_${m}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    alert("PDF scaricato. Ora aprilo e condividilo su WhatsApp.");
  }catch(err){
    console.error(err);
    alert("Impossibile generare/condividere il PDF: " + (err?.message || err));
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

    // ✅ sincronia globale
    setGlobalDate(date);

    render();
    drawChartsFor(getSelectedMonth());
  });

  // ✅ quando cambio la data nel form, aggiorna la data globale
  el("date")?.addEventListener("change", () => {
    const d = el("date").value;
    if (d) setGlobalDate(d);
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
  drawChartsFor(getSelectedMonth());
  renderMonthlyTable();
});

month?.addEventListener("change", () => {
  render();
  drawChartsFor(getSelectedMonth());
  renderMonthlyTable();
});

globalDate?.addEventListener("change", () => {
  const d = globalDate.value;
  if (d) setGlobalDate(d);
});

onlyWeekend?.addEventListener("change", render);
q?.addEventListener("input", () => {
  clearTimeout(window.__qT);
  window.__qT = setTimeout(render, 150);
});

btnExportMonth?.addEventListener("click", () => exportCSV(getSelectedMonth(), "month"));
btnExportAll?.addEventListener("click", () => exportCSV(getSelectedMonth(), "all"));

btnBackup?.addEventListener("click", backupJSON);
fileImport?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) importJSON(file);
  fileImport.value = "";
});

btnPrintReportTop?.addEventListener("click", () => printReport());
btnPrintReportBottom?.addEventListener("click", () => printReport());

btnSharePdfTop?.addEventListener("click", () => sharePDF());
btnSharePdfBottom?.addEventListener("click", () => sharePDF());

patientNameInput?.addEventListener("input", () => setPatientName(patientNameInput.value));

stress?.addEventListener("input", () => {
  if (stressVal) stressVal.textContent = stress.value;
});

btnRefreshCharts?.addEventListener("click", () => drawChartsFor(getSelectedMonth()));

themeSelect?.addEventListener("change", () => setTheme(themeSelect.value));

tabs.forEach(t => {
  t.addEventListener("click", () => switchTo(t.getAttribute("data-view")));
});

/* PWA install (Android) */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstall) btnInstall.hidden = false;
});
btnInstall?.addEventListener("click", async () => {
  if (!deferredPrompt) {
    alert("Installazione non disponibile ora.\nSu iPhone: Safari → Condividi → Aggiungi a schermata Home.");
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

  const today = isoToday();

  // ✅ init global date + month
  if (month) month.value = monthFromISO(today);
  setGlobalDate(today, {silent:true});

  if (patientNameInput) patientNameInput.value = getPatientName();
  if (stressVal && stress) stressVal.textContent = stress.value;

  setSubmitLabel();

  render();
  drawChartsFor(getSelectedMonth());
  renderMonthlyTable();

  window.addEventListener("resize", () => {
    drawChartsFor(getSelectedMonth());
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }
})();
