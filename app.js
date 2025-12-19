/* =========================
   Diario Cefalea - app.js (robusto)
   Fix: stampa/PDF sempre funzionante
   ========================= */

/* Storage keys (compatibilità) */
const KEY_NEW = "cefalea_attacks_v2";
const KEY_OLD = "cefalea_attacks";
const KEY_NAME = "cefalea_patient_name_v2";
const KEY_THEME = "cefalea_theme_v1";

const $ = (sel) => document.querySelector(sel);
const el = (id) => document.getElementById(id);

function safeJSONParse(s, fallback){
  try { return JSON.parse(s); } catch { return fallback; }
}

function loadAttacks(){
  const aNew = safeJSONParse(localStorage.getItem(KEY_NEW) || "null", null);
  if (Array.isArray(aNew)) return aNew;

  const aOld = safeJSONParse(localStorage.getItem(KEY_OLD) || "null", null);
  if (Array.isArray(aOld)) return aOld;

  return [];
}

function saveAttacks(list){
  localStorage.setItem(KEY_NEW, JSON.stringify(list));
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

function listForMonth(yyyyMM){
  const list = loadAttacks();
  const [yy, mm] = yyyyMM.split("-");
  const start = `${yy}-${mm}-01`;
  const endDate = new Date(`${yy}-${mm}-01T00:00:00`);
  endDate.setMonth(endDate.getMonth()+1);
  const end = endDate.toISOString().slice(0,10);
  return list.filter(a => a?.date >= start && a?.date < end);
}

/* ===== Charts helpers (se esistono canvas) ===== */
function cloneCanvasScaled(source, targetW, targetH){
  const c = document.createElement("canvas");
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return c;
}

/* ===== Report: KPI ===== */
function topCounts(items){
  const m = new Map();
  for (const it of items){
    if (!it) continue;
    m.set(it, (m.get(it)||0)+1);
  }
  return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
}

function deducedTriggers(a){
  const out = [];
  const stress = typeof a.stress === "number" ? a.stress : null;
  const sleepHours = typeof a.sleepHours === "number" ? a.sleepHours : null;
  const weather = (a.weather || "").trim();
  const foods = (a.foods || "").trim();

  if (stress !== null && stress >= 7) out.push("Stress alto");
  if (sleepHours !== null && sleepHours > 0 && sleepHours < 6) out.push("Poco sonno");
  if (weather) out.push("Meteo");
  if (foods) out.push("Alimenti");
  return out;
}

function kpiReport(yyyyMM){
  const list = listForMonth(yyyyMM);

  const daysWithAttack = new Set(list.map(a => a.date)).size;
  const avgIntensity = list.length ? (list.reduce((s,a)=>s + Number(a.intensity||0),0)/list.length).toFixed(1) : "—";
  const avgDuration = list.length ? (list.reduce((s,a)=>s + Number(a.duration||0),0)/list.length).toFixed(1) : "—";

  const weekend = list.filter(a => isWeekend(a.date));
  const weekday = list.filter(a => !isWeekend(a.date));
  const avgWk = weekend.length ? (weekend.reduce((s,a)=>s+Number(a.intensity||0),0)/weekend.length).toFixed(1) : "—";
  const avgWd = weekday.length ? (weekday.reduce((s,a)=>s+Number(a.intensity||0),0)/weekday.length).toFixed(1) : "—";

  const allTrig = [];
  for (const a of list){
    const t = new Set([...(a.triggers||[]), ...deducedTriggers(a)]);
    t.forEach(x => allTrig.push(x));
  }
  const trigCounts = topCounts(allTrig).slice(0,4).map(([k,v])=>`${k} (${v})`).join(", ") || "—";

  const allMeds = [];
  for (const a of list){ (a.meds||[]).forEach(x => allMeds.push(x)); }
  const medsCounts = topCounts(allMeds).slice(0,4).map(([k,v])=>`${k.replace(" (FANS)","")} (${v})`).join(", ") || "—";

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

/* ===== Report: tabella giornaliera (indipendente dal DOM) ===== */
function summarizeDayAttacks(dayAttacks){
  const maxInt = Math.max(...dayAttacks.map(a => Number(a.intensity||0)));
  const sumDur = (dayAttacks.reduce((s,a)=> s + Number(a.duration||0), 0)).toFixed(1);

  const medsSet = new Set();
  dayAttacks.forEach(a => (a.meds||[]).forEach(m => medsSet.add(m)));
  const meds = Array.from(medsSet).join(", ");

  const trigSet = new Set();
  dayAttacks.forEach(a => (a.triggers||[]).forEach(t => trigSet.add(t)));
  deducedTriggers(dayAttacks[0] || {}).forEach(t => trigSet.add(t));
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

  const extras = [];
  dayAttacks.forEach(a=>{
    if (typeof a.stress === "number" && a.stress > 0) extras.push(`Stress ${a.stress}/10`);
    if (typeof a.sleepHours === "number") extras.push(`Sonno ${a.sleepHours}h`);
    if (a.weather) extras.push(a.weather);
    if (a.foods) extras.push(`Alimenti: ${a.foods}`);
  });

  const trigNote = [
    trig ? `Trigger: ${trig}` : "",
    extras.length ? extras.join(" • ") : "",
    notes ? `Note: ${notes}` : ""
  ].filter(Boolean).join(" — ");

  return { maxInt, sumDur, meds, worstEff, trigNote };
}

function buildMonthlyTableHTML(yyyyMM){
  const dcount = daysInMonth(yyyyMM);
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

  let rows = "";
  for (let day=1; day<=dcount; day++){
    const iso = isoOfDay(yyyyMM, day);
    const d = new Date(iso + "T00:00:00");
    const dow = d.toLocaleDateString("it-IT", { weekday:"short" });
    const wk = isWeekend(iso) ? " (weekend)" : "";

    const dayAttacks = map.get(iso) || [];
    if (!dayAttacks.length){
      rows += `
        <tr>
          <td>${String(day).padStart(2,"0")}/${yyyyMM.slice(5,7)} (${dow})${wk}</td>
          <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
        </tr>`;
      continue;
    }

    const s = summarizeDayAttacks(dayAttacks);
    rows += `
      <tr>
        <td>${String(day).padStart(2,"0")}/${yyyyMM.slice(5,7)} (${dow})${wk}</td>
        <td><strong>${s.maxInt}</strong>/10</td>
        <td>${s.sumDur} h</td>
        <td>${escapeHtml(s.meds || "—")}</td>
        <td>${escapeHtml(s.worstEff || "—")}</td>
        <td>${escapeHtml(s.trigNote || "—")}</td>
      </tr>`;
  }

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Giorno</th>
          <th>Intensità</th>
          <th>Durata (ore)</th>
          <th>Farmaci</th>
          <th>Efficacia</th>
          <th>Trigger / Note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ===== Print report (FIX) ===== */
function printReport(){
  try{
    const printArea = el("printArea") || $(".print-area");
    if (!printArea) throw new Error("Manca #printArea (div area stampa) in index.html");

    // mese selezionato (provo più ID per compatibilità)
    const monthInput = el("printMonth") || el("monthPrint") || el("month") || el("statsMonth");
    const m = (monthInput?.value || monthNow()).trim();
    const label = monthLabel(m);

    const nome = getPatientName() || "__________________________";
    const kpi = kpiReport(m);

    // recupero (se esistono) i canvas grafici
    const cInt = el("chartIntensity");
    const cTrig = el("chartTriggers");
    const cMeds = el("chartMeds");

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
          <div id="pChart1"></div>
        </div>

        <div class="print-chart">
          <h3>Trigger più frequenti</h3>
          <div id="pChart2"></div>
        </div>

        <div class="print-chart">
          <h3>Farmaci più usati</h3>
          <div id="pChart3"></div>
        </div>

        <div class="page-break print-chart">
          <h3>Tabella giornaliera</h3>
          ${buildMonthlyTableHTML(m)}
        </div>

        <p class="print-foot">Documento generato dall’app Diario Cefalea</p>
      </div>
    `;

    // inserisco grafici (se disponibili) in versione più piccola per stampa
    const p1 = printArea.querySelector("#pChart1");
    const p2 = printArea.querySelector("#pChart2");
    const p3 = printArea.querySelector("#pChart3");

    if (cInt && p1) p1.appendChild(cloneCanvasScaled(cInt, 900, 180));
    if (cTrig && p2) p2.appendChild(cloneCanvasScaled(cTrig, 900, 170));
    if (cMeds && p3) p3.appendChild(cloneCanvasScaled(cMeds, 900, 170));

    // su alcuni telefoni serve un micro-delay per far “renderizzare” l’HTML prima di print
    setTimeout(() => window.print(), 60);

  }catch(err){
    alert("Errore stampa/PDF: " + (err?.message || err));
    console.error(err);
  }
}

/* ===== Aggancio eventi (non si blocca se manca un elemento) ===== */
function bindPrintButton(){
  const btn =
    el("btnPrintReport") ||
    el("btnPrint") ||
    el("btnPDF") ||
    el("btnPrintMonth") ||
    $("button[data-action='print']");

  if (!btn){
    console.warn("Bottone stampa non trovato: controlla l'id (btnPrintReport) in index.html");
    return;
  }
  btn.addEventListener("click", printReport);
}

function initBasics(){
  // tema
  const themeSelect = el("themeSelect");
  const th = getTheme();
  setTheme(th);
  if (themeSelect) themeSelect.value = th;
  themeSelect?.addEventListener("change", () => setTheme(themeSelect.value));

  // nome
  const patientNameInput = el("patientName");
  if (patientNameInput){
    patientNameInput.value = getPatientName();
    patientNameInput.addEventListener("input", () => setPatientName(patientNameInput.value));
  }

  // default date/month
  const date = el("date");
  if (date && !date.value) date.value = isoToday();

  const month = el("month");
  if (month && !month.value) month.value = monthNow();

  const printMonth = el("printMonth");
  if (printMonth && !printMonth.value) printMonth.value = monthNow();
}

/* ===== Avvio ===== */
document.addEventListener("DOMContentLoaded", () => {
  initBasics();
  bindPrintButton();

  // service worker (se presente)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }
});
