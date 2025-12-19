/* =========================
   Diario Cefalea - app.js (COMPLETO)
   FIX:
   ✅ Report: puoi aprire il popup del giorno anche se è vuoto
   ✅ Popup giorno: pulsante ＋ Aggiungi -> va su Diario con data già pronta
   ✅ Grafico intensità: sotto le colonne compaiono SEMPRE i giorni (1..31) anche su mobile
   ========================= */

const KEY = "cefalea_attacks_v2";
const KEY_NAME = "cefalea_patient_name_v2";
const KEY_THEME = "cefalea_theme_v1";

const el = (id) => document.getElementById(id);

/* ===== Elements (match index.html) ===== */
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

/* PWA install */
let deferredPrompt = null;
const btnInstall = el("btnInstall");

/* Charts */
const chartIntensity = el("chartIntensity");
const chartTriggers = el("chartTriggers");
const chartMeds = el("chartMeds");

/* ===== Edit state ===== */
let EDIT_ID = null;

/* ===== Day modal state ===== */
let DAY_MODAL_DATE = null;

/* ===== Helpers ===== */
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
  // id="date" (standard)
  const d1 = el("date");
  if (d1){ d1.value = dateISO; return true; }

  // fallback: primo input date
  const d2 = document.querySelector('input[type="date"]');
  if (d2){ d2.value = dateISO; return true; }

  // fallback: name="date"
  const d3 = document.querySelector('input[name="date"]');
  if (d3){ d3.value = dateISO; return true; }

  return false;
}

/* ===== Month helpers ===== */
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

/* ===== Deduced triggers ===== */
function deducedTriggers({stress, sleepHours, weather, foods}){
  const out = [];
  if (typeof stress === "number" && stress >= 7) out.push("Stress alto");
  if (typeof sleepHours === "number" && sleepHours > 0 && sleepHours < 6) out.push("Poco sonno");
  if (weather) out.push("Meteo");
  if (foods && foods.trim()) out.push("Alimenti");
  return out;
}

/* ===== Filters ===== */
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

/* ===== CRUD ===== */
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
function listByDate(dateISO){
  return load().filter(x => x.date === dateISO).sort((a,b)=> (a.time||"").localeCompare(b.time||""));
}

/* ===== UI: switch view ===== */
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

/* ===== Render: Stats pills ===== */
function compactExtras(a){
  const parts = [];
  if (typeof a.stress === "number" && a.stress > 0) parts.push(`Stress ${a.stress}/10`);
  if (typeof a.sleepHours === "number") parts.push(`Sonno ${a.sleepHours}h`);
  if (a.weather) parts.push(a.weather);
  if (a.foods) parts.push(`Alimenti: ${a.foods}`);
  return parts.length ? parts.join(" • ") : "—";
}

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

/* ===== EDIT: prefill form ===== */
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
  form?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function cancelEdit(){
  EDIT_ID = null;
  setSubmitLabel();
  resetFormFields();
}

/* ===== Render: Diario list ===== */
function render(){
  const list = filteredList();

  if (rows){
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

/* ===== Monthly table (Report view) ===== */
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

    // ✅ ORA: bottone gestione SEMPRE presente, così puoi aprire il popup anche se il giorno è vuoto
    const manageBtn = `<button class="iconbtn no-print" data-day="${iso}" title="Apri giorno">📅</button>`;

    if (dayAttacks.length === 0){
      html += `
        <tr data-dayrow="${iso}">
          <td>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <span>${String(day).padStart(2,"0")}/${m.slice(5,7)} (${dow})${wk}</span>
              ${manageBtn}
            </div>
          </td>
          <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
        </tr>
      `;
      continue;
    }

    const s = summarizeDayAttacks(dayAttacks);
    html += `
      <tr data-dayrow="${iso}">
        <td>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span>${String(day).padStart(2,"0")}/${m.slice(5,7)} (${dow})${wk}</span>
            ${manageBtn}
          </div>
        </td>
        <td><strong>${s.maxInt}</strong>/10</td>
        <td>${s.sumDur} h</td>
        <td>${escapeHtml(s.meds || "—")}</td>
        <td>${escapeHtml(s.worstEff || "—")}</td>
        <td>${escapeHtml(s.trigNote || "—")}</td>
      </tr>
    `;
  }
  monthlyRows.innerHTML = html;

  // click sul bottone 📅 -> popup del giorno
  document.querySelectorAll("[data-day]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dateISO = btn.getAttribute("data-day");
      openDayModal(dateISO);
    });
  });

  // ✅ click su tutta la riga -> popup SEMPRE (anche se vuoto)
  document.querySelectorAll("[data-dayrow]").forEach(tr => {
    tr.addEventListener("click", () => {
      const dateISO = tr.getAttribute("data-dayrow");
      openDayModal(dateISO);
    });
  });
}

