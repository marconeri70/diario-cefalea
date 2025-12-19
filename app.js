const KEY = "cefalea_attacks_v1";

const el = (id) => document.getElementById(id);

const form = el("attackForm");
const rows = el("rows");
const stats = el("stats");

const month = el("month");
const onlyWeekend = el("onlyWeekend");
const q = el("q");

const btnExport = el("btnExport");
const btnDeleteAll = el("btnDeleteAll");
const btnClear = el("btnClear");

const btnBackup = el("btnBackup");
const fileImport = el("fileImport");

let deferredPrompt = null;
const btnInstall = el("btnInstall");

function load(){
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function save(list){
  localStorage.setItem(KEY, JSON.stringify(list));
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
  const day = d.getDay(); // 0 Sun .. 6 Sat
  return day === 0 || day === 6;
}
function fmtDate(dateISO, timeHHMM){
  const d = new Date(dateISO + "T00:00:00");
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yyyy = d.getFullYear();
  return timeHHMM ? `${dd}/${mm}/${yyyy} ${timeHHMM}` : `${dd}/${mm}/${yyyy}`;
}

function getSelectedMeds(){
  const s = Array.from(el("meds").selectedOptions).map(o => o.value);
  return s;
}

function addAttack(a){
  const list = load();
  list.push(a);
  list.sort((x,y) => (y.date+y.time).localeCompare(x.date+x.time));
  save(list);
}

function removeAttack(id){
  const list = load().filter(x => x.id !== id);
  save(list);
}

function clearForm(){
  el("date").value = isoToday();
  el("time").value = "";
  el("intensity").value = "";
  el("duration").value = "";
  el("efficacy").value = "Parziale";
  el("notes").value = "";
  Array.from(el("meds").options).forEach(o => o.selected = false);
}

function filteredList(){
  const list = load();
  const m = month.value || monthNow();
  const [yy, mm] = m.split("-");
  const start = `${yy}-${mm}-01`;
  const endDate = new Date(`${yy}-${mm}-01T00:00:00`);
  endDate.setMonth(endDate.getMonth()+1);
  const end = endDate.toISOString().slice(0,10);

  let out = list.filter(a => a.date >= start && a.date < end);

  const w = onlyWeekend.value;
  if (w === "weekend") out = out.filter(a => isWeekend(a.date));
  if (w === "weekday") out = out.filter(a => !isWeekend(a.date));

  const query = (q.value || "").trim().toLowerCase();
  if (query){
    out = out.filter(a => {
      const meds = (a.meds || []).join(" ").toLowerCase();
      const notes = (a.notes || "").toLowerCase();
      return meds.includes(query) || notes.includes(query);
    });
  }

  return out;
}

function render(){
  const list = filteredList();

  rows.innerHTML = list.map(a => {
    const meds = (a.meds && a.meds.length) ? a.meds.join(", ") : "—";
    const note = a.notes?.trim() ? a.notes : "—";
    const wk = isWeekend(a.date) ? " • Weekend" : "";
    return `
      <tr>
        <td>${fmtDate(a.date, a.time)}<div class="muted" style="font-size:12px">${wk}</div></td>
        <td><strong>${a.intensity}</strong>/10</td>
        <td>${a.duration} h</td>
        <td>${escapeHtml(meds)}</td>
        <td>${escapeHtml(a.efficacy)}</td>
        <td>${escapeHtml(note)}</td>
        <td style="text-align:right">
          <button class="iconbtn" data-del="${a.id}" title="Elimina">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");

  rows.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-del");
      removeAttack(id);
      render();
    });
  });

  renderStats(list);
}

function renderStats(list){
  if (!list.length){
    stats.innerHTML = `
      <span class="pill">Nessun dato nel filtro selezionato</span>
    `;
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
    <span class="pill">Attacchi: <strong>${list.length}</strong></span>
    <span class="pill">Giorni con attacco: <strong>${daysWithAttack}</strong></span>
    <span class="pill">Intensità media: <strong>${avgIntensity}</strong>/10</span>
    <span class="pill">Durata media: <strong>${avgDuration}</strong> h</span>
    <span class="pill">Media Weekend: <strong>${avgWk}</strong>/10</span>
    <span class="pill">Media Feriali: <strong>${avgWd}</strong>/10</span>
  `;
}

function exportCSV(){
  const list = filteredList();
  const header = ["Data", "Ora", "Intensità", "Durata_ore", "Farmaci", "Efficacia", "Note", "Weekend"];
  const lines = [header.join(";")];

  for (const a of list){
    const meds = (a.meds && a.meds.length) ? a.meds.join(", ") : "";
    const row = [
      a.date,
      a.time || "",
      a.intensity,
      a.duration,
      meds,
      a.efficacy,
      (a.notes||"").replaceAll("\n"," ").trim(),
      isWeekend(a.date) ? "SI" : "NO"
    ].map(v => `"${String(v).replaceAll('"','""')}"`);
    lines.push(row.join(";"));
  }

  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `diario-cefalea_${month.value || monthNow()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

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
      // Merge intelligente (per id)
      const current = load();
      const map = new Map(current.map(x => [x.id, x]));
      parsed.forEach(x => {
        if (x && x.id) map.set(x.id, x);
      });
      const merged = Array.from(map.values());
      merged.sort((x,y) => (y.date+y.time).localeCompare(x.date+x.time));
      save(merged);
      render();
      alert("Import completato ✅");
    }catch(e){
      alert("Import non riuscito: file non valido");
    }
  };
  reader.readAsText(file);
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Eventi
form.addEventListener("submit", (ev) => {
  ev.preventDefault();

  const date = el("date").value;
  const time = el("time").value || "";
  const intensity = Number(el("intensity").value);
  const duration = Number(el("duration").value);
  const meds = getSelectedMeds();
  const efficacy = el("efficacy").value;
  const notes = el("notes").value || "";

  const a = {
    id: crypto.randomUUID(),
    date,
    time,
    intensity,
    duration,
    meds,
    efficacy,
    notes
  };

  addAttack(a);
  render();
  // lascia data uguale, pulisci il resto
  el("time").value = "";
  el("intensity").value = "";
  el("duration").value = "";
  el("notes").value = "";
  Array.from(el("meds").options).forEach(o => o.selected = false);
});

btnClear.addEventListener("click", clearForm);
btnExport.addEventListener("click", exportCSV);

btnDeleteAll.addEventListener("click", () => {
  const ok = confirm("Vuoi cancellare TUTTI i dati salvati in questa app?");
  if (!ok) return;
  localStorage.removeItem(KEY);
  render();
});

month.addEventListener("change", render);
onlyWeekend.addEventListener("change", render);
q.addEventListener("input", () => {
  // piccolo debounce
  clearTimeout(window.__qT);
  window.__qT = setTimeout(render, 150);
});

btnBackup.addEventListener("click", backupJSON);
fileImport.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) importJSON(file);
  fileImport.value = "";
});

// Install PWA
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

// Init
el("date").value = isoToday();
month.value = monthNow();
render();

// Service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}
