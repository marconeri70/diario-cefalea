
/* =========================
   Diario Cefalea - app.js (COMPLETO, aggiornato, NON interrotto)
   Funzioni:
   - Data globale (globalDate) sincronizzata su tutte le schede
   - Inserimento attacco + Registro con filtri e ricerca
   - Cards su mobile
   - Statistiche (canvas) senza librerie
   - Report mensile: tabella giorno-per-giorno + azioni (Aggiungi/Apri)
   - Stampa: grafici + tabella report + riquadro Note medico (stile “clinico”)
   - Condivisione PDF reale via jsPDF + Web Share (WhatsApp tramite pannello condivisione)
   - Tema: auto/scuro/chiaro
   - Backup/Import JSON
   - Export CSV mese/tutto
   - PWA install prompt + service worker register
   - ✅ Badge intensità “clinico” (1–3 verde, 4–6 ambra, 7–10 rosso)
   - ✅ Posizione dolore: selettore con prospettiva + testa cliccabile
   - ✅ Grafico “Posizione dolore” in Statistiche + Stampa + PDF
   ========================= */

(() => {
  "use strict";

  /* ========= Keys ========= */
  const KEY = "cefalea_attacks_v3";
  const KEY_NAME = "cefalea_patient_name_v2";
  const KEY_THEME = "cefalea_theme_v1";
  const KEY_GLOBAL_DATE = "cefalea_global_date_v1";

  /* ========= DOM helpers ========= */
  const el = (id) => document.getElementById(id);

  /* ========= Elements ========= */
  const btnInstall = el("btnInstall");
  const globalDate = el("globalDate");
  const month = el("month");
  const themeSelect = el("themeSelect");

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

  const onlyWeekend = el("onlyWeekend");
  const q = el("q");

  const btnExportMonth = el("btnExportMonth");
  const btnExportAll = el("btnExportAll");
  const btnDeleteAll = el("btnDeleteAll");
  const btnClear = el("btnClear");

  const chartIntensity = el("chartIntensity");
  const chartTriggers = el("chartTriggers");
  const chartMeds = el("chartMeds");
  const chartPain = el("chartPain");
  const btnRefreshCharts = el("btnRefreshCharts");

  const monthlyRows = el("monthlyRows");
  const btnPrintReportTop = el("btnPrintReportTop");
  const btnPrintReportBottom = el("btnPrintReportBottom");
  const btnSharePdfTop = el("btnSharePdfTop");
  const btnSharePdfBottom = el("btnSharePdfBottom");

  const patientNameInput = el("patientName");
  const btnBackup = el("btnBackup");
  const fileImport = el("fileImport");

  const stress = el("stress");
  const stressVal = el("stressVal");

  /* ========= Pain selector elements ========= */
  const painTabs = Array.from(document.querySelectorAll(".pain-tab"));
  const painFigures = Array.from(document.querySelectorAll(".pain-figure"));
  const painSelectionLabel = el("painSelectionLabel");
  const btnClearPain = el("btnClearPain");

  /* ========= PWA install ========= */
  let deferredPrompt = null;

  /* ========= Edit state ========= */
  let EDIT_ID = null;

  /* =========================
     Utils
     ========================= */
  function isoToday() {
    const d = new Date();
    const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return tz.toISOString().slice(0, 10);
  }
  function monthNow() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  }
  function isWeekend(dateISO) {
    const d = new Date(dateISO + "T00:00:00");
    const day = d.getDay();
    return day === 0 || day === 6;
  }
  function fmtDate(dateISO, timeHHMM) {
    const d = new Date(dateISO + "T00:00:00");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return timeHHMM ? `${dd}/${mm}/${yyyy} ${timeHHMM}` : `${dd}/${mm}/${yyyy}`;
  }
  function monthLabel(yyyyMM) {
    const [yy, mm] = yyyyMM.split("-");
    const d = new Date(`${yy}-${mm}-01T00:00:00`);
    return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  }
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function cryptoId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();
  }

  /* =========================
     Storage
     ========================= */
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }
  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  function getPatientName() {
    return (localStorage.getItem(KEY_NAME) || "").trim();
  }
  function setPatientName(v) {
    localStorage.setItem(KEY_NAME, (v || "").trim());
  }
  function getTheme() {
    return (localStorage.getItem(KEY_THEME) || "auto").trim();
  }
  function setTheme(v) {
    const t = (v || "auto").trim();
    localStorage.setItem(KEY_THEME, t);
    document.documentElement.setAttribute("data-theme", t);
  }
  function getGlobalDate() {
    const s = (localStorage.getItem(KEY_GLOBAL_DATE) || "").trim();
    return s || isoToday();
  }
  function setGlobalDateStorage(dateISO) {
    localStorage.setItem(KEY_GLOBAL_DATE, (dateISO || "").trim());
  }

  /* =========================
     ✅ Badge intensità
     ========================= */
  function intensityClass(intensity) {
    const n = Number(intensity || 0);
    if (n >= 1 && n <= 3) return "low";
    if (n >= 4 && n <= 6) return "mid";
    if (n >= 7 && n <= 10) return "high";
    return "mid";
  }
  function intensityBadgeHTML(intensity) {
    const cls = intensityClass(intensity);
    const n = Number(intensity || 0);
    return `<span class="intensity-badge intensity-${cls}">${n}/10</span>`;
  }

  /* =========================
     ✅ Posizione dolore
     ========================= */
  const PAIN_LABELS = {
    front_forehead_left: "Fronte (sx)",
    front_forehead_right: "Fronte (dx)",
    front_temple_left: "Tempia (sx)",
    front_temple_right: "Tempia (dx)",
    front_eye_left: "Perioculare (sx)",
    front_eye_right: "Perioculare (dx)",
    front_jaw_left: "Mandibola (sx)",
    front_jaw_right: "Mandibola (dx)",

    left_forehead: "Fronte (lato sx)",
    left_temple: "Tempia (lato sx)",
    left_eye: "Perioculare (lato sx)",
    left_jaw: "Mandibola (lato sx)",
    left_neck: "Collo (sx)",

    right_forehead: "Fronte (lato dx)",
    right_temple: "Tempia (lato dx)",
    right_eye: "Perioculare (lato dx)",
    right_jaw: "Mandibola (lato dx)",
    right_neck: "Collo (dx)",

    back_occipital_left: "Occipitale (sx)",
    back_occipital_right: "Occipitale (dx)",
    back_neck_left: "Collo post. (sx)",
    back_neck_right: "Collo post. (dx)",
  };

  let painState = { persp: "front", area: "" };

  function painLabel(area) {
    if (!area) return "—";
    return PAIN_LABELS[area] || area;
  }

  function setPainUI(persp, area) {
    painState.persp = persp || "front";
    painState.area = area || "";

    // tabs
    painTabs.forEach((b) => {
      const p = b.getAttribute("data-persp");
      const on = p === painState.persp;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    // figures
    painFigures.forEach((f) => {
      const key = f.getAttribute("data-figure");
      f.classList.toggle("active", key === painState.persp);
    });

    // clear active areas
    document.querySelectorAll(".pain-area.active").forEach((x) => x.classList.remove("active"));

    // set active area (only inside current figure)
    if (painState.area) {
      const fig = document.querySelector(`.pain-figure[data-figure="${painState.persp}"]`);
      const target = fig?.querySelector(`.pain-area[data-area="${CSS.escape(painState.area)}"]`);
      target?.classList.add("active");
    }

    if (painSelectionLabel) {
      painSelectionLabel.textContent = `Selezione: ${painLabel(painState.area)}`;
    }
  }

  function bindPainSelector() {
    // switch perspective
    painTabs.forEach((b) => {
      b.addEventListener("click", () => {
        const p = b.getAttribute("data-persp") || "front";
        // se cambi prospettiva, tieni area solo se esiste in quella figura
        let nextArea = painState.area;
        const fig = document.querySelector(`.pain-figure[data-figure="${p}"]`);
        if (nextArea && !fig?.querySelector(`.pain-area[data-area="${CSS.escape(nextArea)}"]`)) {
          nextArea = "";
        }
        setPainUI(p, nextArea);
      });
    });

    // click area
    document.querySelectorAll(".pain-area").forEach((a) => {
      a.addEventListener("click", () => {
        const area = a.getAttribute("data-area") || "";
        setPainUI(painState.persp, area);
      });
    });

    // clear
    btnClearPain?.addEventListener("click", () => setPainUI(painState.persp, ""));
  }

  /* =========================
     Form helpers
     ========================= */
  function getSelectedMeds() {
    const s = el("meds");
    if (!s) return [];
    return Array.from(s.selectedOptions).map((o) => o.value);
  }
  function setSelectedMeds(list) {
    const s = el("meds");
    if (!s) return;
    const set = new Set(list || []);
    Array.from(s.options).forEach((o) => (o.selected = set.has(o.value)));
  }
  function getSelectedTriggers() {
    const chips = document.querySelectorAll("#triggerChips input[type=checkbox]");
    return Array.from(chips).filter((x) => x.checked).map((x) => x.value);
  }
  function setSelectedTriggers(list) {
    const set = new Set(list || []);
    const chips = document.querySelectorAll("#triggerChips input[type=checkbox]");
    chips.forEach((x) => (x.checked = set.has(x.value)));
  }
  function clearTriggers() {
    const chips = document.querySelectorAll("#triggerChips input[type=checkbox]");
    chips.forEach((x) => (x.checked = false));
  }
  function resetFormFields() {
    if (el("time")) el("time").value = "";
    if (el("intensity")) el("intensity").value = "";
    if (el("duration")) el("duration").value = "";
    if (el("notes")) el("notes").value = "";
    if (el("sleepHours")) el("sleepHours").value = "";
    if (el("weather")) el("weather").value = "";
    if (el("foods")) el("foods").value = "";
    if (el("efficacy")) el("efficacy").value = "Parziale";
    const medsSel = el("meds");
    if (medsSel) Array.from(medsSel.options).forEach((o) => (o.selected = false));
    clearTriggers();
    if (stress) stress.value = "0";
    if (stressVal) stressVal.textContent = "0";

    // pain reset (keep persp, clear area)
    setPainUI(painState.persp || "front", "");
  }
  function setDateField(dateISO) {
    const d1 = el("date");
    if (d1) {
      d1.value = dateISO;
      return true;
    }
    const d2 = document.querySelector('input[type="date"]');
    if (d2) {
      d2.value = dateISO;
      return true;
    }
    return false;
  }

  /* =========================
     Trigger dedotti
     ========================= */
  function deducedTriggers({ stress, sleepHours, weather, foods }) {
    const out = [];
    if (typeof stress === "number" && stress >= 7) out.push("Stress alto");
    if (typeof sleepHours === "number" && sleepHours > 0 && sleepHours < 6) out.push("Poco sonno");
    if (weather && weather.trim()) out.push("Meteo");
    if (foods && foods.trim()) out.push("Alimenti");
    return out;
  }
  function compactExtras(a) {
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
  function addAttack(a) {
    const list = load();
    list.push(a);
    list.sort((x, y) => (y.date + (y.time || "")).localeCompare(x.date + (x.time || "")));
    save(list);
  }
  function updateAttack(id, patch) {
    const list = load();
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...patch };
    list.sort((x, y) => (y.date + (y.time || "")).localeCompare(x.date + (x.time || "")));
    save(list);
    return true;
  }
  function removeAttack(id) {
    const list = load().filter((x) => x.id !== id);
    save(list);
  }
  function getAttackById(id) {
    return load().find((x) => x.id === id) || null;
  }

  /* =========================
     Month helpers
     ========================= */
  function listForMonth(yyyyMM) {
    const list = load();
    const [yy, mm] = yyyyMM.split("-");
    const start = `${yy}-${mm}-01`;
    const endDate = new Date(`${yy}-${mm}-01T00:00:00`);
    endDate.setMonth(endDate.getMonth() + 1);
    const end = endDate.toISOString().slice(0, 10);
    return list.filter((a) => a.date >= start && a.date < end);
  }
  function daysInMonth(yyyyMM) {
    const [yy, mm] = yyyyMM.split("-");
    const start = new Date(`${yy}-${mm}-01T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    return end.getDate();
  }
  function isoOfDay(yyyyMM, day) {
    const [yy, mm] = yyyyMM.split("-");
    const dd = String(day).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }
  function attacksByDayForMonth(yyyyMM) {
    const monthAttacks = listForMonth(yyyyMM);
    const map = new Map();
    for (const a of monthAttacks) {
      const arr = map.get(a.date) || [];
      arr.push(a);
      map.set(a.date, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((x, y) => (x.time || "").localeCompare(y.time || ""));
      map.set(k, arr);
    }
    return map;
  }

  /* =========================
     Global date sync
     ========================= */
  function syncAllToDate(dateISO, opts = { pushToMonth: true }) {
    const d = (dateISO || isoToday()).slice(0, 10);
    const m = d.slice(0, 7);

    setGlobalDateStorage(d);

    if (globalDate) globalDate.value = d;
    setDateField(d);

    if (opts.pushToMonth && month) month.value = m;

    render();
    renderMonthlyTable();
    drawChartsFor(month?.value || m);
  }

  /* =========================
     Tabs navigation
     ========================= */
  function switchTo(viewKey) {
    tabs.forEach((x) => x.classList.remove("active"));
    const tab = tabs.find((t) => t.getAttribute("data-view") === viewKey);
    tab?.classList.add("active");

    Object.values(views).forEach((s) => s?.classList.remove("active"));
    views[viewKey]?.classList.add("active");

    const m = (month?.value || getGlobalDate().slice(0, 7) || monthNow()).trim();

    if (viewKey === "statistiche") drawChartsFor(m);
    if (viewKey === "report") renderMonthlyTable();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================
     Filters
     ========================= */
  function filteredList() {
    const m = (month?.value || monthNow()).trim();
    let out = listForMonth(m);

    const w = onlyWeekend?.value || "all";
    if (w === "weekend") out = out.filter((a) => isWeekend(a.date));
    if (w === "weekday") out = out.filter((a) => !isWeekend(a.date));

    const query = (q?.value || "").trim().toLowerCase();
    if (query) {
      out = out.filter((a) => {
        const meds = (a.meds || []).join(" ").toLowerCase();
        const notes = (a.notes || "").toLowerCase();
        const trig = (a.triggers || []).join(" ").toLowerCase();
        const foods = (a.foods || "").toLowerCase();
        const weather = (a.weather || "").toLowerCase();
        const date = (a.date || "").toLowerCase();
        const pain = painLabel(a.painArea || "").toLowerCase();
        return (
          meds.includes(query) ||
          notes.includes(query) ||
          trig.includes(query) ||
          foods.includes(query) ||
          weather.includes(query) ||
          date.includes(query) ||
          pain.includes(query)
        );
      });
    }

    out.sort((x, y) => (y.date + (y.time || "")).localeCompare(x.date + (x.time || "")));
    return out;
  }

  /* =========================
     Stats pills
     ========================= */
  function renderStats(list) {
    if (!stats) return;

    if (!list.length) {
      stats.innerHTML = `<span class="stat-pill">Nessun dato nel filtro selezionato</span>`;
      return;
    }

    const daysWithAttack = new Set(list.map((a) => a.date)).size;
    const avgIntensity = (list.reduce((s, a) => s + Number(a.intensity || 0), 0) / list.length).toFixed(1);
    const avgDuration = (list.reduce((s, a) => s + Number(a.duration || 0), 0) / list.length).toFixed(1);

    const weekend = list.filter((a) => isWeekend(a.date));
    const weekday = list.filter((a) => !isWeekend(a.date));

    const avgWk = weekend.length
      ? (weekend.reduce((s, a) => s + Number(a.intensity || 0), 0) / weekend.length).toFixed(1)
      : "—";
    const avgWd = weekday.length
      ? (weekday.reduce((s, a) => s + Number(a.intensity || 0), 0) / weekday.length).toFixed(1)
      : "—";

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
  function setSubmitLabel() {
    const btn = form?.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.textContent = EDIT_ID ? "Salva modifica" : "Salva attacco";
  }
  function cancelEdit() {
    EDIT_ID = null;
    setSubmitLabel();
    resetFormFields();
  }
  function startEdit(id) {
    const a = getAttackById(id);
    if (!a) return;

    EDIT_ID = id;
    setSubmitLabel();

    const d = a.date || isoToday();
    syncAllToDate(d, { pushToMonth: true });

    if (el("time")) el("time").value = a.time || "";
    if (el("intensity")) el("intensity").value = a.intensity ?? "";
    if (el("duration")) el("duration").value = a.duration ?? "";
    if (el("efficacy")) el("efficacy").value = a.efficacy || "Parziale";
    if (el("notes")) el("notes").value = a.notes || "";
    if (el("sleepHours")) el("sleepHours").value = a.sleepHours ?? "";
    if (el("weather")) el("weather").value = a.weather || "";
    if (el("foods")) el("foods").value = a.foods || "";

    if (stress) stress.value = String(a.stress ?? 0);
    if (stressVal) stressVal.textContent = String(a.stress ?? 0);

    setSelectedMeds(a.meds || []);
    setSelectedTriggers(a.triggers || []);

    // pain
    setPainUI(a.painPerspective || "front", a.painArea || "");

    switchTo("diario");
    el("card-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => el("intensity")?.focus(), 250);
  }

  /* =========================
     Render: Registro
     ========================= */
  function render() {
    const list = filteredList();

    if (rows) {
      rows.innerHTML = list
        .map((a) => {
          const meds = a.meds?.length ? a.meds.join(", ") : "—";
          const note = a.notes?.trim() ? a.notes : "—";
          const trig = a.triggers?.length ? a.triggers.join(", ") : "—";
          const wk = isWeekend(a.date) ? "Weekend" : "Feriale";
          const pain = painLabel(a.painArea || "");

          return `
            <tr>
              <td>${fmtDate(a.date, a.time)}<div class="muted small">${wk}</div></td>
              <td>${intensityBadgeHTML(a.intensity)}</td>
              <td>${Number(a.duration || 0)} h</td>
              <td>${escapeHtml(meds)}</td>
              <td>${escapeHtml(a.efficacy || "—")}</td>
              <td>${escapeHtml(trig)}</td>
              <td>${escapeHtml(pain)}</td>
              <td>${escapeHtml(note)}</td>
              <td style="text-align:right; white-space:nowrap">
                <button class="iconbtn" data-edit="${a.id}" title="Modifica">✏️</button>
                <button class="iconbtn" data-del="${a.id}" title="Elimina">🗑️</button>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    if (cards) {
      cards.innerHTML = list
        .map((a) => {
          const meds = a.meds?.length ? a.meds.join(", ") : "—";
          const note = a.notes?.trim() ? a.notes : "—";
          const trig = a.triggers?.length ? a.triggers.join(", ") : "—";
          const wk = isWeekend(a.date) ? "Weekend" : "Feriale";
          const extras = compactExtras(a);
          const cls = intensityClass(a.intensity);
          const pain = painLabel(a.painArea || "");

          return `
            <div class="card-row">
              <div class="top">
                <div>
                  <div style="font-weight:900">${fmtDate(a.date, a.time)} <span class="muted">• ${wk}</span></div>
                  <div class="small">${escapeHtml(extras)}</div>
                </div>
                <div class="badge intensity-${cls}">${Number(a.intensity || 0)}/10</div>
              </div>

              <div class="small" style="margin-top:8px"><strong>Durata:</strong> ${Number(a.duration || 0)} h</div>
              <div class="small"><strong>Farmaci:</strong> ${escapeHtml(meds)}</div>
              <div class="small"><strong>Efficacia:</strong> ${escapeHtml(a.efficacy || "—")}</div>
              <div class="small"><strong>Trigger:</strong> ${escapeHtml(trig)}</div>
              <div class="small"><strong>Posizione:</strong> ${escapeHtml(pain)}</div>
              <div class="small"><strong>Note:</strong> ${escapeHtml(note)}</div>

              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px">
                <button class="iconbtn" data-edit="${a.id}">Modifica</button>
                <button class="iconbtn" data-del="${a.id}">Elimina</button>
              </div>
            </div>
          `;
        })
        .join("");
    }

    document.querySelectorAll("[data-del]").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-del");
        if (!id) return;
        if (EDIT_ID === id) cancelEdit();
        removeAttack(id);
        render();
        renderMonthlyTable();
        drawChartsFor(month?.value || monthNow());
      });
    });

    document.querySelectorAll("[data-edit]").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-edit");
        if (!id) return;
        startEdit(id);
      });
    });

    renderStats(list);
  }

  /* =========================
     Report table logic
     ========================= */
  function summarizeDayAttacks(dayAttacks) {
    const maxInt = Math.max(...dayAttacks.map((a) => Number(a.intensity || 0)));
    const sumDur = dayAttacks.reduce((s, a) => s + Number(a.duration || 0), 0);

    const medsSet = new Set();
    dayAttacks.forEach((a) => (a.meds || []).forEach((m) => medsSet.add(m)));
    const meds = Array.from(medsSet).join(", ");

    const trigSet = new Set();
    dayAttacks.forEach((a) => (a.triggers || []).forEach((t) => trigSet.add(t)));
    const trig = Array.from(trigSet).join(", ");

    const painSet = new Set();
    dayAttacks.forEach((a) => {
      const p = painLabel(a.painArea || "");
      if (p && p !== "—") painSet.add(p);
    });
    const painTxt = Array.from(painSet).join(", ");

    const order = ["Nessuna", "Parziale", "Buona", "Ottima"];
    const worstEff = dayAttacks
      .map((a) => a.efficacy || "Parziale")
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];

    const notes = dayAttacks
      .map((a) => {
        const t = a.time ? a.time + " " : "";
        const n = (a.notes || "").trim();
        return n ? `${t}${n}` : t ? `${t}attacco` : "attacco";
      })
      .join(" • ");

    const extras = dayAttacks
      .map((a) => compactExtras(a))
      .filter((x) => x && x !== "—")
      .join(" • ");

    const trigNote = [
      trig ? `Trigger: ${trig}` : "",
      painTxt ? `Sede: ${painTxt}` : "",
      extras ? extras : "",
      notes ? `Note: ${notes}` : "",
    ]
      .filter(Boolean)
      .join(" — ");

    return { maxInt, sumDur: Number.isFinite(sumDur) ? sumDur : 0, meds, worstEff, trigNote };
  }

  function goToDiaryWithDate(dateISO) {
    if (EDIT_ID) cancelEdit();
    syncAllToDate(dateISO, { pushToMonth: true });
    switchTo("diario");
    setDateField(dateISO);
    el("card-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => el("intensity")?.focus(), 250);
  }

  function goToDiaryOpenDay(dateISO) {
    const m = dateISO.slice(0, 7);
    if (month) month.value = m;
    if (q) q.value = dateISO;
    if (onlyWeekend) onlyWeekend.value = "all";
    render();
    switchTo("diario");
    el("card-registro")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindReportActions() {
    document.querySelectorAll("[data-add-date]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const dateISO = btn.getAttribute("data-add-date");
        if (dateISO) goToDiaryWithDate(dateISO);
      });
    });

    document.querySelectorAll("[data-open-date]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const dateISO = btn.getAttribute("data-open-date");
        if (dateISO) goToDiaryOpenDay(dateISO);
      });
    });

    document.querySelectorAll("[data-dayrow]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const dateISO = tr.getAttribute("data-dayrow");
        if (dateISO) goToDiaryWithDate(dateISO);
      });
    });
  }

  function renderMonthlyTable() {
    if (!monthlyRows) return;

    const m = (month?.value || (globalDate?.value || getGlobalDate()).slice(0, 7) || monthNow()).trim();
    if (month) month.value = m;

    const dcount = daysInMonth(m);
    const map = attacksByDayForMonth(m);

    let html = "";
    for (let day = 1; day <= dcount; day++) {
      const iso = isoOfDay(m, day);
      const d = new Date(iso + "T00:00:00");
      const dow = d.toLocaleDateString("it-IT", { weekday: "short" });
      const wkTag = isWeekend(iso) ? " (weekend)" : "";

      const dayAttacks = map.get(iso) || [];

      if (!dayAttacks.length) {
        html += `
          <tr data-dayrow="${iso}">
            <td>${String(day).padStart(2, "0")}/${m.slice(5, 7)} (${dow})${wkTag}</td>
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
          <td>${String(day).padStart(2, "0")}/${m.slice(5, 7)} (${dow})${wkTag}</td>
          <td>${intensityBadgeHTML(s.maxInt)}</td>
          <td>${(Math.round(s.sumDur * 10) / 10).toFixed(1)} h</td>
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
  function exportCSV(yyyyMM, mode) {
    const list = mode === "all" ? load() : listForMonth(yyyyMM);
    const header = [
      "Data",
      "Ora",
      "Intensità",
      "Durata_ore",
      "Farmaci",
      "Efficacia",
      "Trigger",
      "Posizione_dolore",
      "Stress_0_10",
      "Ore_sonno",
      "Meteo",
      "Alimenti",
      "Note",
      "Weekend",
    ];
    const lines = [header.join(";")];

    for (const a of list) {
      const meds = a.meds?.length ? a.meds.join(", ") : "";
      const trig = a.triggers?.length ? a.triggers.join(", ") : "";
      const row = [
        a.date,
        a.time || "",
        a.intensity,
        a.duration,
        meds,
        a.efficacy || "",
        trig,
        painLabel(a.painArea || ""),
        typeof a.stress === "number" ? a.stress : "",
        typeof a.sleepHours === "number" ? a.sleepHours : "",
        a.weather || "",
        a.foods || "",
        (a.notes || "").replaceAll("\n", " ").trim(),
        isWeekend(a.date) ? "SI" : "NO",
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`);

      lines.push(row.join(";"));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = mode === "all" ? `diario-cefalea_TUTTO.csv` : `diario-cefalea_${yyyyMM}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* =========================
     Backup / Import JSON
     ========================= */
  function backupJSON() {
    const blob = new Blob([localStorage.getItem(KEY) || "[]"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup_diario_cefalea.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error("Formato non valido");
        const current = load();
        const map = new Map(current.map((x) => [x.id, x]));
        parsed.forEach((x) => {
          if (x && x.id) map.set(x.id, x);
        });
        const merged = Array.from(map.values());
        merged.sort((x, y) => (y.date + (y.time || "")).localeCompare(x.date + (x.time || "")));
        save(merged);
        render();
        renderMonthlyTable();
        drawChartsFor(month?.value || monthNow());
        alert("Import completato ✅");
      } catch {
        alert("Import non riuscito: file non valido");
      }
    };
    reader.readAsText(file);
  }

  /* =========================
     Charts (canvas) – no libs
     ========================= */
  function cssColor(varName, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  }

  function ensureCanvasSize(canvas) {
    if (!canvas) return { W: 0, H: 0, dpr: 1 };
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 0));
    const H = Math.max(240, Math.floor(rect.height || canvas.clientHeight || 0));

    const needW = Math.floor(W * dpr);
    const needH = Math.floor(H * dpr);
    if (canvas.width !== needW) canvas.width = needW;
    if (canvas.height !== needH) canvas.height = needH;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W, H, dpr };
  }

  function drawBarChart(canvas, labels, values, options) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { W, H } = ensureCanvasSize(canvas);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, 0, W, H);

    const padL = 54;
    const padR = 14;
    const padT = 16;
    const padB = 72;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxV = Math.max(1, ...values);

    ctx.strokeStyle = options.gridColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = options.textColor;

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padT + (plotH * i) / steps;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();

      const val = Math.round(maxV * (1 - i / steps));
      ctx.font = "12px system-ui";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(val), padL - 10, y);
    }

    const n = labels.length || 1;
    const gap = 3;
    const barW = Math.max(3, plotW / n - gap);

    for (let i = 0; i < labels.length; i++) {
      const v = values[i] || 0;
      const x = padL + i * (barW + gap);
      const h = (v / maxV) * plotH;
      const y = padT + (plotH - h);
      ctx.fillStyle = options.barColor;
      ctx.fillRect(x, y, barW, h);
    }

    ctx.fillStyle = options.textColor;
    const smallFont = labels.length > 25 ? 9 : 11;
    ctx.font = `${smallFont}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = 0; i < labels.length; i++) {
      if (labels.length > 25 && (i + 1) % 2 === 0) continue;
      const x = padL + i * (barW + gap) + barW / 2;
      const y = H - padB + 24;
      ctx.fillText(String(labels[i]).slice(0, 14), x, y);
    }
  }

  function topCounts(items) {
    const m = new Map();
    for (const it of items) {
      if (!it) continue;
      m.set(it, (m.get(it) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }

  function drawChartsFor(yyyyMM) {
    const list = listForMonth(yyyyMM);
    const dcount = daysInMonth(yyyyMM);

    const byDay = attacksByDayForMonth(yyyyMM);
    const labels = [];
    const vals = [];
    for (let day = 1; day <= dcount; day++) {
      const iso = isoOfDay(yyyyMM, day);
      labels.push(String(day));
      const dayAttacks = byDay.get(iso) || [];
      if (!dayAttacks.length) {
        vals.push(0);
        continue;
      }
      const maxInt = Math.max(...dayAttacks.map((a) => Number(a.intensity || 0)));
      vals.push(maxInt);
    }

    const bg = cssColor("--card", "#111a2d");
    const grid = cssColor("--line", "#24314f");
    const txt = cssColor("--muted", "#a6b3d1");
    const bar = cssColor("--primary", "#2b6cff");

    drawBarChart(chartIntensity, labels, vals, { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar });

    const allTrig = [];
    for (const a of list) {
      const t = new Set([...(a.triggers || []), ...deducedTriggers(a)]);
      t.forEach((x) => allTrig.push(x));
    }
    const trigCounts = topCounts(allTrig).slice(0, 10);
    drawBarChart(
      chartTriggers,
      trigCounts.map((x) => x[0]),
      trigCounts.map((x) => x[1]),
      { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar }
    );

    const allMeds = [];
    for (const a of list) (a.meds || []).forEach((x) => allMeds.push(x));
    const medsCounts = topCounts(allMeds).slice(0, 10);
    drawBarChart(
      chartMeds,
      medsCounts.map((x) => String(x[0]).replace(" (FANS)", "")),
      medsCounts.map((x) => x[1]),
      { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar }
    );

    // ✅ Pain chart
    const allPain = [];
    for (const a of list) {
      const p = painLabel(a.painArea || "");
      allPain.push(p === "—" ? "Non indicata" : p);
    }
    const painCounts = topCounts(allPain).slice(0, 10);
    drawBarChart(
      chartPain,
      painCounts.map((x) => x[0]),
      painCounts.map((x) => x[1]),
      { bgColor: bg, gridColor: grid, textColor: txt, barColor: bar }
    );
  }

  /* =========================
     PRINT (browser) – grafici + tabella + note medico
     ========================= */
  function buildMonthlyTableHTML_ForPrint(yyyyMM) {
    const dcount = daysInMonth(yyyyMM);
    const map = attacksByDayForMonth(yyyyMM);

    let body = "";
    for (let day = 1; day <= dcount; day++) {
      const iso = isoOfDay(yyyyMM, day);
      const d = new Date(iso + "T00:00:00");
      const dow = d.toLocaleDateString("it-IT", { weekday: "short" });
      const wk = isWeekend(iso) ? " (weekend)" : "";

      const dayAttacks = map.get(iso) || [];
      if (!dayAttacks.length) {
        body += `
          <tr>
            <td>${String(day).padStart(2, "0")}/${yyyyMM.slice(5, 7)} (${dow})${wk}</td>
            <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
          </tr>
        `;
      } else {
        const s = summarizeDayAttacks(dayAttacks);
        body += `
          <tr>
            <td>${String(day).padStart(2, "0")}/${yyyyMM.slice(5, 7)} (${dow})${wk}</td>
            <td><strong>${s.maxInt}</strong>/10</td>
            <td>${(Math.round(s.sumDur * 10) / 10).toFixed(1)} h</td>
            <td>${escapeHtml(s.meds || "—")}</td>
            <td>${escapeHtml(s.worstEff || "—")}</td>
            <td>${escapeHtml(s.trigNote || "—")}</td>
          </tr>
        `;
      }
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

  function buildPrintHTML(yyyyMM) {
    renderMonthlyTable();
    drawChartsFor(yyyyMM);

    const imgInt = chartIntensity ? chartIntensity.toDataURL("image/png") : "";
    const imgTrig = chartTriggers ? chartTriggers.toDataURL("image/png") : "";
    const imgMeds = chartMeds ? chartMeds.toDataURL("image/png") : "";
    const imgPain = chartPain ? chartPain.toDataURL("image/png") : "";

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

      .doctor-box{
        border: 1px solid #999;
        border-radius: 8px;
        padding: 10px;
        margin-top: 10mm;
      }
      .doctor-box h4{
        margin: 0 0 6px 0;
        font-size: 12px;
        letter-spacing: .02em;
      }
      .doctor-lines{
        height: 55mm;
        border-top: 1px dashed #bbb;
        margin-top: 8px;
      }
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

          <p class="ptv-instr">Compila ogni riga indicando frequenza, intensità, durata e risposta ai farmaci.</p>

          <div class="chart">
            <h3>Intensità (max) giorno per giorno</h3>
            ${hasAnyData && imgInt ? `<img src="${imgInt}" alt="Grafico Intensità">` : `<p class="ptv-instr">Nessun dato registrato nel mese.</p>`}
          </div>

          <div class="chart">
            <h3>Trigger più frequenti</h3>
            ${hasAnyData && imgTrig ? `<img src="${imgTrig}" alt="Grafico Trigger">` : `<p class="ptv-instr">Nessun dato registrato nel mese.</p>`}
          </div>

          <div class="chart">
            <h3>Farmaci più usati</h3>
            ${hasAnyData && imgMeds ? `<img src="${imgMeds}" alt="Grafico Farmaci">` : `<p class="ptv-instr">Nessun dato registrato nel mese.</p>`}
          </div>

          <div class="chart">
            <h3>Posizione del dolore</h3>
            ${hasAnyData && imgPain ? `<img src="${imgPain}" alt="Grafico Posizione dolore">` : `<p class="ptv-instr">Nessun dato registrato nel mese.</p>`}
          </div>

          <div class="page-break"></div>

          <h3>Tabella giornaliera</h3>
          ${tableHTMLPrint}

          <div class="doctor-box">
            <h4>Note del medico / Osservazioni cliniche</h4>
            <div class="doctor-lines"></div>
          </div>
        </body>
      </html>
    `;
  }

  async function printReport() {
    try {
      const m = (month?.value || monthNow()).trim();
      const html = buildPrintHTML(m);

      const w = window.open("", "_blank");
      if (!w) {
        alert("Impossibile aprire la stampa: popup bloccato. Prova da Chrome (non dentro WebView).");
        return;
      }

      w.document.open();
      w.document.write(html);
      w.document.close();

      const waitImages = () => {
        const imgs = Array.from(w.document.images || []);
        if (!imgs.length) return Promise.resolve();
        return Promise.all(
          imgs.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            });
          })
        );
      };

      w.onload = async () => {
        await waitImages().catch(() => {});
        setTimeout(() => {
          w.focus();
          w.print();
        }, 250);
      };
    } catch (err) {
      console.error(err);
      alert("Errore stampa/PDF: " + (err?.message || err));
    }
  }

  /* =========================
     PDF reale (jsPDF) + share WhatsApp
     ========================= */
  function safeChartDataURL(canvas) {
    try {
      if (!canvas) return "";
      ensureCanvasSize(canvas);
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  }

  function buildRowsForPdf(yyyyMM) {
    const dcount = daysInMonth(yyyyMM);
    const map = attacksByDayForMonth(yyyyMM);
    const out = [];

    for (let day = 1; day <= dcount; day++) {
      const iso = isoOfDay(yyyyMM, day);
      const d = new Date(iso + "T00:00:00");
      const dow = d.toLocaleDateString("it-IT", { weekday: "short" });
      const wk = isWeekend(iso) ? "weekend" : "feriale";
      const dayAttacks = map.get(iso) || [];

      if (!dayAttacks.length) {
        out.push({
          dayLabel: `${String(day).padStart(2, "0")}/${yyyyMM.slice(5, 7)} (${dow})`,
          intensity: "—",
          duration: "—",
          meds: "—",
          resp: "—",
          note: "—",
          wk,
        });
      } else {
        const s = summarizeDayAttacks(dayAttacks);
        out.push({
          dayLabel: `${String(day).padStart(2, "0")}/${yyyyMM.slice(5, 7)} (${dow})`,
          intensity: `${s.maxInt}/10`,
          duration: `${(Math.round(s.sumDur * 10) / 10).toFixed(1)} h`,
          meds: s.meds || "—",
          resp: s.worstEff || "—",
          note: s.trigNote || "—",
          wk,
        });
      }
    }
    return out;
  }

  async function generateMonthlyPdfBlob(yyyyMM) {
    const jspdf = window.jspdf?.jsPDF;
    if (!jspdf) throw new Error("jsPDF non disponibile");

    drawChartsFor(yyyyMM);
    renderMonthlyTable();

    const nome = getPatientName() || "__________________________";
    const label = monthLabel(yyyyMM);

    const imgInt = safeChartDataURL(chartIntensity);
    const imgTrig = safeChartDataURL(chartTriggers);
    const imgMeds = safeChartDataURL(chartMeds);
    const imgPain = safeChartDataURL(chartPain);

    const rowsPdf = buildRowsForPdf(yyyyMM);

    const doc = new jspdf({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const margin = 12;
    const contentW = pageW - margin * 2;

    const header = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("FONDAZIONE PTV — POLICLINICO TOR VERGATA", margin, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Centro Cefalee — Referente: Dr.ssa Maria Albanese", margin, 19);

      doc.setDrawColor(180);
      doc.line(margin, 22, pageW - margin, 22);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`Report Cefalea — ${label}`, margin, 30);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Nome e Cognome: ${nome}`, margin, 36);
      doc.text(`Data generazione: ${new Date().toLocaleDateString("it-IT")}`, margin, 41);

      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text("Compila ogni riga indicando frequenza, intensità, durata e risposta ai farmaci.", margin, 47);
      doc.setTextColor(0);
    };

    const addChartBlock = (title, imgData, yStart, maxH) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, margin, yStart);

      const boxY = yStart + 6;
      const boxH = maxH;

      doc.setDrawColor(210);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, boxY, contentW, boxH, 3, 3);

      if (imgData) {
        doc.addImage(imgData, "PNG", margin, boxY + 2, contentW, boxH - 4, undefined, "FAST");
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.text("Nessun dato disponibile.", margin + 4, boxY + 10);
        doc.setTextColor(0);
      }
      return boxY + boxH + 10;
    };

    // Pagina 1
    header();
    let y = 55;
    y = addChartBlock("Intensità (max) giorno per giorno", imgInt, y, 78);

    // Pagina 2
    doc.addPage();
    header();
    y = 55;
    y = addChartBlock("Trigger più frequenti", imgTrig, y, 58);
    y = addChartBlock("Farmaci più usati", imgMeds, y, 58);
    y = addChartBlock("Posizione del dolore", imgPain, y, 58);

    // Tabella
    doc.addPage();
    header();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Tabella giornaliera", margin, 55);

    let ty = 60;
    const col = {
      day: margin,
      int: margin + 48,
      dur: margin + 68,
      med: margin + 88,
      rsp: margin + 136,
      note: margin + 160,
    };

    const drawTableHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setDrawColor(190);
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, ty, contentW, 9, "F");

      doc.text("Giorno", col.day + 1.5, ty + 6);
      doc.text("Int.", col.int + 1.5, ty + 6);
      doc.text("Dur.", col.dur + 1.5, ty + 6);
      doc.text("Farmaci", col.med + 1.5, ty + 6);
      doc.text("Risposta", col.rsp + 1.5, ty + 6);
      doc.text("Note/Trigger", col.note + 1.5, ty + 6);

      ty += 11;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
    };

    const newPageForTable = () => {
      doc.addPage();
      header();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Tabella giornaliera (continua)", margin, 55);
      ty = 60;
      drawTableHeader();
    };

    drawTableHeader();

    for (const r of rowsPdf) {
      if (ty + 9 > pageH - margin - 40) newPageForTable();

      doc.setDrawColor(220);
      doc.rect(margin, ty - 6.5, contentW, 8.5);

      doc.setTextColor(r.wk === "weekend" ? 90 : 40);
      doc.text(r.dayLabel, col.day + 1.5, ty);
      doc.setTextColor(0);

      doc.text(String(r.intensity).slice(0, 6), col.int + 1.5, ty);
      doc.text(String(r.duration).slice(0, 8), col.dur + 1.5, ty);

      const medsTxt = String(r.meds);
      const respTxt = String(r.resp);
      const noteTxt = String(r.note);

      const medsShort = medsTxt.length > 26 ? medsTxt.slice(0, 26) + "…" : medsTxt;
      const respShort = respTxt.length > 14 ? respTxt.slice(0, 14) + "…" : respTxt;

      doc.text(medsShort, col.med + 1.5, ty);
      doc.text(respShort, col.rsp + 1.5, ty);

      const maxNoteLen = 36;
      const n1 = noteTxt.slice(0, maxNoteLen);
      const n2 =
        noteTxt.length > maxNoteLen
          ? noteTxt.slice(maxNoteLen, maxNoteLen * 2) + (noteTxt.length > maxNoteLen * 2 ? "…" : "")
          : "";

      doc.text(n1, col.note + 1.5, ty);
      if (n2) doc.text(n2, col.note + 1.5, ty + 4.5);

      ty += 9.5;
    }

    // Note medico
    doc.addPage();
    header();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Note del medico / Osservazioni cliniche", margin, 55);

    doc.setDrawColor(120);
    doc.roundedRect(margin, 62, contentW, 140, 4, 4);

    doc.setDrawColor(200);
    for (let i = 0; i < 12; i++) {
      const yLine = 72 + i * 10;
      doc.setLineDashPattern([2, 2], 0);
      doc.line(margin + 6, yLine, pageW - margin - 6, yLine);
    }
    doc.setLineDashPattern([], 0);

    return doc.output("blob");
  }

  async function shareMonthlyPdf() {
    try {
      const m = (month?.value || (globalDate?.value || getGlobalDate()).slice(0, 7) || monthNow()).trim();
      const blob = await generateMonthlyPdfBlob(m);

      const fileName = `Report_Cefalea_${m}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: "Report Cefalea",
          text: "Report mensile (PDF) — Diario Cefalea",
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      alert("Condivisione diretta non disponibile qui: ho scaricato il PDF. Ora puoi allegarlo su WhatsApp ✅");
    } catch (err) {
      console.error(err);
      alert("Errore nella generazione/condivisione del PDF: " + (err?.message || err));
    }
  }

  /* =========================
     Events: form submit
     ========================= */
  if (form) {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();

      const date = el("date")?.value || globalDate?.value;
      if (!date) return alert("Inserisci la data");

      const intensity = Number(el("intensity")?.value);
      const duration = Number(el("duration")?.value);

      if (!Number.isFinite(intensity) || intensity < 1 || intensity > 10) return alert("Inserisci intensità 1–10");
      if (!Number.isFinite(duration) || duration <= 0) return alert("Inserisci durata (ore)");

      const time = el("time")?.value || "";
      const meds = getSelectedMeds();
      const efficacy = el("efficacy")?.value || "Parziale";
      const notes = el("notes")?.value || "";

      const stressNum = Number(stress?.value || 0);

      const sleepHoursRaw = el("sleepHours")?.value;
      const sleepHoursVal = sleepHoursRaw === "" || sleepHoursRaw == null ? null : Number(sleepHoursRaw);

      const weatherVal = el("weather")?.value || "";
      const foodsVal = el("foods")?.value || "";
      const triggersManual = getSelectedTriggers();

      const trig = new Set([
        ...triggersManual,
        ...deducedTriggers({
          stress: stressNum,
          sleepHours: sleepHoursVal ?? undefined,
          weather: weatherVal,
          foods: foodsVal,
        }),
      ]);

      const payload = {
        date,
        time,
        intensity,
        duration,
        meds,
        efficacy,
        triggers: Array.from(trig),
        stress: stressNum,
        sleepHours: sleepHoursVal,
        weather: weatherVal,
        foods: foodsVal,
        notes,
        // ✅ pain
        painPerspective: painState.persp || "front",
        painArea: painState.area || "",
      };

      if (EDIT_ID) {
        updateAttack(EDIT_ID, payload);
        cancelEdit();
      } else {
        addAttack({ id: cryptoId(), ...payload });
        resetFormFields();
        setDateField(date);
      }

      syncAllToDate(date, { pushToMonth: true });
      render();
      renderMonthlyTable();
      drawChartsFor(month?.value || date.slice(0, 7) || monthNow());
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
    renderMonthlyTable();
    drawChartsFor(month?.value || monthNow());
  });

  month?.addEventListener("change", () => {
    const m = month.value || monthNow();
    render();
    renderMonthlyTable();
    drawChartsFor(m);
  });

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

  btnRefreshCharts?.addEventListener("click", () => drawChartsFor(month?.value || monthNow()));

  btnPrintReportTop?.addEventListener("click", printReport);
  btnPrintReportBottom?.addEventListener("click", printReport);

  btnSharePdfTop?.addEventListener("click", shareMonthlyPdf);
  btnSharePdfBottom?.addEventListener("click", shareMonthlyPdf);

  patientNameInput?.addEventListener("input", () => setPatientName(patientNameInput.value));

  stress?.addEventListener("input", () => {
    if (stressVal) stressVal.textContent = stress.value;
  });

  globalDate?.addEventListener("change", () => {
    if (!globalDate.value) return;
    syncAllToDate(globalDate.value, { pushToMonth: true });
  });

  el("date")?.addEventListener("change", () => {
    const v = el("date")?.value;
    if (v) syncAllToDate(v, { pushToMonth: true });
  });

  themeSelect?.addEventListener("change", () => setTheme(themeSelect.value));

  tabs.forEach((t) => {
    t.addEventListener("click", () => switchTo(t.getAttribute("data-view")));
  });

  /* ========= PWA install prompt ========= */
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) btnInstall.hidden = false;
  });

  btnInstall?.addEventListener("click", async () => {
    if (!deferredPrompt) {
      alert("Installazione non disponibile ora.\nApri in Chrome → menu ⋮ → 'Installa app' / 'Aggiungi a schermata Home'.");
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (btnInstall) btnInstall.hidden = true;
  });

  /* =========================
     INIT
     ========================= */
  function init() {
    // theme
    const th = getTheme();
    if (themeSelect) themeSelect.value = th;
    setTheme(th);

    // global date + month
    const gd = getGlobalDate();
    if (globalDate) globalDate.value = gd;
    setDateField(gd);
    if (month) month.value = gd.slice(0, 7);

    // name
    if (patientNameInput) patientNameInput.value = getPatientName();

    // stress badge
    if (stressVal && stress) stressVal.textContent = stress.value;

    // pain selector
    bindPainSelector();
    setPainUI("front", "");

    setSubmitLabel();

    // first render
    render();
    renderMonthlyTable();
    drawChartsFor(month?.value || monthNow());

    // resize charts
    window.addEventListener("resize", () => drawChartsFor(month?.value || monthNow()));

    // SW register
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      });
    }
  }

  init();
})();