/* ===== Day modal (creato via JS, zero modifiche HTML) ===== */
function ensureModalCSS(){
  if (el("__modalStyle")) return;
  const st = document.createElement("style");
  st.id = "__modalStyle";
  st.textContent = `
    .no-print{}
    @media print{ .no-print{ display:none !important; } }
    .dc-modal-overlay{
      position:fixed; inset:0; z-index:9999;
      background: rgba(0,0,0,.55);
      display:none;
      align-items:center;
      justify-content:center;
      padding: 14px;
    }
    .dc-modal{
      width: min(720px, 100%);
      max-height: 78vh;
      overflow:auto;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,.14);
      background: var(--card, #111a2d);
      color: var(--text, #e7eefc);
      box-shadow: 0 20px 70px rgba(0,0,0,.35);
      padding: 14px;
    }
    .dc-modal .hdr{
      display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
      margin-bottom: 10px;
    }
    .dc-modal .ttl{ font-weight:900; font-size:16px; }
    .dc-modal .sub{ font-size:12px; color: var(--muted, #a6b3d1); margin-top:3px; }
    .dc-modal .btnRow{ display:flex; gap:8px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }
    .dc-modal .list{ display:flex; flex-direction:column; gap:10px; margin-top:10px; }
    .dc-modal .item{
      border:1px solid color-mix(in srgb, var(--line, #24314f) 40%, transparent);
      border-radius: 16px;
      padding: 12px;
      background: color-mix(in srgb, var(--chip2, #0d1427) 90%, transparent);
    }
    .dc-modal .k{ font-weight:900; }
    .dc-modal .mut{ color: var(--muted, #a6b3d1); font-size:12px; margin-top:4px; }
    .dc-modal .acts{ display:flex; gap:8px; justify-content:flex-end; margin-top:10px; flex-wrap:wrap; }
  `;
  document.head.appendChild(st);
}

function ensureDayModal(){
  ensureModalCSS();
  if (el("dcDayOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "dcDayOverlay";
  overlay.className = "dc-modal-overlay";
  overlay.innerHTML = `
    <div class="dc-modal" role="dialog" aria-modal="true">
      <div class="hdr">
        <div>
          <div class="ttl" id="dcDayTitle">Giorno</div>
          <div class="sub" id="dcDaySub">Gestisci gli attacchi registrati</div>
        </div>
        <div class="btnRow">
          <button class="iconbtn" id="dcDayAdd" title="Aggiungi attacco in questo giorno">＋ Aggiungi</button>
          <button class="iconbtn" id="dcDayClose" title="Chiudi">✖</button>
        </div>
      </div>
      <div class="list" id="dcDayList"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDayModal();
  });
  el("dcDayClose")?.addEventListener("click", closeDayModal);

  el("dcDayAdd")?.addEventListener("click", () => {
    if (!DAY_MODAL_DATE) return;
    closeDayModal();
    startAddForDay(DAY_MODAL_DATE);
  });
}

function startAddForDay(dateISO){
  // Nuovo attacco su quel giorno: NON in modifica
  EDIT_ID = null;
  setSubmitLabel();

  // pulisci campi e imposta data
  resetFormFields();
  setDateField(dateISO);

  // Porta su Diario
  switchTo("diario");
  form?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openDayModal(dateISO){
  ensureDayModal();
  DAY_MODAL_DATE = dateISO;

  const overlay = el("dcDayOverlay");
  const listWrap = el("dcDayList");
  const title = el("dcDayTitle");
  const sub = el("dcDaySub");

  const list = listByDate(dateISO);

  const d = new Date(dateISO + "T00:00:00");
  const nice = d.toLocaleDateString("it-IT", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
  title.textContent = `Giorno: ${nice}`;
  sub.textContent = list.length ? `Attacchi registrati: ${list.length}` : `Nessun attacco registrato (puoi aggiungerne uno)`;

  if (!list.length){
    listWrap.innerHTML = `<div class="mut">Nessun dato per questo giorno. Premi “＋ Aggiungi”.</div>`;
  } else {
    listWrap.innerHTML = list.map(a => {
      const meds = (a.meds && a.meds.length) ? a.meds.join(", ") : "—";
      const trig = (a.triggers && a.triggers.length) ? a.triggers.join(", ") : "—";
      const note = a.notes?.trim() ? a.notes : "—";
      return `
        <div class="item">
          <div class="k">${fmtDate(a.date, a.time)} • <strong>${a.intensity}</strong>/10 • ${a.duration} h</div>
          <div class="mut"><strong>Farmaci:</strong> ${escapeHtml(meds)}</div>
          <div class="mut"><strong>Efficacia:</strong> ${escapeHtml(a.efficacy)} • <strong>Trigger:</strong> ${escapeHtml(trig)}</div>
          <div class="mut"><strong>Note:</strong> ${escapeHtml(note)}</div>
          <div class="acts">
            <button class="iconbtn" data-modal-edit="${a.id}">✏️ Modifica</button>
            <button class="iconbtn" data-modal-del="${a.id}">🗑️ Elimina</button>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll("[data-modal-edit]").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-modal-edit");
        closeDayModal();
        startEdit(id);
      });
    });

    document.querySelectorAll("[data-modal-del]").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-modal-del");
        if (confirm("Vuoi eliminare questo attacco?")){
          if (EDIT_ID === id) cancelEdit();
          removeAttack(id);
          render();
          drawChartsFor(statsMonth?.value || monthNow());
          openDayModal(dateISO); // refresh
        }
      });
    });
  }

  overlay.style.display = "flex";
}
function closeDayModal(){
  const overlay = el("dcDayOverlay");
  if (overlay) overlay.style.display = "none";
}

