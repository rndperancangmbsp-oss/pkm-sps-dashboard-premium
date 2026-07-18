(() => {
  "use strict";

  const COLUMN_DEFS = [
    { name: "Pemaju", title: "PEMAJU", optional: true },
    { name: "Permohonan", title: "PERMOHONAN", optional: true },
    { name: "Pindaan", title: "PINDAAN", optional: true },
    { name: "Perunding", title: "PERUNDING", optional: true },
    { name: "Lot", title: "LOT", optional: true },
    { name: "Mukim", title: "MUKIM", optional: true },
    { name: "NoRujPKM", title: "NO. RUJ. PKM", optional: true },
    { name: "OscTerima", title: "OSC TERIMA", optional: true },
    { name: "TunaiSyarat", title: "TUNAI SYARAT", optional: true },
    { name: "BentangOSC", title: "BENTANG OSC", optional: true },
    { name: "BilOSC", title: "BIL. OSC", optional: true },
    { name: "TarikhOSC", title: "TARIKH OSC", optional: true },
    { name: "Keputusan", title: "KEPUTUSAN", optional: true },
    { name: "StatusTunaiSyarat", title: "STATUS TUNAI SYARAT", optional: true },
    { name: "TarikhC1", title: "TARIKH C1", optional: true },
    { name: "Latitude", title: "LATITUDE", optional: true },
    { name: "Longitude", title: "LONGITUDE", optional: true }
  ];

  const ALIASES = {
    Pemaju: ["PEMAJU", "PEMOHON"], Permohonan: ["PERMOHONAN"], Pindaan: ["PINDAAN"],
    Perunding: ["PERUNDING"], Lot: ["LOT", "NOLOT", "NOMBORLOT"], Mukim: ["MUKIM"],
    NoRujPKM: ["NORUJPKM", "NORUJUKANPKM", "RUJPKM"], OscTerima: ["OSCTERIMA", "TARIKHTERIMAOSC"],
    TunaiSyarat: ["TUNAISYARAT"], BentangOSC: ["BENTANGOSC", "TARIKHBENTANGOSC"],
    BilOSC: ["BILOSC", "BILANGANOSC"], TarikhOSC: ["TARIKHOSC"], Keputusan: ["KEPUTUSAN"],
    StatusTunaiSyarat: ["STATUSTUNAISYARAT", "STATUSPEMATUHAN"], TarikhC1: ["TARIKHC1"],
    Latitude: ["LATITUDE", "LAT"], Longitude: ["LONGITUDE", "LONG", "LNG"]
  };

  const DECISION_LABELS = {
    approved: "Diluluskan", rejected: "Ditolak", withdrawn: "Tarik Balik",
    pending: "Belum Ada Keputusan", other: "Lain-lain"
  };
  const DECISION_COLORS = {
    approved: "#2F855A", rejected: "#D6455D", withdrawn: "#7C6AA6",
    pending: "#F59E0B", other: "#4F7C9B"
  };
  const COMPLIANCE_ORDER = ["Selesai", "Pematuhan Tunai Syarat", "Pending", "Lain-lain"];
  const COMPLIANCE_COLORS = {
    "Selesai": "#2C3240", "Pematuhan Tunai Syarat": "#6E7A94",
    "Pending": "#AEB6C8", "Lain-lain": "#D7DBE3"
  };
  const MONTHS_SHORT = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis"];
  const MONTHS_FULL = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
  const WEEKDAYS = ["ISN", "SEL", "RAB", "KHA", "JUM", "SAB", "AHD"];
  const CALENDAR_NOTES_OPTION_KEY = "calendarNotesV2";
  const CALENDAR_NOTES_LEGACY_KEY = "calendarNotesV1";
  const CALENDAR_NOTES_BACKUP_KEY = "pkmSpsCalendarNotesV2";

  const state = {
    mode: "loading", all: [], filtered: [], mappings: null, filters: {},
    sortKey: "TarikhOSCDate", sortDir: "desc", page: 1, pageSize: 15,
    selectedRowId: null, calendarDate: null,
    calendarNotes: [], selectedCalendarNoteId: null, selectedCalendarDateKey: null,
    gristOptionsLoaded: false, gristAccessLevel: "", noteStorageState: "loading", noteStorageError: ""
  };
  const dom = {};
  let searchTimer = null;
  let syncTimer = null;
  let toastTimer = null;

  document.addEventListener("DOMContentLoaded", boot);

  function boot() {
    cacheDom();
    bindEvents();
    initNav();
    const params = new URLSearchParams(location.search);
    if (params.get("demo") === "1" || !isEmbedded()) startStandalone();
    else loadGristApi();
  }

  function cacheDom() {
    [
      "app", "loadingOverlay", "toast", "modeDot", "modeLabel", "mappingBanner", "mappingMessage",
      "heroTotal", "heroPeriod", "printBtn", "exportBtn", "resetBtn", "recordSummary", "updatedAt",
      "searchInput", "yearFilter", "monthFilter", "mukimFilter", "decisionFilter", "developerFilter", "consultantFilter",
      "complianceFilter", "syncToggle", "kpiTotal", "kpiTotalNote", "kpiApproved", "kpiApprovedNote",
      "kpiRejected", "kpiRejectedNote", "kpiWithdrawn", "kpiWithdrawnNote", "kpiPending", "kpiPendingNote",
      "kpiNonCompliant", "kpiNonCompliantNote", "kpiC1", "kpiC1Note", "insightCards", "decisionMeta",
      "decisionChart", "complianceMeta", "complianceChart", "trendMeta", "trendChart", "complianceYearMeta",
      "complianceYearChart", "mukimChart", "developerChart", "durationReceivedMeta", "durationReceivedChart",
      "durationOscMeta", "durationOscChart", "calendarPrevBtn", "calendarMonthLabel", "calendarNextBtn",
      "calendarTodayBtn", "calendarAddBtn", "calendarGrid", "calendarNotesList", "calendarNoteCount",
      "noteModal", "noteForm", "noteModalTitle", "noteDate", "noteTime", "noteTitle", "noteText", "noteStatus",
      "noteSaveBtn", "noteDeleteBtn", "noteCancelBtn", "noteCloseBtn", "pageSizeSelect", "tableBody", "pageInfo", "prevPageBtn",
      "nextPageBtn", "qualityGrid"
    ].forEach((id) => { dom[id] = document.getElementById(id); });
    dom.sortButtons = Array.from(document.querySelectorAll("thead button[data-sort]"));
  }

  function bindEvents() {
    dom.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applyFilters(true), 150);
    });
    [dom.yearFilter, dom.monthFilter, dom.mukimFilter, dom.decisionFilter, dom.developerFilter, dom.consultantFilter, dom.complianceFilter]
      .forEach((el) => el.addEventListener("change", () => applyFilters(true)));
    dom.resetBtn.addEventListener("click", resetFilters);
    dom.exportBtn.addEventListener("click", exportFilteredCsv);
    dom.printBtn.addEventListener("click", () => window.print());
    dom.pageSizeSelect.addEventListener("change", () => {
      state.pageSize = Number(dom.pageSizeSelect.value) || 15;
      state.page = 1;
      renderTable();
    });
    dom.prevPageBtn.addEventListener("click", () => {
      if (state.page > 1) { state.page -= 1; renderTable(); }
    });
    dom.nextPageBtn.addEventListener("click", () => {
      const max = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
      if (state.page < max) { state.page += 1; renderTable(); }
    });
    dom.sortButtons.forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else {
        state.sortKey = key;
        state.sortDir = /Date|Days|LatNum|LonNum/.test(key) ? "desc" : "asc";
      }
      state.page = 1;
      renderTable();
    }));
    dom.syncToggle.addEventListener("change", () => {
      if (state.mode !== "grist") {
        dom.syncToggle.checked = false;
        showToast("Penyelarasan hanya tersedia apabila dashboard digunakan dalam Grist.");
        return;
      }
      if (!dom.syncToggle.checked && window.grist?.setSelectedRows) window.grist.setSelectedRows(null).catch(() => {});
      else scheduleSync(true);
    });
    dom.calendarPrevBtn.addEventListener("click", () => moveCalendar(-1));
    dom.calendarNextBtn.addEventListener("click", () => moveCalendar(1));
    dom.calendarTodayBtn.addEventListener("click", () => {
      const now = new Date();
      state.calendarDate = new Date(now.getFullYear(), now.getMonth(), 1);
      renderCalendar();
    });
    dom.calendarAddBtn.addEventListener("click", () => openNoteModal(dateKey(new Date())));
    dom.noteForm.addEventListener("submit", saveCalendarNote);
    dom.noteDeleteBtn.addEventListener("click", deleteCalendarNote);
    dom.noteCancelBtn.addEventListener("click", closeNoteModal);
    dom.noteCloseBtn.addEventListener("click", closeNoteModal);
    dom.noteModal.querySelectorAll("[data-note-close]").forEach((el) => el.addEventListener("click", closeNoteModal));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !dom.noteModal.hidden) closeNoteModal();
    });
  }

  function initNav() {
    const links = Array.from(document.querySelectorAll(".nav-item[href^='#']"));
    links.forEach((link) => link.addEventListener("click", () => {
      links.forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    }));
  }

  function isEmbedded() {
    try { return window.self !== window.top; } catch (_) { return true; }
  }

  function loadGristApi() {
    const script = document.createElement("script");
    script.src = "https://docs.getgrist.com/grist-plugin-api.js";
    script.async = true;
    script.onload = initGrist;
    script.onerror = () => connectionError("Grist Plugin API tidak dapat dimuatkan.");
    document.head.appendChild(script);
  }

  function initGrist() {
    if (!window.grist) return connectionError("Objek Grist tidak tersedia.");
    try {
      if (window.grist.onOptions) {
        window.grist.onOptions((options, interaction) => {
          state.gristOptionsLoaded = true;
          state.gristAccessLevel = interaction?.accessLevel || interaction?.access_level || "";
          const saved = readNotesFromOptions(options);
          if (saved !== null) {
            loadCalendarNotes(saved);
            writeNotesBackup(saved);
            setNoteStorageState("grist");
          } else if (!state.calendarNotes.length) {
            const backup = readNotesBackup();
            loadCalendarNotes(backup);
            setNoteStorageState(backup.length ? "backup" : "grist");
          }
        });
      }
      window.grist.ready({
        requiredAccess: "read table",
        allowSelectBy: true,
        columns: COLUMN_DEFS,
        onEditOptions: () => showToast("Nota kalendar diurus terus melalui bahagian Kalendar OSC dalam dashboard.")
      });
      window.grist.onRecords((records, mappings) => {
        state.mappings = mappings || {};
        const normalized = (records || []).map((raw) => {
          let mapped = {};
          try { mapped = window.grist.mapColumnNames(raw) || {}; } catch (_) { mapped = {}; }
          return normalizeRecord({ ...autoMapRecord(raw), ...mapped, id: raw.id });
        });
        updateMappingBanner(state.mappings);
        setData(normalized, "grist");
      });
    } catch (error) {
      connectionError(error?.message || "Ralat memulakan widget Grist.");
    }
  }

  function autoMapRecord(raw) {
    const out = {};
    const items = Object.entries(raw || {}).map(([key, value]) => [normalizeKey(key), value]);
    COLUMN_DEFS.forEach((def) => {
      const keys = new Set([normalizeKey(def.name), normalizeKey(def.title), ...(ALIASES[def.name] || [])]);
      const match = items.find(([key]) => keys.has(key));
      if (match) out[def.name] = match[1];
    });
    return out;
  }

  function updateMappingBanner(mappings) {
    const missing = COLUMN_DEFS.filter((def) => !mappings || mappings[def.name] == null || mappings[def.name] === "");
    if (!missing.length) { dom.mappingBanner.hidden = true; return; }
    const first = missing.slice(0, 7).map((item) => item.title).join(", ");
    const more = missing.length > 7 ? ` dan ${missing.length - 7} lagi` : "";
    dom.mappingMessage.textContent = `Padankan kolum berikut dalam Widget options: ${first}${more}.`;
    dom.mappingBanner.hidden = false;
  }

  function connectionError(message) {
    dom.mappingMessage.textContent = message;
    dom.mappingBanner.hidden = false;
    setData([], "error");
  }

  function startStandalone() {
    loadCalendarNotes(readNotesBackup());
    setNoteStorageState("local");
    const source = Array.isArray(window.PKM_SPS_SEED_DATA) && window.PKM_SPS_SEED_DATA.length
      ? window.PKM_SPS_SEED_DATA : buildDemoRows();
    const normalized = source.map((raw, index) => normalizeRecord({ ...autoMapRecord(raw), id: raw.id ?? index + 1 }));
    setData(normalized, window.PKM_SPS_SEED_DATA?.length ? "csv" : "demo");
  }

  function setData(rows, mode) {
    state.mode = mode;
    state.all = Array.isArray(rows) ? rows : [];
    state.page = 1;
    state.selectedRowId = null;
    if (!state.calendarDate) {
      const now = new Date();
      state.calendarDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    setModeStatus();
    populateFilterOptions();
    applyFilters(false);
    dom.app.setAttribute("aria-busy", "false");
    dom.loadingOverlay.classList.add("hidden");
  }

  function setModeStatus() {
    dom.modeDot.className = "status-dot";
    if (state.mode === "grist") {
      dom.modeDot.classList.add("live"); dom.modeLabel.textContent = "Data langsung Grist";
      dom.syncToggle.disabled = false;
    } else if (state.mode === "csv") {
      dom.modeDot.classList.add("csv"); dom.modeLabel.textContent = `Pratonton CSV • ${formatNumber(state.all.length)} rekod`;
      dom.syncToggle.checked = false; dom.syncToggle.disabled = true;
    } else if (state.mode === "demo") {
      dom.modeLabel.textContent = "Mod demonstrasi"; dom.syncToggle.checked = false; dom.syncToggle.disabled = true;
    } else {
      dom.modeLabel.textContent = "Sambungan data gagal"; dom.syncToggle.checked = false; dom.syncToggle.disabled = true;
    }
  }

  function normalizeRecord(raw) {
    const oscTerimaDate = parseDate(raw.OscTerima);
    const bentangOscDate = parseDate(raw.BentangOSC);
    const tarikhOscDate = parseDate(raw.TarikhOSC);
    const tarikhC1Date = parseDate(raw.TarikhC1);
    const primaryDate = oscTerimaDate || tarikhOscDate || tarikhC1Date;
    const pemaju = textValue(raw.Pemaju);
    const perunding = textValue(raw.Perunding);
    const mukim = textValue(raw.Mukim);
    const keputusan = textValue(raw.Keputusan);
    const status = textValue(raw.StatusTunaiSyarat);
    const decisionClass = classifyDecision(keputusan);
    const complianceCategory = classifyCompliance(status);
    const latRaw = toNumber(raw.Latitude);
    const lonRaw = toNumber(raw.Longitude);
    const validCoord = validCoordinates(latRaw, lonRaw);
    const rec = {
      id: raw.id,
      Pemaju: pemaju, PemajuResolved: pemaju || "Tidak Dinyatakan",
      Permohonan: textValue(raw.Permohonan), Pindaan: raw.Pindaan,
      Perunding: perunding, PerundingResolved: perunding || "Tidak Dinyatakan",
      Lot: textValue(raw.Lot), Mukim: mukim, MukimResolved: mukim || "Tidak Dinyatakan",
      NoRujPKM: textValue(raw.NoRujPKM), OscTerima: raw.OscTerima, OscTerimaDate: oscTerimaDate,
      TunaiSyarat: textValue(raw.TunaiSyarat), BentangOSC: raw.BentangOSC, BentangOSCDate: bentangOscDate,
      BilOSC: textValue(raw.BilOSC), TarikhOSC: raw.TarikhOSC, TarikhOSCDate: tarikhOscDate,
      Keputusan: keputusan, KeputusanResolved: keputusan || "Belum Ada Keputusan",
      DecisionClass: decisionClass, DecisionLabel: DECISION_LABELS[decisionClass],
      StatusTunaiSyarat: status, ComplianceCategory: complianceCategory,
      IsNonCompliant: complianceCategory !== "Selesai",
      TarikhC1: raw.TarikhC1, TarikhC1Date: tarikhC1Date,
      Latitude: raw.Latitude, Longitude: raw.Longitude,
      LatNum: validCoord ? latRaw : null, LonNum: validCoord ? lonRaw : null,
      DaysReceivedToC1: validDuration(oscTerimaDate, tarikhC1Date),
      DaysOscToC1: validDuration(tarikhOscDate, tarikhC1Date),
      PrimaryDate: primaryDate, Year: primaryDate ? String(primaryDate.getFullYear()) : "Tanpa Tarikh",
      Month: primaryDate ? String(primaryDate.getMonth() + 1).padStart(2, "0") : "",
      MonthLabel: primaryDate ? MONTHS_FULL[primaryDate.getMonth()] : "Tanpa Tarikh"
    };
    rec.SearchBlob = normalizeSearch([
      rec.Pemaju, rec.Permohonan, formatBooleanLike(rec.Pindaan), rec.Perunding, rec.Lot, rec.Mukim,
      rec.NoRujPKM, textValue(rec.OscTerima), rec.TunaiSyarat, textValue(rec.BentangOSC), rec.BilOSC,
      textValue(rec.TarikhOSC), rec.Keputusan, rec.StatusTunaiSyarat, textValue(rec.TarikhC1)
    ].join(" "));
    return rec;
  }

  function buildDemoRows() {
    const developers = ["Eco Horizon Sdn Bhd", "Asas Dunia Bhd", "PDC", "Sierra Residences Sdn Bhd", "Mutiara SPS Sdn Bhd"];
    const rows = [];
    for (let i = 0; i < 84; i += 1) {
      const osc = new Date(2022 + Math.floor(i / 20), i % 12, 4 + (i * 5) % 22);
      const received = i > 50 ? new Date(osc.getFullYear(), osc.getMonth(), Math.max(1, osc.getDate() - 22)) : null;
      const c1 = i % 6 ? new Date(osc.getFullYear(), osc.getMonth(), osc.getDate() + 18 + (i * 11) % 135) : null;
      const decision = ["Lulus", "Lulus", "Lulus", "Tolak", "Tarik Balik", ""][i % 6];
      rows.push({
        id: i + 1, Pemaju: developers[i % developers.length],
        Permohonan: `Cadangan pembangunan di atas Lot ${1100 + i}, Mukim ${(i % 15) + 1}, Seberang Perai Selatan.`,
        Pindaan: i % 4 === 0, Perunding: i % 5 ? "Lain-Lain" : "Shaari Planners Sdn Bhd",
        Lot: String(1100 + i), Mukim: String((i % 15) + 1), NoRujPKM: `MBSP/70/39-${i + 1}`,
        OscTerima: received ? isoDate(received) : "", TunaiSyarat: "",
        BentangOSC: isoDate(osc), BilOSC: `OSC Bil.${(i % 24) + 1}/${osc.getFullYear()}`,
        TarikhOSC: isoDate(osc), Keputusan: decision,
        StatusTunaiSyarat: ["Selesai", "Pending", "Permatuhan Tunai Syarat [KEJ]", "C1 akan dikeluarkan"][i % 4],
        TarikhC1: c1 ? isoDate(c1) : "", Latitude: i % 8 ? 5.12 + i / 1000 : 0, Longitude: i % 8 ? 100.39 + i / 1200 : 0
      });
    }
    return rows;
  }

  function populateFilterOptions() {
    fillSelect(dom.yearFilter, uniqueSorted(state.all.map((r) => r.Year), true), "Semua tahun");
    fillSelect(dom.monthFilter, MONTHS_FULL.map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label })), "Semua bulan");
    fillSelect(dom.mukimFilter, uniqueSorted(state.all.map((r) => r.MukimResolved)), "Semua mukim");
    fillSelect(dom.decisionFilter, uniqueSorted(state.all.map((r) => r.DecisionLabel)), "Semua keputusan");
    fillSelect(dom.developerFilter, uniqueSorted(state.all.map((r) => r.PemajuResolved)), "Semua pemaju");
    fillSelect(dom.consultantFilter, uniqueSorted(state.all.map((r) => r.PerundingResolved)), "Semua perunding");
  }

  function fillSelect(select, values, firstLabel) {
    const old = select.value;
    const normalized = values.map((item) => typeof item === "object" ? item : ({ value: item, label: item }));
    select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` + normalized.map((item) => `<option value="${escapeAttr(item.value)}">${escapeHtml(item.label)}</option>`).join("");
    if (normalized.some((item) => String(item.value) === String(old))) select.value = old;
  }

  function uniqueSorted(values, descending = false) {
    const items = Array.from(new Set(values.filter((v) => v != null && v !== "")));
    return items.sort((a, b) => descending ? String(b).localeCompare(String(a), "ms", { numeric: true }) : String(a).localeCompare(String(b), "ms", { numeric: true }));
  }

  function applyFilters(resetPage = true) {
    if (resetPage) state.page = 1;
    const query = normalizeSearch(dom.searchInput.value);
    state.filters = {
      year: dom.yearFilter.value, month: dom.monthFilter.value, mukim: dom.mukimFilter.value, decision: dom.decisionFilter.value,
      developer: dom.developerFilter.value, consultant: dom.consultantFilter.value, compliance: dom.complianceFilter.value
    };
    state.filtered = state.all.filter((r) => {
      if (query && !r.SearchBlob.includes(query)) return false;
      if (state.filters.year && r.Year !== state.filters.year) return false;
      if (state.filters.month && r.Month !== state.filters.month) return false;
      if (state.filters.mukim && r.MukimResolved !== state.filters.mukim) return false;
      if (state.filters.decision && r.DecisionLabel !== state.filters.decision) return false;
      if (state.filters.developer && r.PemajuResolved !== state.filters.developer) return false;
      if (state.filters.consultant && r.PerundingResolved !== state.filters.consultant) return false;
      if (state.filters.compliance && r.ComplianceCategory !== state.filters.compliance) return false;
      return true;
    });
    const maxPage = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    state.page = Math.min(state.page, maxPage);
    if (!state.calendarDate) {
      const now = new Date();
      state.calendarDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    renderAll();
    scheduleSync(false);
  }

  function resetFilters() {
    dom.searchInput.value = "";
    [dom.yearFilter, dom.monthFilter, dom.mukimFilter, dom.decisionFilter, dom.developerFilter, dom.consultantFilter, dom.complianceFilter]
      .forEach((el) => { el.value = ""; });
    applyFilters(true);
  }

  function renderAll() {
    renderSummary(); renderKpis(); renderInsights(); renderDecisionChart(); renderComplianceChart();
    renderTrendChart(); renderComplianceYearChart(); renderMukimChart(); renderDeveloperChart();
    renderDurationCharts(); renderCalendar(); renderTable(); renderQuality();
  }

  function renderSummary() {
    dom.recordSummary.textContent = `${formatNumber(state.filtered.length)} daripada ${formatNumber(state.all.length)} rekod`;
    dom.heroTotal.textContent = formatNumber(state.filtered.length);
    const selectedMonthName = state.filters.month ? MONTHS_FULL[Number(state.filters.month) - 1] : "";
    dom.heroPeriod.textContent = state.filters.year && selectedMonthName
      ? `${selectedMonthName} ${state.filters.year}`
      : state.filters.year
        ? `Tahun ${state.filters.year}`
        : selectedMonthName
          ? `Bulan ${selectedMonthName} · semua tahun`
          : "Semua tahun dan bulan";
    dom.updatedAt.textContent = `Dikemas kini: ${new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  }

  function renderKpis() {
    const rows = state.filtered;
    const total = rows.length;
    const approved = rows.filter((r) => r.DecisionClass === "approved").length;
    const rejected = rows.filter((r) => r.DecisionClass === "rejected").length;
    const withdrawn = rows.filter((r) => r.DecisionClass === "withdrawn").length;
    const pending = rows.filter((r) => r.DecisionClass === "pending").length;
    const nonCompliant = rows.filter((r) => r.IsNonCompliant).length;
    const c1 = rows.filter((r) => r.TarikhC1Date).length;
    setText(dom.kpiTotal, total); dom.kpiTotalNote.textContent = total === state.all.length ? "Keseluruhan rekod" : `${formatNumber(state.all.length - total)} rekod ditapis keluar`;
    setText(dom.kpiApproved, approved); dom.kpiApprovedNote.textContent = `${formatPercent(approved, total)} daripada rekod`;
    setText(dom.kpiRejected, rejected); dom.kpiRejectedNote.textContent = `${formatPercent(rejected, total)} daripada rekod`;
    setText(dom.kpiWithdrawn, withdrawn); dom.kpiWithdrawnNote.textContent = `${formatPercent(withdrawn, total)} daripada rekod`;
    setText(dom.kpiPending, pending); dom.kpiPendingNote.textContent = `${formatPercent(pending, total)} belum ada keputusan`;
    setText(dom.kpiNonCompliant, nonCompliant); dom.kpiNonCompliantNote.textContent = `${formatPercent(nonCompliant, total)} selain “Selesai”`;
    setText(dom.kpiC1, c1); dom.kpiC1Note.textContent = `${formatPercent(c1, total)} mempunyai tarikh C1`;
  }

  function renderInsights() {
    const rows = state.filtered;
    const topMukim = topEntry(countBy(rows, (r) => r.MukimResolved));
    const topDeveloper = topEntry(countBy(rows, (r) => r.PemajuResolved));
    const peakMonth = topEntry(countBy(rows.filter((r) => r.PrimaryDate), (r) => monthKey(r.PrimaryDate)));
    const received = rows.map((r) => r.DaysReceivedToC1).filter(Number.isFinite);
    const osc = rows.map((r) => r.DaysOscToC1).filter(Number.isFinite);
    const cards = [
      [topMukim ? `Mukim ${topMukim[0]}` : "–", topMukim ? `${formatNumber(topMukim[1])} permohonan tertinggi` : "Tiada data mukim"],
      [topDeveloper?.[0] || "–", topDeveloper ? `${formatNumber(topDeveloper[1])} permohonan oleh pemaju tertinggi` : "Tiada data pemaju"],
      [peakMonth ? formatMonthKey(peakMonth[0]) : "–", peakMonth ? `${formatNumber(peakMonth[1])} permohonan pada bulan puncak` : "Tiada tarikh analisis"],
      [received.length ? `${formatNumber(Math.round(median(received)))} hari` : "–", `Median OSC Terima–C1 · ${formatNumber(received.length)} rekod`],
      [osc.length ? `${formatNumber(Math.round(median(osc)))} hari` : "–", `Median Tarikh OSC–C1 · ${formatNumber(osc.length)} rekod`]
    ];
    dom.insightCards.innerHTML = cards.map(([value, note]) => `<div class="insight-card"><strong title="${escapeAttr(value)}">${escapeHtml(value)}</strong><span>${escapeHtml(note)}</span></div>`).join("");
  }

  function renderDecisionChart() {
    const entries = Object.keys(DECISION_LABELS).map((key) => ({ key, label: DECISION_LABELS[key], value: state.filtered.filter((r) => r.DecisionClass === key).length })).filter((item) => item.value);
    dom.decisionMeta.textContent = `${formatNumber(state.filtered.length)} rekod`;
    renderDonut(dom.decisionChart, entries, (item) => setSelectFilter(dom.decisionFilter, item.label), DECISION_COLORS, "key");
  }

  function renderComplianceChart() {
    const entries = COMPLIANCE_ORDER.map((label) => ({ label, value: state.filtered.filter((r) => r.ComplianceCategory === label).length })).filter((item) => item.value);
    const done = state.filtered.filter((r) => r.ComplianceCategory === "Selesai").length;
    dom.complianceMeta.textContent = `${formatNumber(done)} selesai`;
    renderDonut(dom.complianceChart, entries, (item) => setSelectFilter(dom.complianceFilter, item.label), COMPLIANCE_COLORS, "label");
  }

  function renderDonut(container, entries, onClick, colors, colorKey) {
    if (!entries.length) return setEmpty(container, "Tiada data untuk paparan ini.");
    const total = entries.reduce((sum, item) => sum + item.value, 0);
    const cx = 110, cy = 110, outer = 85, inner = 54;
    let angle = -Math.PI / 2;
    const paths = entries.map((item) => {
      const next = angle + item.value / total * Math.PI * 2;
      const d = donutPath(cx, cy, outer, inner, angle, next);
      angle = next;
      return `<path d="${d}" fill="${colors[item[colorKey]]}" stroke="#fff" stroke-width="3"><title>${escapeXml(`${item.label}: ${item.value}`)}</title></path>`;
    }).join("");
    const svg = `<svg class="donut-svg" viewBox="0 0 220 220" aria-hidden="true">${paths}<circle cx="110" cy="110" r="44" fill="#fff"/><text x="110" y="106" text-anchor="middle" fill="#2C3240" font-size="30" font-weight="780">${formatNumber(total)}</text><text x="110" y="127" text-anchor="middle" fill="#6E7A94" font-size="10">REKOD</text></svg>`;
    const legend = entries.map((item, i) => `<button class="legend-item" type="button" data-index="${i}"><span class="legend-dot" style="background:${colors[item[colorKey]]}"></span><span class="legend-label">${escapeHtml(item.label)}</span><span class="legend-value">${formatNumber(item.value)} · ${formatPercent(item.value, total)}</span></button>`).join("");
    container.innerHTML = `${svg}<div class="legend">${legend}</div>`;
    container.querySelectorAll("[data-index]").forEach((button) => button.addEventListener("click", () => onClick(entries[Number(button.dataset.index)])));
  }

  function renderTrendChart() {
    const dated = state.filtered.filter((r) => r.PrimaryDate);
    if (!dated.length) {
      dom.trendMeta.textContent = "Tiada tarikh";
      return setEmpty(dom.trendChart, "Tiada tarikh yang sah untuk analisis trend.");
    }
    const latest = new Date(Math.max(...dated.map((r) => r.PrimaryDate.getTime())));
    const months = [];
    for (let i = 5; i >= 0; i -= 1) months.push(new Date(latest.getFullYear(), latest.getMonth() - i, 1));
    const values = months.map((month) => dated.filter((r) => sameMonth(r.PrimaryDate, month)).length);
    dom.trendMeta.textContent = `${formatMonth(months[0])} – ${formatMonth(months[5])}`;
    const w = 660, h = 270, m = { l: 40, r: 18, t: 22, b: 42 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const max = Math.max(...values, 1);
    const x = (i) => m.l + i * (pw / Math.max(1, months.length - 1));
    const y = (v) => m.t + ph - (v / max) * ph;
    let grid = "";
    for (let i = 0; i <= 4; i += 1) {
      const yy = m.t + i * ph / 4;
      const value = Math.round(max * (1 - i / 4));
      grid += `<line x1="${m.l}" y1="${yy}" x2="${w - m.r}" y2="${yy}" stroke="#D7DBE3"/><text x="${m.l - 9}" y="${yy + 4}" text-anchor="end" fill="#6E7A94" font-size="10">${value}</text>`;
    }
    const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    const area = `${m.l},${m.t + ph} ${points} ${x(values.length - 1)},${m.t + ph}`;
    const labels = months.map((month, i) => `<text x="${x(i)}" y="${h - 14}" text-anchor="middle" fill="#6E7A94" font-size="10">${MONTHS_SHORT[month.getMonth()]}</text>`).join("");
    const dots = values.map((v, i) => `<g class="trend-point"><circle cx="${x(i)}" cy="${y(v)}" r="5" fill="#fff" stroke="#2C3240" stroke-width="3"/><text x="${x(i)}" y="${y(v) - 12}" text-anchor="middle" fill="#2C3240" font-size="10" font-weight="750">${v}</text></g>`).join("");
    dom.trendChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#AEB6C8" stop-opacity=".28"/><stop offset="100%" stop-color="#AEB6C8" stop-opacity=".02"/></linearGradient></defs>${grid}<polygon points="${area}" fill="url(#trendFill)"/><polyline points="${points}" fill="none" stroke="#2C3240" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`;
  }

  function renderComplianceYearChart() {
    const years = uniqueSorted(state.filtered.map((r) => r.Year).filter((y) => /^\d{4}$/.test(y)));
    if (!years.length) {
      dom.complianceYearMeta.textContent = "Tiada tahun";
      return setEmpty(dom.complianceYearChart, "Tiada tarikh yang sah untuk analisis mengikut tahun.");
    }
    dom.complianceYearMeta.textContent = `${years[0]} – ${years[years.length - 1]}`;
    const data = years.map((year) => {
      const rows = state.filtered.filter((r) => r.Year === year);
      return { year, total: rows.length, values: Object.fromEntries(COMPLIANCE_ORDER.map((cat) => [cat, rows.filter((r) => r.ComplianceCategory === cat).length])) };
    });
    const w = 850, h = 300, m = { l: 45, r: 18, t: 28, b: 60 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const max = Math.max(...data.map((d) => d.total), 1);
    const step = pw / data.length;
    const barW = Math.min(72, step * 0.58);
    let grid = "";
    for (let i = 0; i <= 4; i += 1) {
      const yy = m.t + ph * i / 4;
      const val = Math.round(max * (1 - i / 4));
      grid += `<line x1="${m.l}" y1="${yy}" x2="${w - m.r}" y2="${yy}" stroke="#D7DBE3"/><text x="${m.l - 8}" y="${yy + 4}" text-anchor="end" fill="#6E7A94" font-size="10">${val}</text>`;
    }
    const bars = data.map((d, index) => {
      const x = m.l + step * index + (step - barW) / 2;
      let currentY = m.t + ph;
      const segments = COMPLIANCE_ORDER.map((cat) => {
        const value = d.values[cat];
        if (!value) return "";
        const height = value / max * ph;
        currentY -= height;
        return `<rect x="${x}" y="${currentY}" width="${barW}" height="${height}" rx="${Math.min(7, height / 2)}" fill="${COMPLIANCE_COLORS[cat]}"><title>${escapeXml(`${d.year} · ${cat}: ${value}`)}</title></rect>`;
      }).join("");
      return `<g class="stack-year" data-year="${d.year}">${segments}<text x="${x + barW / 2}" y="${m.t + ph + 22}" text-anchor="middle" fill="#6E7A94" font-size="10" font-weight="650">${d.year}</text><text x="${x + barW / 2}" y="${Math.max(m.t + 11, currentY - 8)}" text-anchor="middle" fill="#2C3240" font-size="10" font-weight="760">${d.total}</text></g>`;
    }).join("");
    const legend = COMPLIANCE_ORDER.map((cat) => `<span class="stack-legend-item"><i style="background:${COMPLIANCE_COLORS[cat]}"></i>${escapeHtml(cat)}</span>`).join("");
    dom.complianceYearChart.innerHTML = `<div class="stack-chart-wrap"><svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${grid}${bars}</svg><div class="stack-legend">${legend}</div></div>`;
    dom.complianceYearChart.querySelectorAll("[data-year]").forEach((item) => {
      item.style.cursor = "pointer";
      item.addEventListener("click", () => setSelectFilter(dom.yearFilter, item.dataset.year));
    });
  }

  function renderMukimChart() {
    const entries = Array.from(countBy(state.filtered, (r) => r.MukimResolved).entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarList(dom.mukimChart, entries, (value) => setSelectFilter(dom.mukimFilter, value));
  }

  function renderDeveloperChart() {
    const entries = Array.from(countBy(state.filtered, (r) => r.PemajuResolved).entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarList(dom.developerChart, entries, (value) => setSelectFilter(dom.developerFilter, value));
  }

  function renderDurationCharts() {
    renderDurationDistribution(state.filtered.map((r) => r.DaysReceivedToC1).filter(Number.isFinite), dom.durationReceivedChart, dom.durationReceivedMeta, "Pengiraan memerlukan OSC TERIMA dan TARIKH C1 yang sah.");
    renderDurationDistribution(state.filtered.map((r) => r.DaysOscToC1).filter(Number.isFinite), dom.durationOscChart, dom.durationOscMeta, "Pengiraan memerlukan TARIKH OSC dan TARIKH C1 yang sah.");
  }

  function renderDurationDistribution(values, container, meta, empty) {
    if (!values.length) { meta.textContent = "Tiada rekod lengkap"; return setEmpty(container, empty); }
    const bins = [
      ["0–30 hari", 0, 30], ["31–60 hari", 31, 60], ["61–90 hari", 61, 90],
      ["91–180 hari", 91, 180], [">180 hari", 181, Infinity]
    ].map(([label, min, max]) => [label, values.filter((v) => v >= min && v <= max).length]);
    meta.textContent = `${formatNumber(values.length)} rekod • median ${formatNumber(Math.round(median(values)))} hari`;
    renderBarList(container, bins, null, ["#2C3240", "#6E7A94", "#AEB6C8", "#D7DBE3", "#F3F4F7"]);
  }

  function renderBarList(container, entries, onClick, colors = null) {
    if (!entries.length || entries.every((item) => item[1] === 0)) return setEmpty(container, "Tiada data untuk analisis ini.");
    const max = Math.max(...entries.map((item) => item[1]), 1);
    container.innerHTML = entries.map(([label, value], index) => `<div class="bar-row"><button class="bar-label" type="button" ${onClick ? `data-index="${index}" data-filter="1"` : "disabled"} title="${escapeAttr(label)}">${escapeHtml(label)}</button><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, value / max * 100)}%;${colors ? `background:${colors[index % colors.length]}` : ""}"></div></div><span class="bar-value">${formatNumber(value)}</span></div>`).join("");
    if (onClick) container.querySelectorAll("[data-index]").forEach((button) => button.addEventListener("click", () => onClick(entries[Number(button.dataset.index)][0])));
  }

  function latestCalendarMonth(rows) {
    const dates = rows.map((r) => r.BentangOSCDate).filter(Boolean);
    if (!dates.length) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    return new Date(latest.getFullYear(), latest.getMonth(), 1);
  }

  function moveCalendar(offset) {
    const current = state.calendarDate || latestCalendarMonth(state.filtered);
    state.calendarDate = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    renderCalendar();
  }

  function renderCalendar() {
    const month = state.calendarDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    state.calendarDate = month;
    dom.calendarMonthLabel.textContent = `${MONTHS_FULL[month.getMonth()]} ${month.getFullYear()}`;
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
    const events = new Map();
    state.filtered.filter((r) => r.BentangOSCDate).forEach((record) => {
      const key = dateKey(record.BentangOSCDate);
      if (!events.has(key)) events.set(key, []);
      events.get(key).push(record);
    });
    const notesByDate = new Map();
    state.calendarNotes.forEach((note) => {
      if (!notesByDate.has(note.date)) notesByDate.set(note.date, []);
      notesByDate.get(note.date).push(note);
    });
    notesByDate.forEach((notes) => notes.sort(compareCalendarNotes));
    const headers = WEEKDAYS.map((day) => `<div class="calendar-weekday">${day}</div>`).join("");
    const days = Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = dateKey(date);
      const inMonth = date.getMonth() === month.getMonth();
      const today = sameDay(date, new Date());
      const records = events.get(key) || [];
      const notes = notesByDate.get(key) || [];
      const manualShown = notes.slice(0, 2).map((note) => `<button type="button" class="calendar-note-event note-${noteStatusClass(note.status)}" data-note-id="${escapeAttr(note.id)}" title="${escapeAttr(noteTitleLine(note))}"><span>${escapeHtml(note.time || "Nota")}</span>${escapeHtml(note.title)}</button>`).join("");
      const remainingSlots = Math.max(0, 3 - Math.min(notes.length, 2));
      const decisionPriority = ["rejected", "withdrawn", "pending", "other", "approved"];
      const primaryDecision = decisionPriority.find((decision) => records.some((record) => record.DecisionClass === decision)) || "";
      const dataShown = records.slice(0, remainingSlots).map((record, index) => {
        const decisionClass = ` is-decision-${record.DecisionClass}`;
        const title = `${record.PemajuResolved} · ${record.DecisionLabel}`;
        return `<button type="button" class="calendar-event${decisionClass}" data-date="${key}" data-event-index="${index}" title="${escapeAttr(title)}">${escapeHtml(record.PemajuResolved)}</button>`;
      }).join("");
      const total = records.length + notes.length;
      const shownCount = Math.min(notes.length, 2) + Math.min(records.length, remainingSlots);
      const more = total > shownCount ? `<span class="calendar-more">+${total - shownCount} lagi</span>` : "";
      const dayDecisionClass = primaryDecision ? ` has-decision-${primaryDecision}` : "";
      return `<div class="calendar-day${inMonth ? "" : " is-outside"}${today ? " is-today" : ""}${dayDecisionClass}" data-calendar-date="${key}" tabindex="0" role="button" aria-label="Tambah nota pada ${formatDate(date)}"><div class="calendar-date"><span>${date.getDate()}</span>${total ? `<b>${total}</b>` : ""}</div><div class="calendar-events">${manualShown}${dataShown}${more}</div></div>`;
    }).join("");
    dom.calendarGrid.innerHTML = headers + days;
    dom.calendarGrid.querySelectorAll("[data-event-index]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const records = events.get(button.dataset.date) || [];
        focusRecord(records[Number(button.dataset.eventIndex)]);
      });
    });
    dom.calendarGrid.querySelectorAll("[data-note-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openNoteModal(null, button.dataset.noteId);
      });
    });
    dom.calendarGrid.querySelectorAll("[data-calendar-date]").forEach((cell) => {
      const open = () => openNoteModal(cell.dataset.calendarDate);
      cell.addEventListener("click", open);
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
    });
    renderUpcomingNotes();
  }

  function readNotesFromOptions(options) {
    if (!options || typeof options !== "object") return null;
    if (Object.prototype.hasOwnProperty.call(options, CALENDAR_NOTES_OPTION_KEY)) {
      return Array.isArray(options[CALENDAR_NOTES_OPTION_KEY]) ? options[CALENDAR_NOTES_OPTION_KEY] : [];
    }
    if (Object.prototype.hasOwnProperty.call(options, CALENDAR_NOTES_LEGACY_KEY)) {
      return Array.isArray(options[CALENDAR_NOTES_LEGACY_KEY]) ? options[CALENDAR_NOTES_LEGACY_KEY] : [];
    }
    return null;
  }

  function readNotesBackup() {
    try {
      const raw = localStorage.getItem(CALENDAR_NOTES_BACKUP_KEY) || localStorage.getItem("pkmSpsCalendarNotesV1") || "[]";
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeNotesBackup(notes) {
    try { localStorage.setItem(CALENDAR_NOTES_BACKUP_KEY, JSON.stringify(notes)); } catch (_) {}
  }

  function loadCalendarNotes(rawNotes) {
    const source = Array.isArray(rawNotes) ? rawNotes : [];
    state.calendarNotes = source.map(sanitizeCalendarNote).filter((note) => note.date && note.title);
    if (dom.calendarGrid) renderCalendar();
  }

  function setNoteStorageState(storageState, errorMessage = "") {
    state.noteStorageState = storageState;
    state.noteStorageError = errorMessage || "";
    const el = document.getElementById("noteStorageStatus");
    if (!el) return;
    if (storageState === "grist") {
      el.textContent = "Nota disimpan dalam Grist";
      el.className = "note-storage-status is-saved";
    } else if (storageState === "saving") {
      el.textContent = "Menyimpan nota...";
      el.className = "note-storage-status is-saving";
    } else if (storageState === "backup") {
      el.textContent = "Nota dipulihkan daripada salinan pelayar";
      el.className = "note-storage-status is-warning";
    } else if (storageState === "error") {
      const detail = state.noteStorageError ? `: ${state.noteStorageError}` : "";
      el.textContent = `Nota belum disahkan tersimpan${detail}`;
      el.title = state.noteStorageError || "";
      el.className = "note-storage-status is-error";
    } else {
      el.textContent = "Nota disimpan pada pelayar ini";
      el.className = "note-storage-status";
    }
  }

  function sanitizeCalendarNote(note) {
    const statusAllowed = ["Akan Datang", "Selesai", "Ditangguh", "Dibatalkan"];
    return {
      id: textValue(note?.id) || makeNoteId(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(textValue(note?.date)) ? textValue(note.date) : "",
      time: /^\d{2}:\d{2}$/.test(textValue(note?.time)) ? textValue(note.time) : "",
      title: textValue(note?.title).slice(0, 100),
      text: textValue(note?.text).slice(0, 500),
      status: statusAllowed.includes(note?.status) ? note.status : "Akan Datang",
      createdAt: textValue(note?.createdAt),
      updatedAt: textValue(note?.updatedAt)
    };
  }

  function openNoteModal(dateValue, noteId = null) {
    const existing = noteId ? state.calendarNotes.find((note) => note.id === noteId) : null;
    state.selectedCalendarNoteId = existing?.id || null;
    state.selectedCalendarDateKey = existing?.date || dateValue || dateKey(new Date());
    dom.noteModalTitle.textContent = existing ? "Edit Nota Kalendar" : "Tambah Nota Kalendar";
    dom.noteDate.value = state.selectedCalendarDateKey;
    dom.noteTime.value = existing?.time || "";
    dom.noteTitle.value = existing?.title || "Mesyuarat OSC";
    dom.noteText.value = existing?.text || "";
    dom.noteStatus.value = existing?.status || "Akan Datang";
    dom.noteDeleteBtn.hidden = !existing;
    dom.noteModal.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(() => dom.noteTitle.focus(), 30);
  }

  function closeNoteModal() {
    dom.noteModal.hidden = true;
    document.body.classList.remove("modal-open");
    state.selectedCalendarNoteId = null;
    state.selectedCalendarDateKey = null;
  }

  async function saveCalendarNote(event) {
    event.preventDefault();
    const date = dom.noteDate.value;
    const title = dom.noteTitle.value.trim();
    if (!date || !title) return showToast("Tarikh dan tajuk perlu diisi.");
    const now = new Date().toISOString();
    const existingIndex = state.calendarNotes.findIndex((note) => note.id === state.selectedCalendarNoteId);
    const note = sanitizeCalendarNote({
      id: existingIndex >= 0 ? state.calendarNotes[existingIndex].id : makeNoteId(),
      date,
      time: dom.noteTime.value,
      title,
      text: dom.noteText.value.trim(),
      status: dom.noteStatus.value,
      createdAt: existingIndex >= 0 ? state.calendarNotes[existingIndex].createdAt : now,
      updatedAt: now
    });
    const next = [...state.calendarNotes];
    if (existingIndex >= 0) next[existingIndex] = note;
    else next.push(note);
    next.sort(compareCalendarNotes);
    const saved = await persistCalendarNotes(next);
    if (!saved) return;
    state.calendarDate = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1);
    closeNoteModal();
    renderCalendar();
    showToast(existingIndex >= 0 ? "Nota kalendar telah dikemas kini." : "Nota kalendar telah disimpan.");
  }

  async function deleteCalendarNote() {
    const note = state.calendarNotes.find((item) => item.id === state.selectedCalendarNoteId);
    if (!note) return;
    if (!window.confirm(`Padam nota “${note.title}” pada ${note.date}?`)) return;
    const next = state.calendarNotes.filter((item) => item.id !== note.id);
    const saved = await persistCalendarNotes(next);
    if (!saved) return;
    closeNoteModal();
    renderCalendar();
    showToast("Nota kalendar telah dipadam.");
  }

  async function persistCalendarNotes(notes) {
    state.calendarNotes = notes;
    writeNotesBackup(notes);
    setNoteStorageState("saving");
    renderCalendar();

    if (state.mode !== "grist") {
      setNoteStorageState("local");
      return true;
    }

    try {
      const widgetApi = window.grist?.widgetApi || window.grist;
      if (!widgetApi?.setOption || !widgetApi?.getOption) {
        throw new Error("API grist.widgetApi.setOption/getOption tidak tersedia");
      }

      // Simpan satu nilai sahaja supaya tetapan widget lain tidak diganti.
      await widgetApi.setOption(CALENDAR_NOTES_OPTION_KEY, notes);

      // Sesetengah pelayan Grist mengambil sedikit masa sebelum nilai boleh dibaca semula.
      let verifiedNotes = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (attempt > 0) await delay(300 * attempt);
        const value = await widgetApi.getOption(CALENDAR_NOTES_OPTION_KEY);
        if (Array.isArray(value)) {
          verifiedNotes = value;
          const expected = JSON.stringify(notes.map(sanitizeCalendarNote));
          const actual = JSON.stringify(value.map(sanitizeCalendarNote));
          if (expected === actual) break;
        }
      }

      const expected = JSON.stringify(notes.map(sanitizeCalendarNote));
      const actual = JSON.stringify((verifiedNotes || []).map(sanitizeCalendarNote));
      if (expected !== actual) {
        throw new Error("Grist memulangkan nilai kosong atau nilai lama selepas simpanan");
      }

      loadCalendarNotes(verifiedNotes);
      setNoteStorageState("grist");
      return true;
    } catch (error) {
      const message = textValue(error?.message || error || "Ralat tidak diketahui").slice(0, 180);
      setNoteStorageState("error", message);
      showToast(`Nota belum dapat disimpan dalam Grist: ${message}`);
      console.error("Calendar note persistence failed:", error);
      return false;
    }
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function renderUpcomingNotes() {
    const today = dateKey(new Date());
    const upcoming = state.calendarNotes
      .filter((note) => note.date >= today && note.status !== "Selesai" && note.status !== "Dibatalkan")
      .sort(compareCalendarNotes)
      .slice(0, 8);
    dom.calendarNoteCount.textContent = `${formatNumber(state.calendarNotes.length)} nota`;
    if (!upcoming.length) {
      dom.calendarNotesList.innerHTML = `<div class="empty-state compact-empty">Belum ada nota atau tarikh mesyuarat akan datang.</div>`;
      return;
    }
    dom.calendarNotesList.innerHTML = upcoming.map((note) => `<button type="button" class="upcoming-note-card note-${noteStatusClass(note.status)}" data-upcoming-note="${escapeAttr(note.id)}"><span class="upcoming-note-date">${escapeHtml(formatNoteDate(note.date))}</span><strong>${escapeHtml(note.title)}</strong><small>${escapeHtml([note.time, note.status].filter(Boolean).join(" · "))}</small>${note.text ? `<p>${escapeHtml(note.text)}</p>` : ""}</button>`).join("");
    dom.calendarNotesList.querySelectorAll("[data-upcoming-note]").forEach((button) => button.addEventListener("click", () => openNoteModal(null, button.dataset.upcomingNote)));
  }

  function compareCalendarNotes(a, b) {
    return `${a.date}T${a.time || "23:59"}`.localeCompare(`${b.date}T${b.time || "23:59"}`);
  }

  function noteStatusClass(status) {
    return status === "Selesai" ? "done" : status === "Ditangguh" ? "postponed" : status === "Dibatalkan" ? "cancelled" : "upcoming";
  }

  function noteTitleLine(note) {
    return [note.date, note.time, note.title, note.status, note.text].filter(Boolean).join(" · ");
  }

  function formatNoteDate(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat("ms-MY", { day: "2-digit", month: "short", year: "numeric" }).format(date) : value;
  }

  function makeNoteId() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function renderTable() {
    const rows = sortRecords(state.filtered);
    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);
    if (!pageRows.length) {
      dom.tableBody.innerHTML = `<tr><td colspan="17"><div class="empty-state">Tiada rekod sepadan dengan penapis semasa.</div></td></tr>`;
    } else {
      dom.tableBody.innerHTML = pageRows.map((r, index) => {
        const pindaan = formatBooleanLike(r.Pindaan);
        const complianceClass = r.ComplianceCategory === "Selesai" ? "compliance-done" : r.ComplianceCategory === "Pematuhan Tunai Syarat" ? "compliance-action" : r.ComplianceCategory === "Pending" ? "compliance-pending" : "compliance-other";
        const selected = state.selectedRowId != null && String(state.selectedRowId) === String(r.id) ? " is-selected" : "";
        return `<tr class="${selected}" data-index="${index}" tabindex="0">
          <td><div class="cell-clamp" title="${escapeAttr(r.Pemaju)}">${escapeHtml(r.Pemaju || "–")}</div></td>
          <td><div class="cell-clamp" title="${escapeAttr(r.Permohonan)}">${escapeHtml(r.Permohonan || "–")}</div></td>
          <td><span class="boolean-badge ${pindaan === "Ya" ? "boolean-yes" : "boolean-no"}">${escapeHtml(pindaan)}</span></td>
          <td><div class="cell-clamp" title="${escapeAttr(r.Perunding)}">${escapeHtml(r.Perunding || "–")}</div></td>
          <td>${escapeHtml(r.Lot || "–")}</td><td>${escapeHtml(r.MukimResolved)}</td><td><strong>${escapeHtml(r.NoRujPKM || "–")}</strong></td>
          <td>${formatDate(r.OscTerimaDate)}</td><td><div class="cell-clamp">${escapeHtml(r.TunaiSyarat || "–")}</div></td>
          <td>${formatDate(r.BentangOSCDate) || escapeHtml(textValue(r.BentangOSC) || "–")}</td><td>${escapeHtml(r.BilOSC || "–")}</td><td>${formatDate(r.TarikhOSCDate)}</td>
          <td><span class="status-badge status-${r.DecisionClass}">${escapeHtml(r.KeputusanResolved)}</span></td>
          <td><span class="status-badge ${complianceClass}" title="${escapeAttr(r.StatusTunaiSyarat)}">${escapeHtml(r.StatusTunaiSyarat || "Tiada rekod")}</span></td>
          <td>${formatDate(r.TarikhC1Date)}</td><td class="numeric">${escapeHtml(textValue(r.Latitude) || "–")}</td><td class="numeric">${escapeHtml(textValue(r.Longitude) || "–")}</td>
        </tr>`;
      }).join("");
      dom.tableBody.querySelectorAll("tr[data-index]").forEach((row) => {
        const activate = () => focusRecord(pageRows[Number(row.dataset.index)]);
        row.addEventListener("click", activate);
        row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
      });
    }
    const from = rows.length ? start + 1 : 0;
    const to = Math.min(start + state.pageSize, rows.length);
    dom.pageInfo.textContent = `Rekod ${formatNumber(from)}–${formatNumber(to)} daripada ${formatNumber(rows.length)} • Halaman ${state.page} daripada ${totalPages}`;
    dom.prevPageBtn.disabled = state.page <= 1;
    dom.nextPageBtn.disabled = state.page >= totalPages;
    dom.sortButtons.forEach((button) => {
      const indicator = button.querySelector("span");
      indicator.textContent = button.dataset.sort === state.sortKey ? (state.sortDir === "asc" ? "▲" : "▼") : "";
    });
  }

  function sortRecords(records) {
    const dir = state.sortDir === "asc" ? 1 : -1;
    return records.map((r, i) => ({ r, i })).sort((a, b) => {
      const result = compareValues(a.r[state.sortKey], b.r[state.sortKey]);
      return result === 0 ? a.i - b.i : result * dir;
    }).map((item) => item.r);
  }

  function compareValues(a, b) {
    const aBlank = a == null || a === "";
    const bBlank = b == null || b === "";
    if (aBlank && bBlank) return 0;
    if (aBlank) return 1;
    if (bBlank) return -1;
    if (a instanceof Date || b instanceof Date) return (a instanceof Date ? a.getTime() : 0) - (b instanceof Date ? b.getTime() : 0);
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "ms", { numeric: true, sensitivity: "base" });
  }

  function focusRecord(record) {
    if (!record) return;
    state.selectedRowId = record.id;
    renderTable();
    document.getElementById("rekod")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (state.mode === "grist" && window.grist?.setCursorPos && record.id != null) {
      window.grist.setCursorPos({ rowId: record.id }).catch(() => showToast("Rekod tidak dapat difokuskan dalam Grist."));
    }
  }

  function renderQuality() {
    const rows = state.filtered;
    const refCounts = countBy(rows.filter((r) => r.NoRujPKM), (r) => normalizeSearch(r.NoRujPKM));
    const duplicateUnique = Array.from(refCounts.values()).filter((count) => count > 1).length;
    const metrics = [
      [rows.filter((r) => !r.NoRujPKM).length, "No. Ruj. PKM kosong", "warn"],
      [duplicateUnique, "No. Ruj. PKM berulang", "bad"],
      [rows.filter((r) => !r.OscTerimaDate).length, "OSC TERIMA kosong / tidak sah", "warn"],
      [rows.filter((r) => !r.Keputusan).length, "KEPUTUSAN kosong", "warn"],
      [rows.filter((r) => !(Number.isFinite(r.LatNum) && Number.isFinite(r.LonNum))).length, "Koordinat tidak lengkap", "warn"],
      [rows.filter((r) => r.OscTerimaDate && r.TarikhC1Date && r.TarikhC1Date < r.OscTerimaDate).length, "TARIKH C1 lebih awal daripada OSC TERIMA", "bad"]
    ];
    dom.qualityGrid.innerHTML = metrics.map(([value, label, severity]) => `<div class="quality-item ${value === 0 ? "good" : severity}"><strong>${formatNumber(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
  }

  function setSelectFilter(select, value) {
    select.value = select.value === value ? "" : value;
    applyFilters(true);
  }

  function scheduleSync(immediate) {
    if (state.mode !== "grist" || !dom.syncToggle.checked || !window.grist?.setSelectedRows) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const ids = state.filtered.map((r) => r.id).filter((id) => id != null);
      const selection = state.filtered.length === state.all.length ? null : ids;
      window.grist.setSelectedRows(selection).then(() => {
        if (immediate) showToast("Penapis telah diselaraskan kepada widget Grist dipautkan.");
      }).catch(() => showToast("Penapis tidak dapat diselaraskan."));
    }, immediate ? 0 : 200);
  }

  function exportFilteredCsv() {
    const headers = ["PEMAJU", "PERMOHONAN", "PINDAAN", "PERUNDING", "LOT", "MUKIM", "NO. RUJ. PKM", "OSC TERIMA", "TUNAI SYARAT", "BENTANG OSC", "BIL. OSC", "TARIKH OSC", "KEPUTUSAN", "STATUS TUNAI SYARAT", "TARIKH C1", "LATITUDE", "LONGITUDE"];
    const rows = state.filtered.map((r) => [
      r.Pemaju, r.Permohonan, formatBooleanLike(r.Pindaan), r.Perunding, r.Lot, r.Mukim, r.NoRujPKM,
      isoDate(r.OscTerimaDate), r.TunaiSyarat, isoDate(r.BentangOSCDate) || textValue(r.BentangOSC), r.BilOSC,
      isoDate(r.TarikhOSCDate), r.Keputusan, r.StatusTunaiSyarat, isoDate(r.TarikhC1Date), textValue(r.Latitude), textValue(r.Longitude)
    ]);
    const csv = "\ufeff" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `PKM_SPS_ANALISIS_${compactDate(new Date())}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${formatNumber(rows.length)} rekod telah dieksport.`);
  }

  function classifyDecision(value) {
    const text = normalizeSearch(value);
    if (!text) return "pending";
    if (/tarik\s*balik|withdraw/.test(text)) return "withdrawn";
    if (/tolak|ditolak|reject|tidak\s*lulus/.test(text)) return "rejected";
    if (/lulus|dilulus|sokong|tiada\s*halangan/.test(text)) return "approved";
    return "other";
  }

  function classifyCompliance(value) {
    const text = normalizeSearch(value);
    if (/selesai/.test(text)) return "Selesai";
    if (/pematuhan|permatuhan/.test(text)) return "Pematuhan Tunai Syarat";
    if (/pending|tertangguh/.test(text)) return "Pending";
    return "Lain-lain";
  }

  function validCoordinates(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0 && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  function validDuration(start, end) {
    return start && end && end >= start ? Math.round((end - start) / 86400000) : null;
  }

  function parseDate(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) return validDate(new Date(value.getTime()));
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      const ms = value > 1e12 ? value : value > 1e8 ? value * 1000 : value > 20000 ? (value - 25569) * 86400000 : value;
      return validDate(new Date(ms));
    }
    const text = String(value).trim();
    if (!text || /^(nan|null|none|n\/a|-)$/i.test(text)) return null;
    let match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})(?:\s.*)?$/);
    if (match) return validDate(new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
    match = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T\s].*)?$/);
    if (match) return validDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const parsed = new Date(text);
    return validDate(parsed);
  }

  function validDate(date) { return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null; }
  function toNumber(value) {
    if (value == null || value === "") return null;
    const n = Number(String(value).replace(/,/g, ".").trim());
    return Number.isFinite(n) ? n : null;
  }
  function textValue(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ");
    if (value instanceof Date) return isoDate(value);
    return String(value).trim();
  }
  function formatBooleanLike(value) {
    if (value === true || value === 1) return "Ya";
    if (value === false || value === 0 || value == null || value === "") return "Tidak";
    const text = normalizeSearch(value);
    if (["true", "ya", "yes", "1", "pindaan"].includes(text)) return "Ya";
    if (["false", "tidak", "no", "0"].includes(text)) return "Tidak";
    return textValue(value);
  }
  function countBy(rows, keyFn) {
    const map = new Map();
    rows.forEach((row) => {
      const key = keyFn(row);
      if (key == null || key === "") return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }
  function topEntry(map) { return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0] || null; }
  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function sameMonth(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
  function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
  function formatMonthKey(key) { const [y, m] = key.split("-").map(Number); return `${MONTHS_FULL[m - 1]} ${y}`; }
  function formatMonth(date) { return `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`; }
  function formatDate(date) { return date ? new Intl.DateTimeFormat("ms-MY", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "–"; }
  function isoDate(date) { return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : ""; }
  function compactDate(date) { return isoDate(date).replace(/-/g, ""); }
  function normalizeKey(value) { return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function normalizeSearch(value) { return String(value || "").toLocaleLowerCase("ms").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); }
  function formatNumber(value) { return new Intl.NumberFormat("ms-MY", { maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function formatPercent(value, total) { return total ? `${Math.round(value / total * 100)}%` : "0%"; }
  function setText(el, value) { el.textContent = formatNumber(value); }
  function polar(cx, cy, r, angle) { return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }; }
  function donutPath(cx, cy, outer, inner, start, end) {
    const a = polar(cx, cy, outer, start), b = polar(cx, cy, outer, end);
    const c = polar(cx, cy, inner, end), d = polar(cx, cy, inner, start);
    const large = end - start > Math.PI ? 1 : 0;
    if (end - start >= Math.PI * 1.9999) return `M ${cx} ${cy - outer} A ${outer} ${outer} 0 1 1 ${cx - .01} ${cy - outer} L ${cx - .01} ${cy - inner} A ${inner} ${inner} 0 1 0 ${cx} ${cy - inner} Z`;
    return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;
  }
  function setEmpty(container, message) { container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`; }
  function csvCell(value) { const text = textValue(value).replace(/"/g, '""'); return /[",\r\n]/.test(text) ? `"${text}"` : text; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function escapeAttr(value) { return escapeHtml(value); }
  function escapeXml(value) { return escapeHtml(value); }
  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 2600);
  }
})();
