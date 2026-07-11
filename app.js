(() => {
  "use strict";

  const COLUMN_DEFS = [
    { name: "Pemaju", title: "PEMAJU", optional: true, description: "Nama pemaju / pemohon" },
    { name: "Permohonan", title: "PERMOHONAN", optional: true, description: "Tajuk atau perihal permohonan" },
    { name: "Pindaan", title: "PINDAAN", optional: true, description: "Penanda pindaan" },
    { name: "Perunding", title: "PERUNDING", optional: true, description: "Nama perunding" },
    { name: "Lot", title: "LOT", optional: true, description: "Nombor lot" },
    { name: "Mukim", title: "MUKIM", optional: true, description: "Mukim" },
    { name: "NoRujPKM", title: "NO. RUJ. PKM", optional: true, description: "Nombor rujukan PKM" },
    { name: "OscTerima", title: "OSC TERIMA", optional: true, description: "Tarikh diterima OSC" },
    { name: "TunaiSyarat", title: "TUNAI SYARAT", optional: true, description: "Tarikh / maklumat tunai syarat" },
    { name: "BentangOSC", title: "BENTANG OSC", optional: true, description: "Maklumat pembentangan OSC" },
    { name: "BilOSC", title: "BIL. OSC", optional: true, description: "Bilangan mesyuarat OSC" },
    { name: "TarikhOSC", title: "TARIKH OSC", optional: true, description: "Tarikh mesyuarat OSC" },
    { name: "Keputusan", title: "KEPUTUSAN", optional: true, description: "Keputusan permohonan" },
    { name: "StatusTunaiSyarat", title: "STATUS TUNAI SYARAT", optional: true, description: "Status pematuhan tunai syarat" },
    { name: "TarikhC1", title: "TARIKH C1", optional: true, description: "Tarikh C1" },
    { name: "Latitude", title: "LATITUDE", optional: true, description: "Koordinat latitude" },
    { name: "Longitude", title: "LONGITUDE", optional: true, description: "Koordinat longitude" }
  ];

  const KEY_ALIASES = {
    Pemaju: ["PEMAJU", "PEMOHON"],
    Permohonan: ["PERMOHONAN"],
    Pindaan: ["PINDAAN"],
    Perunding: ["PERUNDING"],
    Lot: ["LOT", "NOLOT", "NOMBORLOT"],
    Mukim: ["MUKIM"],
    NoRujPKM: ["NORUJPKM", "NORUJUKANPKM", "RUJPKM"],
    OscTerima: ["OSCTERIMA", "TARIKHTERIMAOSC"],
    TunaiSyarat: ["TUNAISYARAT"],
    BentangOSC: ["BENTANGOSC"],
    BilOSC: ["BILOSC", "BILANGANOSC"],
    TarikhOSC: ["TARIKHOSC"],
    Keputusan: ["KEPUTUSAN"],
    StatusTunaiSyarat: ["STATUSTUNAISYARAT", "STATUSPEMATUHAN"],
    TarikhC1: ["TARIKHC1"],
    Latitude: ["LATITUDE", "LAT"],
    Longitude: ["LONGITUDE", "LONG", "LNG"]
  };

  const COLORS = ["#147d92", "#2e7d4f", "#b78117", "#b33a3a", "#6d55a5", "#526477", "#16816f", "#c56b2d"];
  const DECISION_COLORS = {
    approved: "#2e7d4f",
    rejected: "#b33a3a",
    withdrawn: "#7557a8",
    pending: "#b78117",
    other: "#526477"
  };
  const DECISION_LABELS = {
    approved: "Diluluskan",
    rejected: "Ditolak",
    withdrawn: "Tarik Balik",
    pending: "Belum Ada Keputusan",
    other: "Lain-lain"
  };
  const COMPLIANCE_COLORS = {
    "Selesai": "#2e7d4f",
    "Pematuhan Tunai Syarat": "#c66a2b",
    "Pending": "#b78117",
    "Lain-lain": "#526477"
  };

  const state = {
    mode: "loading",
    all: [],
    filtered: [],
    mappings: null,
    filters: {},
    sortKey: "TarikhOSCDate",
    sortDir: "desc",
    page: 1,
    pageSize: 15,
    selectedRowId: null
  };

  const dom = {};
  let searchTimer = null;
  let syncTimer = null;
  let toastTimer = null;

  document.addEventListener("DOMContentLoaded", boot);

  function boot() {
    cacheDom();
    bindEvents();
    const params = new URLSearchParams(window.location.search);
    const demoRequested = params.get("demo") === "1";
    if (demoRequested || !isEmbedded()) {
      startDemo();
    } else {
      loadGristApi();
    }
  }

  function cacheDom() {
    [
      "app", "loadingOverlay", "toast", "modeDot", "modeLabel", "mappingBanner", "mappingMessage",
      "printBtn", "exportBtn", "resetBtn", "recordSummary", "updatedAt", "searchInput", "yearFilter",
      "mukimFilter", "decisionFilter", "developerFilter", "consultantFilter", "complianceFilter",
      "syncToggle", "kpiTotal", "kpiTotalNote", "kpiApproved", "kpiApprovedNote", "kpiRejected",
      "kpiRejectedNote", "kpiWithdrawn", "kpiWithdrawnNote", "kpiPending", "kpiPendingNote",
      "kpiNonCompliant", "kpiNonCompliantNote", "kpiC1", "kpiC1Note", "insightCards", "trendMeta",
      "trendChart", "decisionMeta", "decisionChart", "mukimChart", "developerChart",
      "durationReceivedMeta", "durationReceivedChart", "durationOscMeta", "durationOscChart",
      "spatialMeta", "spatialChart", "complianceMeta", "complianceChart", "pageSizeSelect",
      "tableBody", "pageInfo", "prevPageBtn", "nextPageBtn", "qualityGrid"
    ].forEach((id) => { dom[id] = document.getElementById(id); });
    dom.sortButtons = Array.from(document.querySelectorAll("thead button[data-sort]"));
  }

  function bindEvents() {
    dom.searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => applyFilters(true), 160);
    });
    [dom.yearFilter, dom.mukimFilter, dom.decisionFilter, dom.developerFilter, dom.consultantFilter, dom.complianceFilter]
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
      const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
      if (state.page < pages) { state.page += 1; renderTable(); }
    });
    dom.sortButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sort;
        if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else { state.sortKey = key; state.sortDir = key.includes("Date") || key.startsWith("Days") ? "desc" : "asc"; }
        state.page = 1;
        renderTable();
      });
    });
    dom.syncToggle.addEventListener("change", () => {
      if (state.mode !== "grist") {
        dom.syncToggle.checked = false;
        showToast("Penyelarasan hanya tersedia apabila widget digunakan dalam Grist.");
        return;
      }
      if (!dom.syncToggle.checked && window.grist) {
        window.grist.setSelectedRows(null).catch(() => {});
      } else {
        scheduleSyncToGrist(true);
      }
    });
  }

  function isEmbedded() {
    try { return window.self !== window.top; }
    catch (_) { return true; }
  }

  function loadGristApi() {
    const script = document.createElement("script");
    script.src = "https://docs.getgrist.com/grist-plugin-api.js";
    script.async = true;
    script.onload = initGrist;
    script.onerror = () => showConnectionError("Grist Plugin API tidak dapat dimuatkan. Pastikan URL widget dibuka melalui Grist dan sambungan rangkaian dibenarkan.");
    document.head.appendChild(script);
  }

  function initGrist() {
    if (!window.grist) {
      showConnectionError("Objek Grist tidak tersedia.");
      return;
    }
    try {
      window.grist.ready({
        requiredAccess: "read table",
        allowSelectBy: true,
        columns: COLUMN_DEFS
      });
      window.grist.onRecords((records, mappings) => {
        state.mappings = mappings || {};
        const normalized = (records || []).map((raw) => {
          let mapped = {};
          try { mapped = window.grist.mapColumnNames(raw) || {}; }
          catch (_) { mapped = {}; }
          const autoMapped = autoMapRecord(raw);
          return normalizeRecord({ ...autoMapped, ...mapped, id: raw.id });
        });
        updateMappingBanner(state.mappings);
        setData(normalized, "grist");
      });
    } catch (error) {
      showConnectionError(`Ralat memulakan widget Grist: ${error && error.message ? error.message : "ralat tidak dikenal pasti"}`);
    }
  }

  function autoMapRecord(raw) {
    const result = {};
    const entries = Object.entries(raw || {});
    const normalizedKeys = entries.map(([key, value]) => [normalizeKey(key), value]);
    COLUMN_DEFS.forEach((def) => {
      const aliases = new Set([normalizeKey(def.name), normalizeKey(def.title), ...(KEY_ALIASES[def.name] || [])]);
      const match = normalizedKeys.find(([key]) => aliases.has(key));
      if (match) result[def.name] = match[1];
    });
    return result;
  }

  function updateMappingBanner(mappings) {
    const unmapped = COLUMN_DEFS.filter((def) => !mappings || mappings[def.name] == null || mappings[def.name] === "");
    if (!unmapped.length) {
      dom.mappingBanner.hidden = true;
      return;
    }
    const names = unmapped.slice(0, 6).map((def) => def.title).join(", ");
    const remainder = unmapped.length > 6 ? ` dan ${unmapped.length - 6} lagi` : "";
    dom.mappingMessage.textContent = `Buka “Widget options” dan padankan: ${names}${remainder}. Dashboard masih akan memaparkan medan yang telah dipetakan.`;
    dom.mappingBanner.hidden = false;
  }

  function showConnectionError(message) {
    state.mode = "error";
    dom.modeLabel.textContent = "Sambungan Grist gagal";
    dom.modeDot.className = "status-dot";
    dom.mappingMessage.textContent = message;
    dom.mappingBanner.hidden = false;
    dom.syncToggle.disabled = true;
    setData([], "error");
  }

  function startDemo() {
    const rows = buildDemoRows().map(normalizeRecord);
    state.mappings = null;
    dom.mappingBanner.hidden = true;
    setData(rows, "demo");
  }

  function setData(rows, mode) {
    state.mode = mode;
    state.all = Array.isArray(rows) ? rows : [];
    state.page = 1;
    state.selectedRowId = null;
    setModeStatus();
    populateFilterOptions();
    applyFilters(false);
    dom.app.setAttribute("aria-busy", "false");
    dom.loadingOverlay.classList.add("hidden");
  }

  function setModeStatus() {
    dom.modeDot.className = "status-dot";
    if (state.mode === "grist") {
      dom.modeDot.classList.add("live");
      dom.modeLabel.textContent = "Data langsung Grist";
      dom.syncToggle.disabled = false;
    } else if (state.mode === "demo") {
      dom.modeDot.classList.add("demo");
      dom.modeLabel.textContent = "Mod demo • data sintetik";
      dom.syncToggle.checked = false;
      dom.syncToggle.disabled = true;
    } else {
      dom.modeLabel.textContent = "Tiada sambungan data";
      dom.syncToggle.checked = false;
      dom.syncToggle.disabled = true;
    }
  }

  function normalizeRecord(raw) {
    const oscTerimaDate = parseDate(raw.OscTerima);
    const tarikhOscDate = parseDate(raw.TarikhOSC);
    const tarikhC1Date = parseDate(raw.TarikhC1);
    const primaryDate = oscTerimaDate || tarikhOscDate || tarikhC1Date;
    const pemajuRaw = textValue(raw.Pemaju);
    const perundingRaw = textValue(raw.Perunding);
    const mukimRaw = textValue(raw.Mukim);
    const keputusanRaw = textValue(raw.Keputusan);
    const statusRaw = textValue(raw.StatusTunaiSyarat);
    const lat = toNumber(raw.Latitude);
    const lon = toNumber(raw.Longitude);
    const coordsValid = validCoordinates(lat, lon);
    const daysReceivedToC1 = oscTerimaDate && tarikhC1Date && tarikhC1Date >= oscTerimaDate
      ? daysBetween(oscTerimaDate, tarikhC1Date) : null;
    const daysOscToC1 = tarikhOscDate && tarikhC1Date && tarikhC1Date >= tarikhOscDate
      ? daysBetween(tarikhOscDate, tarikhC1Date) : null;
    const decisionClass = classifyDecision(keputusanRaw);
    const complianceCategory = classifyCompliance(statusRaw);
    const record = {
      id: raw.id,
      Pemaju: pemajuRaw,
      PemajuResolved: pemajuRaw || "Tidak Dinyatakan",
      Permohonan: textValue(raw.Permohonan),
      Pindaan: textValue(raw.Pindaan),
      Perunding: perundingRaw,
      PerundingResolved: perundingRaw || "Tidak Dinyatakan",
      Lot: textValue(raw.Lot),
      Mukim: mukimRaw,
      MukimResolved: mukimRaw || "Tidak Dinyatakan",
      NoRujPKM: textValue(raw.NoRujPKM),
      OscTerima: raw.OscTerima,
      OscTerimaDate: oscTerimaDate,
      TunaiSyarat: textValue(raw.TunaiSyarat),
      BentangOSC: textValue(raw.BentangOSC),
      BilOSC: textValue(raw.BilOSC),
      TarikhOSC: raw.TarikhOSC,
      TarikhOSCDate: tarikhOscDate,
      Keputusan: keputusanRaw,
      KeputusanResolved: keputusanRaw || "Belum Ada Keputusan",
      DecisionClass: decisionClass,
      DecisionLabel: DECISION_LABELS[decisionClass],
      StatusTunaiSyarat: statusRaw,
      ComplianceCategory: complianceCategory,
      IsNonCompliant: complianceCategory !== "Selesai",
      TarikhC1: raw.TarikhC1,
      TarikhC1Date: tarikhC1Date,
      Latitude: raw.Latitude,
      Longitude: raw.Longitude,
      LatNum: coordsValid ? lat : null,
      LonNum: coordsValid ? lon : null,
      DaysReceivedToC1: daysReceivedToC1,
      DaysOscToC1: daysOscToC1,
      PrimaryDate: primaryDate,
      Year: primaryDate ? String(primaryDate.getFullYear()) : "Tanpa Tarikh"
    };
    record.SearchBlob = normalizeSearch([
      record.Pemaju, record.Permohonan, record.Pindaan, record.Perunding, record.Lot, record.Mukim,
      record.NoRujPKM, record.TunaiSyarat, record.BentangOSC, record.BilOSC, record.Keputusan,
      record.StatusTunaiSyarat
    ].join(" "));
    return record;
  }

  function buildDemoRows() {
    const mukim = ["1", "4", "7", "9", "11", "12", "13", "14", "15"];
    const pemaju = ["Asas Dunia Bhd", "Eco Horizon Sdn Bhd", "Jaya Selatan Development Sdn Bhd", "Sentosa Properties Sdn Bhd", "Mutiara SPS Sdn Bhd", "Cemerlang Industri Sdn Bhd"];
    const perunding = ["Shaari Planners Sdn Bhd", "Perunding Bandar Utama", "Arkitek SPS", "Jururancang Selatan", "Tidak Dinyatakan"];
    const decisions = ["Lulus", "Lulus", "Lulus", "Tolak", "Tarik Balik", ""];
    const statuses = ["Selesai", "Selesai", "Pending", "Permatuhan Tunai Syarat [KEJ]", "Bayaran Premium [Ubah Syarat Tanah]"];
    const types = ["Perumahan", "Perniagaan", "Industri", "Pembangunan Bercampur", "Pecah Sempadan", "Kemudahan Masyarakat"];
    const rows = [];
    for (let i = 0; i < 108; i += 1) {
      const oscDate = new Date(2021 + Math.floor(i / 22), i % 12, 5 + (i * 7) % 20);
      const received = i > 78 ? new Date(oscDate.getFullYear(), oscDate.getMonth(), Math.max(1, oscDate.getDate() - 24 - (i % 14))) : null;
      const hasC1 = i % 7 !== 0;
      const c1 = hasC1 ? new Date(oscDate.getFullYear(), oscDate.getMonth(), oscDate.getDate() + 8 + (i * 13) % 170) : null;
      rows.push({
        id: i + 1,
        Pemaju: pemaju[i % pemaju.length],
        Permohonan: `Permohonan Kebenaran Merancang bagi cadangan ${types[i % types.length]} di atas lot berkaitan, Mukim ${mukim[i % mukim.length]}, Seberang Perai Selatan.`,
        Pindaan: i % 5 === 0,
        Perunding: i % 6 === 0 ? "" : perunding[i % perunding.length],
        Lot: `Lot ${1200 + i * 9}`,
        Mukim: mukim[i % mukim.length],
        NoRujPKM: i === 82 ? "" : `MBSP/70/39-${String(60 + (i % 30)).padStart(2, "0")}/${String(i + 1).padStart(3, "0")}`,
        OscTerima: received ? isoDate(received) : "",
        TunaiSyarat: i % 4 === 0 ? "Dalam tindakan" : "",
        BentangOSC: `OSC Bil.${(i % 12) + 1}/${oscDate.getFullYear()}`,
        BilOSC: `OSC Bil.${(i % 12) + 1}/${oscDate.getFullYear()}`,
        TarikhOSC: isoDate(oscDate),
        Keputusan: decisions[i % decisions.length],
        StatusTunaiSyarat: statuses[i % statuses.length],
        TarikhC1: c1 ? isoDate(c1) : "",
        Latitude: i % 9 === 0 ? 0 : 5.12 + ((i * 17) % 260) / 1000,
        Longitude: i % 9 === 0 ? 0 : 100.38 + ((i * 13) % 190) / 1000
      });
    }
    return rows;
  }

  function populateFilterOptions() {
    fillSelect(dom.yearFilter, uniqueSorted(state.all.map((r) => r.Year), true), "Semua tahun");
    fillSelect(dom.mukimFilter, uniqueSorted(state.all.map((r) => r.MukimResolved)), "Semua mukim");
    fillSelect(dom.decisionFilter, uniqueSorted(state.all.map((r) => r.DecisionLabel)), "Semua keputusan");
    fillSelect(dom.developerFilter, uniqueSorted(state.all.map((r) => r.PemajuResolved)), "Semua pemaju");
    fillSelect(dom.consultantFilter, uniqueSorted(state.all.map((r) => r.PerundingResolved)), "Semua perunding");
  }

  function fillSelect(select, values, allLabel) {
    const previous = select.value;
    select.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = allLabel;
    select.appendChild(allOption);
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    if (values.includes(previous)) select.value = previous;
  }

  function uniqueSorted(values, descending = false) {
    const unique = Array.from(new Set(values.filter((value) => value != null && value !== "")));
    unique.sort((a, b) => String(a).localeCompare(String(b), "ms", { numeric: true, sensitivity: "base" }));
    if (descending) unique.reverse();
    return unique;
  }

  function applyFilters(resetPage = true) {
    if (resetPage) state.page = 1;
    const query = normalizeSearch(dom.searchInput.value);
    state.filters = {
      search: query,
      year: dom.yearFilter.value,
      mukim: dom.mukimFilter.value,
      decision: dom.decisionFilter.value,
      developer: dom.developerFilter.value,
      consultant: dom.consultantFilter.value,
      compliance: dom.complianceFilter.value
    };
    state.filtered = state.all.filter((record) => {
      if (query && !record.SearchBlob.includes(query)) return false;
      if (state.filters.year && record.Year !== state.filters.year) return false;
      if (state.filters.mukim && record.MukimResolved !== state.filters.mukim) return false;
      if (state.filters.decision && record.DecisionLabel !== state.filters.decision) return false;
      if (state.filters.developer && record.PemajuResolved !== state.filters.developer) return false;
      if (state.filters.consultant && record.PerundingResolved !== state.filters.consultant) return false;
      if (state.filters.compliance && record.ComplianceCategory !== state.filters.compliance) return false;
      return true;
    });
    const maxPage = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    state.page = Math.min(state.page, maxPage);
    renderAll();
    scheduleSyncToGrist(false);
  }

  function resetFilters() {
    dom.searchInput.value = "";
    [dom.yearFilter, dom.mukimFilter, dom.decisionFilter, dom.developerFilter, dom.consultantFilter, dom.complianceFilter]
      .forEach((el) => { el.value = ""; });
    applyFilters(true);
  }

  function renderAll() {
    renderSummary();
    renderKpis();
    renderInsights();
    renderTrendChart();
    renderDecisionChart();
    renderMukimChart();
    renderDeveloperChart();
    renderDurationCharts();
    renderSpatialChart();
    renderComplianceChart();
    renderTable();
    renderQuality();
  }

  function renderSummary() {
    dom.recordSummary.textContent = `${formatNumber(state.filtered.length)} daripada ${formatNumber(state.all.length)} rekod`;
    const now = new Date();
    dom.updatedAt.textContent = `Paparan dikemas kini: ${new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short" }).format(now)}`;
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
    dom.kpiTotal.textContent = formatNumber(total);
    dom.kpiTotalNote.textContent = total === state.all.length ? "Keseluruhan rekod dalam paparan" : `${formatNumber(state.all.length - total)} rekod ditapis keluar`;
    dom.kpiApproved.textContent = formatNumber(approved);
    dom.kpiApprovedNote.textContent = `${formatPercent(approved, total)} daripada rekod ditapis`;
    dom.kpiRejected.textContent = formatNumber(rejected);
    dom.kpiRejectedNote.textContent = `${formatPercent(rejected, total)} daripada rekod ditapis`;
    dom.kpiWithdrawn.textContent = formatNumber(withdrawn);
    dom.kpiWithdrawnNote.textContent = `${formatPercent(withdrawn, total)} daripada rekod ditapis`;
    dom.kpiPending.textContent = formatNumber(pending);
    dom.kpiPendingNote.textContent = `${formatPercent(pending, total)} tanpa keputusan`;
    dom.kpiNonCompliant.textContent = formatNumber(nonCompliant);
    dom.kpiNonCompliantNote.textContent = `${formatPercent(nonCompliant, total)} selain status “Selesai”`;
    dom.kpiC1.textContent = formatNumber(c1);
    dom.kpiC1Note.textContent = `${formatPercent(c1, total)} mempunyai tarikh C1`;
  }

  function renderInsights() {
    const rows = state.filtered;
    const topMukim = topEntry(countBy(rows, (r) => r.MukimResolved));
    const topDeveloper = topEntry(countBy(rows, (r) => r.PemajuResolved));
    const months = countBy(rows.filter((r) => r.PrimaryDate), (r) => monthKey(r.PrimaryDate));
    const peakMonth = topEntry(months);
    const receivedDurations = rows.map((r) => r.DaysReceivedToC1).filter(Number.isFinite);
    const oscDurations = rows.map((r) => r.DaysOscToC1).filter(Number.isFinite);
    const cards = [
      { value: topMukim ? `Mukim ${topMukim[0]}` : "–", note: topMukim ? `${formatNumber(topMukim[1])} permohonan tertinggi` : "Tiada data mukim" },
      { value: topDeveloper ? topDeveloper[0] : "–", note: topDeveloper ? `${formatNumber(topDeveloper[1])} permohonan oleh pemaju tertinggi` : "Tiada data pemaju" },
      { value: peakMonth ? formatMonthKey(peakMonth[0]) : "–", note: peakMonth ? `${formatNumber(peakMonth[1])} permohonan pada bulan puncak` : "Tiada tarikh analisis" },
      { value: receivedDurations.length ? `${formatNumber(Math.round(median(receivedDurations)))} hari` : "–", note: `Median OSC Terima–C1 · ${formatNumber(receivedDurations.length)} rekod` },
      { value: oscDurations.length ? `${formatNumber(Math.round(median(oscDurations)))} hari` : "–", note: `Median Tarikh OSC–C1 · ${formatNumber(oscDurations.length)} rekod` }
    ];
    dom.insightCards.innerHTML = "";
    cards.forEach((card) => {
      const el = document.createElement("div");
      el.className = "insight-card";
      const strong = document.createElement("strong"); strong.textContent = card.value; strong.title = card.value;
      const span = document.createElement("span"); span.textContent = card.note;
      el.append(strong, span); dom.insightCards.appendChild(el);
    });
  }

  function renderTrendChart() {
    const grouped = countBy(state.filtered.filter((r) => r.PrimaryDate), (r) => monthKey(r.PrimaryDate));
    const series = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    dom.trendMeta.textContent = series.length ? `${series.length} bulan • ${formatNumber(series.reduce((s, [, v]) => s + v, 0))} rekod bertarikh` : "Tiada data tarikh";
    if (!series.length) { setEmpty(dom.trendChart, "Tiada tarikh yang sah untuk membina trend bulanan."); return; }
    const width = 820, height = 280;
    const margin = { left: 48, right: 18, top: 22, bottom: 42 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const maxValue = Math.max(...series.map(([, value]) => value), 1);
    const step = Math.max(1, Math.ceil(maxValue / 4)), niceMax = step * 4;
    const x = (index) => margin.left + (series.length === 1 ? plotW / 2 : (index / (series.length - 1)) * plotW);
    const y = (value) => margin.top + plotH - (value / niceMax) * plotH;
    const points = series.map(([, value], index) => [x(index), y(value)]);
    const linePath = points.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(2)},${(margin.top + plotH).toFixed(2)} L${points[0][0].toFixed(2)},${(margin.top + plotH).toFixed(2)} Z`;
    const tickEvery = Math.max(1, Math.ceil(series.length / 7));
    let svg = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><defs><linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#147d92" stop-opacity="0.30"/><stop offset="100%" stop-color="#147d92" stop-opacity="0.02"/></linearGradient></defs>`;
    for (let i = 0; i <= 4; i += 1) {
      const value = step * i, py = y(value);
      svg += `<line x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}" stroke="#dfe8ed"/><text x="${margin.left - 9}" y="${py + 4}" text-anchor="end" fill="#64748b" font-size="10">${value}</text>`;
    }
    series.forEach(([key, value], index) => {
      if (index === 0 || index === series.length - 1 || index % tickEvery === 0) svg += `<text x="${x(index)}" y="${height - 15}" text-anchor="middle" fill="#64748b" font-size="10">${escapeXml(formatMonthKey(key, true))}</text>`;
      svg += `<circle cx="${x(index)}" cy="${y(value)}" r="4" fill="#fff" stroke="#147d92" stroke-width="2"><title>${escapeXml(`${formatMonthKey(key)}: ${value} permohonan`)}</title></circle>`;
    });
    svg += `<path d="${areaPath}" fill="url(#trendAreaGradient)"/><path d="${linePath}" fill="none" stroke="#147d92" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    dom.trendChart.innerHTML = svg;
  }

  function renderDecisionChart() {
    const order = ["approved", "rejected", "withdrawn", "pending", "other"];
    const entries = order.map((key) => ({ key, label: DECISION_LABELS[key], value: state.filtered.filter((r) => r.DecisionClass === key).length })).filter((item) => item.value > 0);
    dom.decisionMeta.textContent = `${entries.length} kategori`;
    if (!entries.length) { setEmpty(dom.decisionChart, "Tiada rekod keputusan dalam skop semasa."); return; }
    const total = entries.reduce((sum, item) => sum + item.value, 0);
    const cx = 110, cy = 110, outer = 86, inner = 53;
    let angle = -Math.PI / 2, paths = "";
    entries.forEach((item) => {
      const next = angle + (item.value / total) * Math.PI * 2;
      paths += `<path d="${donutPath(cx, cy, outer, inner, angle, next)}" fill="${DECISION_COLORS[item.key]}" stroke="#fff" stroke-width="2"><title>${escapeXml(`${item.label}: ${item.value} (${formatPercent(item.value, total)})`)}</title></path>`;
      angle = next;
    });
    const svg = `<svg class="donut-svg" viewBox="0 0 220 220" aria-hidden="true">${paths}<circle cx="${cx}" cy="${cy}" r="43" fill="#fff"/><text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="#0b3f5c" font-size="28" font-weight="800">${total}</text><text x="${cx}" y="${cy + 19}" text-anchor="middle" fill="#64748b" font-size="10">REKOD</text></svg>`;
    const legend = entries.map((item, index) => `<button class="legend-item" type="button" data-decision-index="${index}" title="${escapeAttr(item.label)}"><span class="legend-dot" style="background:${DECISION_COLORS[item.key]}"></span><span class="legend-label">${escapeHtml(item.label)}</span><span class="legend-value">${item.value} · ${formatPercent(item.value, total)}</span></button>`).join("");
    dom.decisionChart.innerHTML = `${svg}<div class="legend">${legend}</div>`;
    dom.decisionChart.querySelectorAll("[data-decision-index]").forEach((button) => button.addEventListener("click", () => setSelectFilter(dom.decisionFilter, entries[Number(button.dataset.decisionIndex)].label)));
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

  function renderDurationDistribution(durations, container, meta, emptyMessage) {
    const bins = [
      ["0–30 hari", 0, 30], ["31–60 hari", 31, 60], ["61–90 hari", 61, 90],
      ["91–180 hari", 91, 180], [">180 hari", 181, Infinity]
    ].map(([label, min, max]) => [label, durations.filter((value) => value >= min && value <= max).length]);
    meta.textContent = durations.length ? `${formatNumber(durations.length)} rekod • median ${formatNumber(Math.round(median(durations)))} hari` : "Tiada rekod lengkap";
    if (!durations.length) { setEmpty(container, emptyMessage); return; }
    renderBarList(container, bins, null, ["#2e7d4f", "#16816f", "#147d92", "#b78117", "#b33a3a"]);
  }

  function renderComplianceChart() {
    const labels = ["Selesai", "Pematuhan Tunai Syarat", "Pending", "Lain-lain"];
    const entries = labels.map((label) => [label, state.filtered.filter((r) => r.ComplianceCategory === label).length]);
    dom.complianceMeta.textContent = `${formatNumber(state.filtered.filter((r) => r.ComplianceCategory === "Selesai").length)} selesai`;
    renderBarList(dom.complianceChart, entries, (value) => setSelectFilter(dom.complianceFilter, value), labels.map((label) => COMPLIANCE_COLORS[label]));
  }

  function renderBarList(container, entries, onFilter, colors = null) {
    if (!entries.length || entries.every(([, value]) => value === 0)) {
      setEmpty(container, "Tiada data untuk analisis ini.");
      return;
    }
    const max = Math.max(...entries.map(([, value]) => value), 1);
    container.innerHTML = entries.map(([label, value], index) => {
      const color = colors ? colors[index % colors.length] : null;
      return `<div class="bar-row"><button class="bar-label" type="button" ${onFilter ? `data-bar-index="${index}"` : "disabled"} title="${escapeAttr(label)}">${escapeHtml(label)}</button><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, (value / max) * 100)}%;${color ? `background:${color};` : ""}"></div></div><span class="bar-value">${formatNumber(value)}</span></div>`;
    }).join("");
    if (onFilter) {
      container.querySelectorAll("[data-bar-index]").forEach((button) => {
        button.addEventListener("click", () => onFilter(entries[Number(button.dataset.barIndex)][0]));
      });
    }
  }

  function renderSpatialChart() {
    const allPoints = state.filtered.filter((r) => Number.isFinite(r.LatNum) && Number.isFinite(r.LonNum));
    const step = Math.max(1, Math.ceil(allPoints.length / 700));
    const points = allPoints.filter((_, index) => index % step === 0);
    dom.spatialMeta.textContent = allPoints.length ? `${formatNumber(allPoints.length)} lokasi lengkap${step > 1 ? ` • ${formatNumber(points.length)} diplot` : ""}` : "Tiada koordinat lengkap";
    if (!points.length) {
      setEmpty(dom.spatialChart, "Padankan dan lengkapkan medan LATITUDE serta LONGITUDE untuk memaparkan taburan lokasi.");
      return;
    }
    let minLat = Math.min(...points.map((r) => r.LatNum));
    let maxLat = Math.max(...points.map((r) => r.LatNum));
    let minLon = Math.min(...points.map((r) => r.LonNum));
    let maxLon = Math.max(...points.map((r) => r.LonNum));
    if (minLat === maxLat) { minLat -= 0.005; maxLat += 0.005; }
    if (minLon === maxLon) { minLon -= 0.005; maxLon += 0.005; }
    const latPad = (maxLat - minLat) * 0.08;
    const lonPad = (maxLon - minLon) * 0.08;
    minLat -= latPad; maxLat += latPad; minLon -= lonPad; maxLon += lonPad;
    const width = 640, height = 300, margin = { left: 54, right: 18, top: 18, bottom: 39 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const x = (lon) => margin.left + ((lon - minLon) / (maxLon - minLon)) * plotW;
    const y = (lat) => margin.top + plotH - ((lat - minLat) / (maxLat - minLat)) * plotH;
    let svg = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><rect x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}" rx="8" fill="#f7fafb" stroke="#dfe8ed"/>`;
    for (let i = 1; i < 5; i += 1) {
      const gx = margin.left + (i / 5) * plotW;
      const gy = margin.top + (i / 5) * plotH;
      svg += `<line x1="${gx}" y1="${margin.top}" x2="${gx}" y2="${margin.top + plotH}" stroke="#e2e8f0"/><line x1="${margin.left}" y1="${gy}" x2="${margin.left + plotW}" y2="${gy}" stroke="#e2e8f0"/>`;
    }
    points.forEach((record, index) => {
      const color = DECISION_COLORS[record.DecisionClass] || DECISION_COLORS.other;
      svg += `<circle data-spatial-index="${index}" cx="${x(record.LonNum).toFixed(2)}" cy="${y(record.LatNum).toFixed(2)}" r="4.2" fill="${color}" fill-opacity="0.72" stroke="#ffffff" stroke-width="1"><title>${escapeXml(`${record.NoRujPKM || "Tanpa rujukan"} • ${record.MukimResolved} • ${record.LatNum.toFixed(5)}, ${record.LonNum.toFixed(5)}`)}</title></circle>`;
    });
    svg += `<text x="${margin.left}" y="${height - 13}" fill="#64748b" font-size="10">${minLon.toFixed(4)}</text><text x="${width - margin.right}" y="${height - 13}" text-anchor="end" fill="#64748b" font-size="10">${maxLon.toFixed(4)}</text><text x="${margin.left - 9}" y="${margin.top + 4}" text-anchor="end" fill="#64748b" font-size="10">${maxLat.toFixed(4)}</text><text x="${margin.left - 9}" y="${margin.top + plotH}" text-anchor="end" fill="#64748b" font-size="10">${minLat.toFixed(4)}</text><text x="${margin.left + plotW / 2}" y="${height - 12}" text-anchor="middle" fill="#475569" font-size="10" font-weight="700">LONGITUDE</text><text x="13" y="${margin.top + plotH / 2}" text-anchor="middle" transform="rotate(-90 13 ${margin.top + plotH / 2})" fill="#475569" font-size="10" font-weight="700">LATITUDE</text></svg>`;
    dom.spatialChart.innerHTML = svg;
    dom.spatialChart.querySelectorAll("[data-spatial-index]").forEach((circle) => {
      circle.style.cursor = "pointer";
      circle.addEventListener("click", () => focusRecord(points[Number(circle.dataset.spatialIndex)]));
    });
  }

  function renderTable() {
    const rows = sortRecords(state.filtered);
    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);
    if (!pageRows.length) {
      dom.tableBody.innerHTML = `<tr><td colspan="11"><div class="empty-state">Tiada rekod sepadan dengan penapis semasa.</div></td></tr>`;
    } else {
      dom.tableBody.innerHTML = pageRows.map((record, index) => {
        const decisionClass = `status-${record.DecisionClass}`;
        const complianceClass = record.ComplianceCategory === "Selesai" ? "compliance-done" : record.ComplianceCategory === "Pematuhan Tunai Syarat" ? "compliance-action" : record.ComplianceCategory === "Pending" ? "compliance-pending" : "compliance-other";
        const selected = state.selectedRowId != null && String(state.selectedRowId) === String(record.id) ? " is-selected" : "";
        return `<tr class="${selected}" data-page-index="${index}" tabindex="0" title="Klik untuk memfokuskan rekod ini dalam Grist">
          <td><strong>${escapeHtml(record.NoRujPKM || "–")}</strong></td>
          <td><div class="cell-clamp" title="${escapeAttr(record.Permohonan || "")}">${escapeHtml(record.Permohonan || "–")}</div></td>
          <td><div class="cell-clamp" title="${escapeAttr(record.Pemaju || "")}">${escapeHtml(record.Pemaju || "–")}</div></td>
          <td>${escapeHtml(record.MukimResolved)}</td>
          <td>${formatDate(record.OscTerimaDate)}</td>
          <td>${formatDate(record.TarikhOSCDate)}</td>
          <td><span class="status-badge ${decisionClass}" title="${escapeAttr(record.KeputusanResolved)}">${escapeHtml(record.KeputusanResolved)}</span></td>
          <td><span class="status-badge ${complianceClass}" title="${escapeAttr(record.StatusTunaiSyarat || "")}">${escapeHtml(record.StatusTunaiSyarat || "Tiada rekod")}</span></td>
          <td>${formatDate(record.TarikhC1Date)}</td>
          <td class="numeric">${Number.isFinite(record.DaysReceivedToC1) ? formatNumber(record.DaysReceivedToC1) : "–"}</td>
          <td class="numeric">${Number.isFinite(record.DaysOscToC1) ? formatNumber(record.DaysOscToC1) : "–"}</td>
        </tr>`;
      }).join("");
      dom.tableBody.querySelectorAll("tr[data-page-index]").forEach((row) => {
        const activate = () => focusRecord(pageRows[Number(row.dataset.pageIndex)]);
        row.addEventListener("click", activate);
        row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
      });
    }
    const shownStart = rows.length ? start + 1 : 0, shownEnd = Math.min(start + state.pageSize, rows.length);
    dom.pageInfo.textContent = `Rekod ${formatNumber(shownStart)}–${formatNumber(shownEnd)} daripada ${formatNumber(rows.length)} • Halaman ${state.page} daripada ${totalPages}`;
    dom.prevPageBtn.disabled = state.page <= 1;
    dom.nextPageBtn.disabled = state.page >= totalPages;
    dom.sortButtons.forEach((button) => { const indicator = button.querySelector("span"); indicator.textContent = button.dataset.sort === state.sortKey ? (state.sortDir === "asc" ? "▲" : "▼") : ""; });
  }

  function sortRecords(records) {
    const direction = state.sortDir === "asc" ? 1 : -1;
    return records.map((record, index) => ({ record, index })).sort((a, b) => {
      const av = a.record[state.sortKey];
      const bv = b.record[state.sortKey];
      const result = compareValues(av, bv);
      return result === 0 ? a.index - b.index : result * direction;
    }).map((item) => item.record);
  }

  function compareValues(a, b) {
    const aBlank = a == null || a === "";
    const bBlank = b == null || b === "";
    if (aBlank && bBlank) return 0;
    if (aBlank) return 1;
    if (bBlank) return -1;
    if (a instanceof Date || b instanceof Date) return (a instanceof Date ? a.getTime() : 0) - (b instanceof Date ? b.getTime() : 0);
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" || typeof b === "boolean") return Number(a) - Number(b);
    return String(a).localeCompare(String(b), "ms", { numeric: true, sensitivity: "base" });
  }

  function focusRecord(record) {
    if (!record) return;
    state.selectedRowId = record.id;
    renderTable();
    if (state.mode === "grist" && window.grist && record.id != null) {
      window.grist.setCursorPos({ rowId: record.id }).catch(() => showToast("Rekod tidak dapat difokuskan dalam Grist."));
    }
  }

  function renderQuality() {
    const rows = state.filtered;
    const refCounts = countBy(rows.filter((r) => r.NoRujPKM), (r) => normalizeSearch(r.NoRujPKM));
    const duplicateRefs = Array.from(refCounts.values()).filter((count) => count > 1).length;
    const metrics = [
      { value: rows.filter((r) => !r.NoRujPKM).length, label: "No. Ruj. PKM kosong", severity: "warn" },
      { value: rows.filter((r) => !r.OscTerimaDate).length, label: "OSC TERIMA kosong / tidak sah", severity: "warn" },
      { value: rows.filter((r) => !r.Keputusan).length, label: "KEPUTUSAN kosong", severity: "warn" },
      { value: rows.filter((r) => !(Number.isFinite(r.LatNum) && Number.isFinite(r.LonNum))).length, label: "Koordinat tidak lengkap", severity: "warn" },
      { value: duplicateRefs, label: "No. rujukan berulang", severity: "bad" },
      { value: rows.filter((r) => r.OscTerimaDate && r.TarikhC1Date && r.TarikhC1Date < r.OscTerimaDate).length, label: "TARIKH C1 sebelum OSC TERIMA", severity: "bad" }
    ];
    dom.qualityGrid.innerHTML = metrics.map((metric) => `<div class="quality-item ${metric.value === 0 ? "good" : metric.severity}"><strong>${formatNumber(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></div>`).join("");
  }

  function setSelectFilter(select, value) {
    select.value = select.value === value ? "" : value;
    applyFilters(true);
    select.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function scheduleSyncToGrist(immediate) {
    if (state.mode !== "grist" || !dom.syncToggle.checked || !window.grist) return;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      const ids = state.filtered.map((record) => record.id).filter((id) => id != null);
      const selection = state.filtered.length === state.all.length ? null : ids;
      window.grist.setSelectedRows(selection).then(() => {
        if (immediate) showToast("Penapis dashboard telah diselaraskan kepada widget Grist dipautkan.");
      }).catch(() => showToast("Penapis tidak dapat diselaraskan kepada widget dipautkan."));
    }, immediate ? 0 : 220);
  }

  function exportFilteredCsv() {
    const headers = [
      "PEMAJU", "PERMOHONAN", "PINDAAN", "PERUNDING", "LOT", "MUKIM", "NO. RUJ. PKM", "OSC TERIMA",
      "TUNAI SYARAT", "BENTANG OSC", "BIL. OSC", "TARIKH OSC", "KEPUTUSAN", "STATUS TUNAI SYARAT",
      "TARIKH C1", "LATITUDE", "LONGITUDE", "OSC TERIMA KE C1 (HARI)", "TARIKH OSC KE C1 (HARI)"
    ];
    const rows = state.filtered.map((record) => [
      record.Pemaju, record.Permohonan, record.Pindaan, record.Perunding, record.Lot, record.Mukim,
      record.NoRujPKM, isoDate(record.OscTerimaDate), record.TunaiSyarat, record.BentangOSC, record.BilOSC,
      isoDate(record.TarikhOSCDate), record.Keputusan, record.StatusTunaiSyarat, isoDate(record.TarikhC1Date),
      Number.isFinite(record.LatNum) ? record.LatNum : "", Number.isFinite(record.LonNum) ? record.LonNum : "",
      Number.isFinite(record.DaysReceivedToC1) ? record.DaysReceivedToC1 : "", Number.isFinite(record.DaysOscToC1) ? record.DaysOscToC1 : ""
    ]);
    const csv = "\ufeff" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `PKM_SPS_ANALISIS_${compactDate(new Date())}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${formatNumber(rows.length)} rekod ditapis telah dieksport.`);
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

  function topEntry(map) {
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0] || null;
  }

  function classifyDecision(value) {
    const text = normalizeSearch(textValue(value));
    if (!text) return "pending";
    if (/tarik\s*balik|ditarik\s*balik|withdraw/.test(text)) return "withdrawn";
    if (/tidak\s*(diluluskan|lulus)|ditolak|tolak|gagal/.test(text)) return "rejected";
    if (/lulus|diluluskan|kelulusan|tiada\s+halangan/.test(text)) return "approved";
    if (/dalam\s+(proses|pertimbangan)|belum\s+(ada\s+)?keputusan|menunggu|pending/.test(text)) return "pending";
    return "other";
  }

  function classifyCompliance(value) {
    const text = normalizeSearch(textValue(value));
    if (/selesai/.test(text)) return "Selesai";
    if (/pematuhan\s+tunai\s+syarat|permatuhan\s+tunai\s+syarat/.test(text)) return "Pematuhan Tunai Syarat";
    if (/pending|menunggu/.test(text)) return "Pending";
    return "Lain-lain";
  }

  function validCoordinates(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0 && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function parseDate(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 1e12) return validDate(new Date(value));
      if (value > 1e9) return validDate(new Date(value * 1000));
      if (value > 20000 && value < 90000) return validDate(new Date(Math.round((value - 25569) * 86400 * 1000)));
      return null;
    }
    const text = String(value).trim();
    let match = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)(?:\s|T|$)/);
    if (match) return validDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    match = text.match(/^([0-3]?\d)[-\/]([01]?\d)[-\/](\d{4})(?:\s|$)/);
    if (match) return validDate(new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12));
    return validDate(new Date(text));
  }

  function validDate(date) { return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null; }

  function daysBetween(start, end) {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUtc - startUtc) / 86400000);
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function toNumber(value) {
    if (typeof value === "number") return value;
    if (value == null || value === "") return NaN;
    const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
    return Number(normalized);
  }

  function textValue(value) {
    if (value == null) return "";
    if (value instanceof Date) return isoDate(value);
    if (Array.isArray(value)) {
      const items = value[0] === "L" ? value.slice(1) : value;
      return items.map(textValue).filter(Boolean).join(", ");
    }
    if (typeof value === "boolean") return value ? "Ya" : "Tidak";
    return String(value).trim();
  }

  function normalizeKey(value) { return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function normalizeSearch(value) { return String(value || "").toLocaleLowerCase("ms").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); }
  function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

  function formatMonthKey(key, compact = false) {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("ms-MY", { month: compact ? "short" : "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  }

  function formatDate(date) {
    if (!date) return "–";
    return new Intl.DateTimeFormat("ms-MY", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function isoDate(date) {
    if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function compactDate(date) { return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`; }
  function formatNumber(value) { return new Intl.NumberFormat("ms-MY", { maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function formatPercent(value, total) { return total ? `${Math.round((value / total) * 100)}%` : "0%"; }

  function donutPath(cx, cy, outer, inner, startAngle, endAngle) {
    const safeEnd = endAngle - startAngle >= Math.PI * 2 ? startAngle + Math.PI * 2 - 0.00001 : endAngle;
    const p1 = polar(cx, cy, outer, startAngle);
    const p2 = polar(cx, cy, outer, safeEnd);
    const p3 = polar(cx, cy, inner, safeEnd);
    const p4 = polar(cx, cy, inner, startAngle);
    const large = safeEnd - startAngle > Math.PI ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${outer} ${outer} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${inner} ${inner} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
  }

  function polar(cx, cy, radius, angle) { return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }; }

  function setEmpty(container, message) { container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`; }

  function csvCell(value) {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }
  function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
  function escapeXml(value) { return escapeHtml(value).replace(/'/g, "&apos;"); }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.remove("show"), 2800);
  }
})();