/* ===== CSV ===== */
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

/* ===== Backup/Import ===== */
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

/* ===== Charts (canvas) ===== */
function cssColor(varName, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

// ✅ FIX canvas su mobile: ridimensiona correttamente in base al clientWidth/clientHeight + devicePixelRatio
function ensureCanvasSize(canvas){
  if (!canvas) return { cssW: 0, cssH: 0, dpr: 1 };
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const cssW = Math.max(280, Math.floor(canvas.clientWidth || 0));
  const cssH = Math.max(170, Math.floor(canvas.clientHeight || 0) || 190);

  const needW = Math.floor(cssW * dpr);
  const needH = Math.floor(cssH * dpr);

  if (canvas.width !== needW) canvas.width = needW;
  if (canvas.height !== needH) canvas.height = needH;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // disegna in coordinate CSS
  return { cssW, cssH, dpr };
}

function drawBarChart(canvas, labels, values, options){
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { cssW: W, cssH: H } = ensureCanvasSize(canvas);

  // bg
  ctx.fillStyle = options.bgColor;
  ctx.fillRect(0,0,W,H);

  const padL = 44, padR = 12, padT = 14, padB = 46; // più spazio per le etichette giorni
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
    ctx.fillText(String(val), padL - 8, y);
  }

  const n = labels.length;
  const gap = 2;
  const barW = n ? Math.max(2, (plotW / n) - gap) : plotW;

  for (let i=0;i<n;i++){
    const v = values[i];
    const x = padL + i*(barW+gap);
    const h = (v / maxV) * plotH;
    const y = padT + (plotH - h);
    ctx.fillStyle = options.barColor;
    ctx.fillRect(x, y, barW, h);
  }

  // ✅ etichette giorni sotto OGNI colonna
  ctx.fillStyle = options.textColor;
  const smallFont = n > 20 ? 9 : 11;
  ctx.font = `${smallFont}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let i=0;i<n;i++){
    const x = padL + i*(barW+gap) + barW/2;
    const y = H - padB + 18;

    // se il mese è molto pieno, ruota leggermente per non sovrapporre
    if (n > 20){
      ctx.save();
      ctx.translate(x, y+10);
      ctx.rotate(-0.65);
      ctx.fillText(labels[i], 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(labels[i], x, y);
    }
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
    labels.push(String(day)); // ✅ giorni 1..31
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
  drawBarChart(chartTriggers,
    trigCounts.map(x=>x[0]),
    trigCounts.map(x=>x[1]),
    { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar }
  );

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

/* ===== Print (invariato: se vuoi lo rifiniamo dopo) ===== */
function printReport(){
  try{
    if (!printArea) throw new Error("Manca #printArea in index.html");
    const m = (printMonth?.value || monthNow()).trim();
    const label = monthLabel(m);
    const nome = getPatientName() || "__________________________";

    // aggiorno tabella e grafici prima di generare il print
    renderMonthlyTable();
    drawChartsFor(m);

    // trasformo i canvas in immagini (così in stampa si vedono sempre)
    const imgInt = chartIntensity ? chartIntensity.toDataURL("image/png", 1.0) : "";
    const imgTrig = chartTriggers ? chartTriggers.toDataURL("image/png", 1.0) : "";
    const imgMeds = chartMeds ? chartMeds.toDataURL("image/png", 1.0) : "";

    printArea.innerHTML = `
      <div class="print-sheet">
        <div class="ptv-head">
          <div class="ptv-title">FONDAZIONE PTV</div>
          <div class="ptv-sub">POLICLINICO TOR VERGATA</div>
        </div>

        <h1>Report Cefalea – ${escapeHtml(label)}</h1>

        <div class="ptv-meta">
          <div><strong>Nome e Cognome:</strong> ${escapeHtml(nome)}</div>
          <div><strong>Referente Centro Cefalee:</strong> Dr.ssa Maria Albanese</div>
          <div><strong>Data generazione:</strong> ${new Date().toLocaleDateString("it-IT")}</div>
        </div>

        <p class="ptv-instr">Compila ogni riga indicando la frequenza, intensità, durata e risposta ai farmaci.</p>

        <h3>Intensità (max) giorno per giorno</h3>
        ${imgInt ? `<img class="print-chart-img" src="${imgInt}" alt="Grafico Intensità">` : ""}

        <h3>Trigger più frequenti</h3>
        ${imgTrig ? `<img class="print-chart-img" src="${imgTrig}" alt="Grafico Trigger">` : ""}

        <h3>Farmaci più usati</h3>
        ${imgMeds ? `<img class="print-chart-img" src="${imgMeds}" alt="Grafico Farmaci">` : ""}

        <div class="page-break"></div>

        <h3>Tabella giornaliera</h3>
        ${el("monthlyTable") ? el("monthlyTable").outerHTML : ""}
      </div>
    `;

    setTimeout(() => window.print(), 120);
  }catch(err){
    alert("Errore stampa/PDF: " + (err?.message || err));
    console.error(err);
  }
}

/* ===== Form ===== */
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

function cryptoId(){
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

if (form){
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();

    // date
    const dateEl = el("date") || document.querySelector('input[type="date"]');
    const date = dateEl?.value;
    if (!date) return;

    const time = el("time")?.value || "";
    const intensity = Number(el("intensity")?.value);
    const duration = Number(el("duration")?.value);

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
      setDateField(date); // resta sul giorno che stavi compilando
    }

    render();
    drawChartsFor(statsMonth?.value || monthNow());
  });
}

btnClear?.addEventListener("click", () => {
  if (EDIT_ID) cancelEdit();
  else resetFormFields();
});

/* ===== Buttons ===== */
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

btnPrintReport?.addEventListener("click", printReport);

patientNameInput?.addEventListener("input", () => setPatientName(patientNameInput.value));

stress?.addEventListener("input", () => {
  if (stressVal) stressVal.textContent = stress.value;
});

btnRefreshCharts?.addEventListener("click", () => drawChartsFor(statsMonth?.value || monthNow()));
statsMonth?.addEventListener("change", () => drawChartsFor(statsMonth?.value || monthNow()));
printMonth?.addEventListener("change", renderMonthlyTable);

themeSelect?.addEventListener("change", () => setTheme(themeSelect.value));

tabs.forEach(t => {
  t.addEventListener("click", () => {
    switchTo(t.getAttribute("data-view"));
  });
});

/* PWA install */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstall) btnInstall.hidden = false;
});
btnInstall?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (btnInstall) btnInstall.hidden = true;
});

/* Init */
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
  ensureDayModal();

  render();
  drawChartsFor(statsMonth?.value || monthNow());

  // ridisegna i grafici quando ruoti lo schermo / cambi dimensione (mobile)
  window.addEventListener("resize", () => {
    drawChartsFor(statsMonth?.value || monthNow());
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }
})();
