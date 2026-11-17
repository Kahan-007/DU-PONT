const PAGE_SIZE = 15;
const RATIOS = ["tax", "interest", "margin", "turnover", "leverage"];
const PERCENT = new Intl.NumberFormat("en", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MULTIPLE = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DECIMAL = new Intl.NumberFormat("en", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const INTEGER = new Intl.NumberFormat("en");
const COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const VERDICT_COLORS = { Good: "#16a07a", Decent: "#d4940c", Bad: "#d4495a", Unrated: "#94a3b8" };
const VERDICT_ORDER = ["Good", "Decent", "Bad", "Unrated"];
const METRIC_LABELS = {
  tax: "Tax burden", interest: "Interest burden", margin: "Operating margin",
  turnover: "Asset turnover", leverage: "Equity multiplier", roe: "Return on equity",
};
const SCATTER_MODES = {
  operations: { x: "turnover", y: "margin", detail: "Compare how efficiently companies turn assets into sales and sales into operating profit. Operating margin × asset turnover gives operating return on assets." },
  leverage: { x: "leverage", y: "roe", detail: "See how ROE varies with assets per rupee of equity. Look at companies with similar ROE and open their factor breakdowns to see whether they use different levels of leverage." },
  retention: { x: "interest", y: "roe", detail: "Compare ROE with the share of operating profit that remains before tax. Open a company to see how interest burden combines with its other four factors." },
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function format(value, metric) {
  if (value === null) return "—";
  const displayed = Number(value.toPrecision(14));
  if (metric === "turnover" || metric === "leverage") return MULTIPLE.format(displayed) + "×";
  return PERCENT.format(displayed);
}

function valueNode(tag, className, value, metric) {
  const node = element(tag, className, format(value, metric));
  if (value !== null) node.title = `Unrounded ratio ${value}`;
  return node;
}

function withDecimal(node, value, metric) {
  if (value !== null && metric !== "turnover" && metric !== "leverage") {
    node.append(element("small", "ratio-decimal", DECIMAL.format(value)));
  }
  return node;
}

function badge(label) {
  return element("span", "badge " + label.toLowerCase(), label);
}

function countText(count, noun) {
  const label = count === 1 ? noun : noun === "company" ? "companies" : noun + "s";
  return `${INTEGER.format(count)} ${label}`;
}

/* ── Scatter Plot (pure Canvas, no dependencies) ── */
function createScatter(canvas, tooltipEl, legendEl, openCompany) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const PAD = { top: 18, right: 22, bottom: 48, left: 74 };
  let mode = SCATTER_MODES.operations;
  let points = [];
  let hovered = -1;
  let focusedIdx = -1;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setPoints(filteredRows, chartMode) {
    mode = chartMode;
    points = filteredRows
      .filter(r => Number.isFinite(r.ratios[mode.x]) && Number.isFinite(r.ratios[mode.y]))
      .map(r => ({
        row: r,
        x: r.ratios[mode.x],
        y: r.ratios[mode.y],
        color: VERDICT_COLORS[r.verdict] || VERDICT_COLORS.Unrated,
      }));
    hovered = -1;
    focusedIdx = -1;
    tooltipEl.hidden = true;
    canvas.setAttribute("aria-label", `${METRIC_LABELS[mode.y]} vs. ${METRIC_LABELS[mode.x]}, ${countText(points.length, "company")}`);
    draw();
  }

  function draw() {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (w <= PAD.left + PAD.right || h <= PAD.top + PAD.bottom) return;
    const colors = getComputedStyle(canvas);
    ctx.clearRect(0, 0, w, h);
    if (!points.length) {
      canvas._plotLayout = null;
      ctx.fillStyle = colors.getPropertyValue("--muted");
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data points match these filters", w / 2, h / 2);
      return;
    }
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const [xMin, xMax] = plotRange(xs, mode.x);
    const [yMin, yMax] = plotRange(ys, mode.y);
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const toX = v => PAD.left + ((v - xMin) / xRange) * plotW;
    const toY = v => PAD.top + plotH - ((v - yMin) / yRange) * plotH;

    // Grid lines
    ctx.strokeStyle = colors.getPropertyValue("--line");
    ctx.lineWidth = 0.6;
    const xTicks = niceRange(xMin, xMax, w < 500 ? 3 : 6);
    const yTicks = niceRange(yMin, yMax, 6);
    for (const t of xTicks) {
      const px = toX(t);
      ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, PAD.top + plotH); ctx.stroke();
    }
    for (const t of yTicks) {
      const py = toY(t);
      ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(PAD.left + plotW, py); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = colors.getPropertyValue("--muted");
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const t of xTicks) {
      ctx.fillText(format(t, mode.x), toX(t), h - 27);
    }
    ctx.textAlign = "right";
    for (const t of yTicks) {
      ctx.fillText(format(t, mode.y), PAD.left - 6, toY(t) + 4);
    }
    // Axis titles
    ctx.fillStyle = colors.getPropertyValue("--ink");
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(METRIC_LABELS[mode.x], PAD.left + plotW / 2, h - 7);
    ctx.save();
    ctx.translate(12, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(METRIC_LABELS[mode.y], 0, 0);
    ctx.restore();

    // Plot points
    const radius = Math.max(4, Math.min(7, 220 / Math.sqrt(points.length)));
    for (let i = 0; i < points.length; i++) {
      if (i === hovered || i === focusedIdx) continue;
      const p = points[i];
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color + "cc";
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Draw hovered / focused on top
    const activeIdx = hovered >= 0 ? hovered : focusedIdx;
    if (activeIdx >= 0 && activeIdx < points.length) {
      const p = points[activeIdx];
      const px = toX(p.x); const py = toY(p.y);
      ctx.beginPath(); ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = colors.getPropertyValue("--ink");
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Store layout for hit testing
    canvas._plotLayout = { toX, toY, radius, points };
  }

  function plotRange(values, metric) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.06 || Math.max(Math.abs(min) * 0.06, metric === "turnover" || metric === "leverage" ? 0.05 : 0.005);
    return [min - padding, max + padding];
  }

  function niceRange(lo, hi, count) {
    const range = hi - lo || 0.1;
    const rough = range / count;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const nice = rough / mag >= 5 ? 5 * mag : rough / mag >= 2 ? 2 * mag : mag;
    const start = Math.ceil(lo / nice) * nice;
    const ticks = [];
    for (let v = start; v <= hi + nice * 0.01; v += nice) ticks.push(Number(v.toPrecision(8)));
    return ticks;
  }

  function hitTest(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const layout = canvas._plotLayout;
    if (!layout) return -1;
    const { toX, toY, radius, points } = layout;
    let closest = -1, closestDist = (radius + 6) * (radius + 6);
    for (let i = 0; i < points.length; i++) {
      const px = toX(points[i].x), py = toY(points[i].y);
      const dist = (mx - px) ** 2 + (my - py) ** 2;
      if (dist < closestDist) { closest = i; closestDist = dist; }
    }
    return closest;
  }

  function showTooltip(idx, e) {
    if (idx < 0) { tooltipEl.hidden = true; return; }
    const p = points[idx];
    const r = p.row;
    const roe = r.ratios.roe !== null ? format(r.ratios.roe, "roe") : "—";
    const period = r.filing ? [r.filing.period, r.filing.end].filter(Boolean).join(" · ") : "";
    tooltipEl.innerHTML = `<span class="tt-ticker">${esc(r.ticker || r.company)}</span>`
      + `<span class="tt-line">${METRIC_LABELS[mode.x]}: ${format(p.x, mode.x)}</span>`
      + `<span class="tt-line">${METRIC_LABELS[mode.y]}: ${format(p.y, mode.y)}</span>`
      + (mode.y === "roe" ? "" : `<span class="tt-line">ROE: ${roe}</span>`)
      + `<span class="tt-line">${esc(r.verdict)}</span>`
      + (period ? `<span class="tt-line" style="opacity:.7">${esc(period)}</span>` : "");
    tooltipEl.hidden = false;
    const rect = canvas.parentElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const tx = (e ? e.clientX - canvasRect.left : 0) + 14;
    const ty = (e ? e.clientY - canvasRect.top : 0) - 10;
    tooltipEl.style.left = Math.max(0, Math.min(tx, rect.width - tooltipEl.offsetWidth)) + "px";
    tooltipEl.style.top = Math.max(0, Math.min(ty, rect.height - tooltipEl.offsetHeight)) + "px";
  }

  function esc(str) {
    const d = document.createElement("span");
    d.textContent = str;
    return d.innerHTML;
  }

  canvas.addEventListener("mousemove", e => {
    const idx = hitTest(e);
    if (idx !== hovered) { hovered = idx; draw(); showTooltip(idx, e); }
    canvas.style.cursor = idx >= 0 ? "pointer" : "default";
  });
  canvas.addEventListener("mouseleave", () => { hovered = -1; draw(); tooltipEl.hidden = true; canvas.style.cursor = "default"; });
  canvas.addEventListener("click", e => {
    const idx = hitTest(e);
    if (idx >= 0) openCompany(points[idx].row, canvas);
  });

  // Keyboard accessibility
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.addEventListener("keydown", e => {
    if (!points.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusedIdx = (focusedIdx + 1) % points.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusedIdx = focusedIdx <= 0 ? points.length - 1 : focusedIdx - 1;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIdx >= 0) openCompany(points[focusedIdx].row, canvas);
      return;
    } else if (e.key === "Escape") {
      focusedIdx = -1;
    } else return;
    draw();
    if (focusedIdx >= 0) {
      showTooltip(focusedIdx, null);
      const p = points[focusedIdx];
      canvas.setAttribute("aria-label", `${p.row.ticker || p.row.company}, ${METRIC_LABELS[mode.x]} ${format(p.x, mode.x)}, ${METRIC_LABELS[mode.y]} ${format(p.y, mode.y)}, ${p.row.verdict}`);
    } else {
      tooltipEl.hidden = true;
    }
  });

  // Legend
  legendEl.replaceChildren(...VERDICT_ORDER.map(v => {
    const item = element("span", "scatter-legend-item");
    const sw = element("span", "scatter-legend-swatch");
    sw.style.background = VERDICT_COLORS[v];
    item.append(sw, element("span", "", v));
    return item;
  }));

  let resizeTimer;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); draw(); }, 80); };
  window.addEventListener("resize", onResize);
  resize();
  document.addEventListener("dupont-theme-change", draw);
  return { setPoints, resize: () => { resize(); draw(); } };
}

/* ── Verdict Breakdown ── */
function createVerdictBreakdown(container, clearBtn, rows, setVerdictFilter) {
  const total = rows.length;
  const counts = {};
  for (const v of VERDICT_ORDER) counts[v] = 0;
  for (const r of rows) counts[r.verdict] = (counts[r.verdict] || 0) + 1;

  const barRows = [];
  container.replaceChildren();
  for (const v of VERDICT_ORDER) {
    if (counts[v] === 0 && v === "Unrated") continue;
    const row = element("div", "verdict-bar-row");
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-pressed", "false");
    row.dataset.verdict = v;

    const label = element("span", "verdict-bar-label", v);
    label.style.color = VERDICT_COLORS[v];
    const track = element("div", "verdict-bar-track");
    const fill = element("div", `verdict-bar-fill ${v.toLowerCase()}`);
    track.append(fill);
    const count = element("span", "verdict-bar-count", String(counts[v]));

    row.append(label, track, count);
    container.append(row);
    barRows.push({ el: row, verdict: v, fill, countEl: count, baseCount: counts[v] });
  }

  function updateCounts(filteredRows) {
    const fc = {};
    for (const v of VERDICT_ORDER) fc[v] = 0;
    for (const r of filteredRows) fc[r.verdict] = (fc[r.verdict] || 0) + 1;
    const maxCount = Math.max(1, ...Object.values(fc));
    for (const br of barRows) {
      br.countEl.textContent = String(fc[br.verdict] || 0);
      br.fill.style.width = ((fc[br.verdict] || 0) / maxCount * 100) + "%";
    }
  }

  for (const br of barRows) {
    const handler = () => setVerdictFilter(br.verdict);
    br.el.addEventListener("click", handler);
    br.el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); } });
  }

  function setActive(verdict) {
    for (const br of barRows) {
      br.el.setAttribute("aria-pressed", String(br.verdict === verdict));
    }
    clearBtn.hidden = !verdict;
  }

  // Animate initial fill
  requestAnimationFrame(() => {
    const maxCount = Math.max(1, ...VERDICT_ORDER.map(v => counts[v]));
    for (const br of barRows) {
      br.fill.style.width = (br.baseCount / maxCount * 100) + "%";
    }
  });

  return { updateCounts, setActive };
}

/* ── Peer Comparison Table ── */
function buildPeerComparison(row) {
  const section = element("div", "peer-comparison");
  const heading = element("h3", "", "Peer Comparison — Sector Median");
  section.append(heading);

  const peerCount = row.peer_count;
  const period = row.filing ? [row.filing.period, row.filing.end].filter(Boolean).join(" · ") : "";
  if (period) {
    section.append(element("p", "", `${period} · ${countText(peerCount, "peer")}`));
  } else {
    section.append(element("p", "", countText(peerCount, "peer")));
  }

  if (peerCount === 0) {
    section.append(element("p", "no-benchmark", "No same-period sector peers available for comparison."));
    return section;
  }

  const table = element("table", "peer-table");
  const thead = element("thead");
  const hrow = element("tr");
  for (const h of ["Factor", "Company", "Sector Median", "vs Median"]) {
    const th = element("th", h === "Factor" ? "" : "numeric", h);
    hrow.append(th);
  }
  thead.append(hrow);
  table.append(thead);

  const tbody = element("tbody");
  const factorLabels = {
    tax: "Tax Burden", interest: "Interest Burden",
    margin: "Operating Margin", turnover: "Asset Turnover", leverage: "Equity Multiplier"
  };

  for (const key of RATIOS) {
    const tr = element("tr");
    const companyVal = row.ratios[key];
    const card = row.cards[key];
    const medianVal = card.quartiles[1] ?? null;

    tr.append(element("td", "factor-label", factorLabels[key]));

    const compTd = element("td", "numeric company-val");
    compTd.textContent = format(companyVal, key);
    tr.append(compTd);

    const medTd = element("td", "numeric");
    if (medianVal === null) {
      medTd.className = "numeric no-benchmark";
      medTd.textContent = "—";
    } else {
      medTd.textContent = format(medianVal, key);
    }
    tr.append(medTd);

    const diffTd = element("td", "numeric");
    if (companyVal !== null && medianVal !== null) {
      let diff;
      if (key === "turnover" || key === "leverage") {
        diff = companyVal - medianVal;
        diffTd.textContent = (diff >= 0 ? "+" : "") + MULTIPLE.format(diff) + "×";
      } else {
        diff = companyVal - medianVal;
        const diffPct = diff * 100;
        diffTd.textContent = (diffPct >= 0 ? "+" : "") + diffPct.toFixed(2) + " pp";
      }
      // For leverage, lower can be better (less risk), so we don't color it
      if (key !== "leverage") {
        diffTd.classList.add(diff >= 0 ? "above-median" : "below-median");
      }
    } else {
      diffTd.className = "numeric no-benchmark";
      diffTd.textContent = "—";
    }
    tr.append(diffTd);
    tbody.append(tr);
  }
  table.append(tbody);
  section.append(table);
  return section;
}

function drawSectorChart(container, rows, sectors, selected, toggleSector) {
  const totalBySector = new Map();
  for (const row of rows) {
    if (!totalBySector.has(row.sector_key)) totalBySector.set(row.sector_key, new Map());
    const counts = totalBySector.get(row.sector_key);
    counts.set(row.verdict, (counts.get(row.verdict) || 0) + 1);
  }
  container.replaceChildren(...sectors.map(([key, label]) => {
    const counts = totalBySector.get(key) || new Map();
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const button = element("button", "sector-bar");
    button.type = "button";
    button.setAttribute("aria-pressed", String(selected.has(key)));
    button.onclick = () => toggleSector(key, button);
    const heading = element("span", "sector-bar-heading");
    heading.append(element("strong", "", label), element("span", "", countText(total, "stock")));
    const track = element("span", "sector-track");
    track.setAttribute("aria-hidden", "true");
    const detail = VERDICT_ORDER.filter(verdict => counts.has(verdict)).map(verdict => {
      const count = counts.get(verdict);
      const segment = element("span");
      segment.style.width = (count / total * 100) + "%";
      segment.style.backgroundColor = VERDICT_COLORS[verdict];
      track.append(segment);
      return `${count} ${verdict}`;
    }).join(" · ");
    button.append(heading, track, element("span", "sector-detail", detail || "No matches"));
    return button;
  }));
}

function compareCompanies(container, left, right) {
  if (!left || !right) {
    container.replaceChildren(element("p", "comparison-empty", "Select both companies to see the comparison."));
    return;
  }
  if (left === right) {
    container.replaceChildren(element("p", "comparison-empty", "Select a different company to compare."));
    return;
  }
  const period = row => row.filing ? [row.filing.period, row.filing.end].filter(Boolean).join(" · ") : "Period unavailable";
  const headings = element("div", "comparison-headings");
  for (const row of [left, right]) {
    const card = element("div", "comparison-company");
    card.append(element("strong", "", row.company), badge(row.verdict),
      element("span", "", `${row.ticker || row.company} · ${period(row)}`));
    headings.append(card);
  }
  container.replaceChildren(headings);
  if (!left.filing || !right.filing || period(left) !== period(right)) {
    container.append(element("p", "comparison-period", "Check the time spans above. ROE and asset turnover can differ simply because the reporting periods differ."));
  }
  for (const metric of [...RATIOS, "roe"]) {
    const values = [left.ratios[metric], right.ratios[metric]];
    const min = Math.min(0, ...values.filter(Number.isFinite));
    const max = Math.max(0, ...values.filter(Number.isFinite));
    const range = max - min || 1;
    const zero = (0 - min) / range * 100;
    const group = element("section", "comparison-factor");
    group.append(element("h4", "", METRIC_LABELS[metric]));
    values.forEach((value, index) => {
      const row = element("div", "comparison-bar-row");
      const ticker = [left, right][index];
      const track = element("span", "comparison-track");
      track.setAttribute("aria-hidden", "true");
      if (Number.isFinite(value)) {
        const fill = element("span", index === 0 ? "comparison-a" : "comparison-b");
        fill.style.left = Math.min(zero, (value - min) / range * 100) + "%";
        fill.style.width = Math.abs(value) / range * 100 + "%";
        track.append(fill);
      }
      row.append(element("span", "comparison-ticker", ticker.ticker || ticker.company), track,
        withDecimal(valueNode("span", "comparison-value", value, metric), value, metric));
      group.append(row);
    });
    container.append(group);
  }
}

export default function ({ parentElement, data }) {
  const root = parentElement.querySelector(".screen");
  const find = (selector) => root.querySelector(selector);
  const rows = data.rows.map((row, index) => ({ ...row, index }));
  const activeSectors = new Set();
  const filters = { cap: "All", verdict: "All" };
  let page = 0;
  let sort = { key: "roe", descending: true };
  const body = find("tbody");
  const dialog = find(".drawer");
  const search = find("#company-search");
  const sectorPicker = find(".sector-picker");
  const chartControl = find(".chart-mode");
  const comparisonSelects = [...root.querySelectorAll(".comparison-select")];
  let selectedCompany = null;

  find(".dataset").replaceChildren(
    element("span", "source-tag", data.source),
    element("span", "", countText(new Set(rows.map((row) => row.sector_key).filter(Boolean)).size, "sector")),
  );
  const unrated = rows.filter((row) => row.verdict === "Unrated").length;
  if (unrated) find(".dataset").append(element("span", "", `${INTEGER.format(unrated)} unrated`));

  // ── Scatter plot ──
  const scatter = createScatter(
    find(".scatter-canvas"),
    find(".scatter-tooltip"),
    find(".scatter-legend"),
    openCompany
  );
  chartControl.onchange = render;
  for (const tab of root.querySelectorAll("[data-view]")) {
    tab.onclick = () => {
      const view = tab.dataset.view;
      for (const item of root.querySelectorAll("[data-view]")) {
        item.setAttribute("aria-pressed", String(item === tab));
      }
      for (const panel of root.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== view;
      if (view === "overview") scatter.resize();
    };
  }
  const sortedCompanies = rows.slice().sort((a, b) => COLLATOR.compare(a.company, b.company));
  for (const select of comparisonSelects) {
    for (const row of sortedCompanies) {
      const option = element("option", "", row.ticker ? `${row.company} · ${row.ticker}` : row.company);
      option.value = String(row.index);
      select.append(option);
    }
    select.onchange = () => {
      compareCompanies(find(".comparison-results"),
        ...comparisonSelects.map(input => input.value === "" ? null : rows[Number(input.value)]));
    };
  }
  compareCompanies(find(".comparison-results"), null, null);

  // ── Verdict breakdown ──
  function setVerdictFilterFromBreakdown(verdict) {
    if (filters.verdict === verdict) {
      filters.verdict = "All";
    } else {
      filters.verdict = verdict;
    }
    syncVerdictButtons();
    verdictBreakdown.setActive(filters.verdict === "All" ? null : filters.verdict);
    resetPage();
  }
  const verdictBreakdown = createVerdictBreakdown(
    find(".verdict-bars"),
    find(".clear-verdict-filter"),
    rows,
    setVerdictFilterFromBreakdown
  );
  find(".clear-verdict-filter").onclick = () => {
    filters.verdict = "All";
    syncVerdictButtons();
    verdictBreakdown.setActive(null);
    resetPage();
  };

  function syncVerdictButtons() {
    const target = find('[data-filter="verdict"]');
    for (const btn of target.children) {
      btn.setAttribute("aria-pressed", String(btn.textContent === filters.verdict || (filters.verdict === "All" && btn.textContent === "All")));
    }
  }

  // ── Sort / compare ──
  function compareRows(a, b) {
    const { key, descending } = sort;
    const direction = descending ? -1 : 1;
    if (key === "company") return direction * COLLATOR.compare(a.company, b.company);
    const left = a.ratios[key];
    const right = b.ratios[key];
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    return direction * (left - right) || COLLATOR.compare(a.company, b.company);
  }

  // ── Table row ──
  function renderRow(row) {
    const tr = element("tr");
    tr.dataset.index = row.index;
    const company = element("td", "company-cell");
    const open = element("button", "company-name", row.company);
    open.type = "button";
    open.setAttribute("aria-haspopup", "dialog");
    company.append(open);
    if (row.ticker && row.ticker !== row.company) company.append(element("span", "ticker", row.ticker));
    if (row.filing) {
      company.append(element("span", "filing-period", [row.filing.period, row.filing.end].filter(Boolean).join(" · ")));
    }
    const cap = element("td", "cap-cell");
    cap.append(element("span", "cap-label", row.cap));
    tr.append(company, element("td", "sector-cell", row.sector), cap);
    for (const key of [...RATIOS, "roe"]) {
      const value = row.ratios[key];
      tr.append(withDecimal(valueNode("td", key === "roe" ? "numeric roe" : "numeric", value, key), value, key));
    }
    const verdict = element("td", "verdict-cell");
    verdict.append(badge(row.verdict), element("span", "row-arrow", "›"));
    if (row.invalid_equity) verdict.append(element("span", "verdict-note", row.rule));
    verdict.title = row.rule;
    tr.append(verdict);
    return tr;
  }

  function getFiltered(includeVerdict = true) {
    const query = search.value.trim().toLowerCase();
    return rows.filter((row) =>
      (!activeSectors.size || activeSectors.has(row.sector_key))
      && (filters.cap === "All" || row.cap === filters.cap)
      && (!includeVerdict || filters.verdict === "All" || row.verdict === filters.verdict)
      && (!query || `${row.company} ${row.ticker}`.toLowerCase().includes(query))
    );
  }

  // ── Main render ──
  function render() {
    const filtered = getFiltered().sort(compareRows);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, filtered.length);
    body.replaceChildren(...filtered.slice(start, end).map(renderRow));
    if (!filtered.length) {
      const row = element("tr");
      const message = element("td", "empty", rows.length ? "No companies match these filters." : "There are no company rows in this sheet.");
      message.colSpan = 10;
      row.append(message);
      body.append(row);
    }
    find(".local-count").textContent = `${INTEGER.format(filtered.length)} of ${INTEGER.format(rows.length)} companies`;
    find(".page-range").textContent = filtered.length
      ? `Showing ${INTEGER.format(start + 1)}–${INTEGER.format(end)} of ${INTEGER.format(filtered.length)}`
      : "Showing 0 companies";
    find(".page-index").textContent = `${page + 1} / ${pages}`;
    find(".prev").disabled = page === 0;
    find(".next").disabled = page + 1 >= pages;
    find(".reset-filters").hidden = !(activeSectors.size || search.value || filters.cap !== "All" || filters.verdict !== "All");
    for (const button of root.querySelectorAll("[data-sort]")) {
      const current = button.dataset.sort === sort.key;
      button.parentElement.setAttribute("aria-sort", current ? (sort.descending ? "descending" : "ascending") : "none");
    }

    const mode = SCATTER_MODES[chartControl.value];
    find(".scatter-description").textContent = mode.detail;
    scatter.setPoints(filtered, mode);
    verdictBreakdown.updateCounts(getFiltered(false));
    drawSectorChart(find(".sector-chart"), filtered, sectorLabels, activeSectors, toggleSector);
  }

  function resetPage() {
    page = 0;
    render();
  }

  // ── Sector picker ──
  const sectorMenu = find(".sector-menu");
  const clearSectors = element("button", "clear-sectors", "Clear selection");
  clearSectors.type = "button";
  const sectorOptions = new Map(rows.map((row) => [row.sector_key, row.sector]));
  const sectorLabels = [...sectorOptions].sort((a, b) => COLLATOR.compare(a[1], b[1]));
  const sectorInputs = sectorLabels.map(([key, name]) => {
    const label = element("label", "sector-option");
    const input = element("input");
    input.type = "checkbox";
    input.addEventListener("change", () => {
      if (input.checked) activeSectors.add(key);
      else activeSectors.delete(key);
      updateSectors();
    });
    label.append(input, element("span", "", name));
    sectorMenu.append(label);
    return input;
  });
  sectorMenu.prepend(clearSectors);

  function toggleSector(key, opener) {
    if (activeSectors.size === 1 && activeSectors.has(key)) activeSectors.clear();
    else {
      activeSectors.clear();
      activeSectors.add(key);
    }
    for (const [index, [sector]] of sectorLabels.entries()) {
      sectorInputs[index].checked = activeSectors.has(sector);
    }
    const index = [...opener.parentElement.children].indexOf(opener);
    updateSectors();
    find(".sector-chart").children[index]?.focus({ preventScroll: true });
  }

  function updateSectors() {
    const active = activeSectors.size;
    find("#sector-summary").textContent = active === 0 ? "All sectors" :
      active === 1 ? sectorOptions.get([...activeSectors][0]) : `${active} sectors selected`;
    resetPage();
  }

  clearSectors.onclick = () => {
    for (const input of sectorInputs) input.checked = false;
    activeSectors.clear();
    updateSectors();
  };
  root.onclick = (event) => {
    if (!sectorPicker.contains(event.target)) sectorPicker.open = false;
  };
  sectorPicker.onkeydown = (event) => {
    if (event.key === "Escape") {
      sectorPicker.open = false;
      find(".sector-picker summary").focus();
    }
  };

  // ── Filter buttons ──
  const choices = {
    cap: ["All", "Large Cap", "Mid Cap", "Small Cap"],
    verdict: ["All", "Good", "Decent", "Bad", ...(unrated ? ["Unrated"] : [])],
  };
  for (const [filter, values] of Object.entries(choices)) {
    const target = find(`[data-filter="${filter}"]`);
    target.replaceChildren(...values.map((value) => {
      const button = element("button", "", value);
      button.type = "button";
      button.setAttribute("aria-pressed", String(value === "All"));
      button.onclick = () => {
        filters[filter] = value;
        for (const item of target.children) item.setAttribute("aria-pressed", String(item === button));
        if (filter === "verdict") {
          verdictBreakdown.setActive(value === "All" ? null : value);
          find(".clear-verdict-filter").hidden = value === "All";
        }
        resetPage();
      };
      return button;
    }));
  }
  find(".reset-filters").onclick = () => {
    search.value = "";
    filters.cap = "All";
    filters.verdict = "All";
    for (const button of root.querySelectorAll("[data-filter] button")) {
      button.setAttribute("aria-pressed", String(button.textContent === "All"));
    }
    verdictBreakdown.setActive(null);
    clearSectors.click();
    search.focus();
  };

  // ── Ratio card (existing logic preserved) ──
  function ratioCard(row, key) {
    const card = row.cards[key];
    const section = element("section", "ratio-card");
    const heading = element("div", "ratio-heading");
    heading.append(element("h3", "", card.label), badge(card.status));
    const median = card.quartiles[1] ?? null;
    const summary = median === null ? "Sector median unavailable" : `vs ${format(median, key)} sector median`;
    const peerComparison = element("p", "median", summary);
    if (card.band && card.band !== "Unscored") peerComparison.append(element("span", "band", card.band));
    section.append(
      heading, withDecimal(valueNode("div", "ratio-value", row.ratios[key], key), row.ratios[key], key), peerComparison,
      element("p", "ratio-description", card.description), element("p", "diagnostic", card.detail),
    );
    if (card.quartiles.length) {
      const benchmarks = element("div", "quartiles");
      for (const [index, percentile] of ["P25", "P50", "P75"].entries()) {
        const item = element("span");
        item.append(element("small", "", percentile), valueNode("b", "", card.quartiles[index], key));
        benchmarks.append(item);
      }
      section.append(benchmarks);
    }
    return section;
  }

  // ── Company details drawer ──
  function openCompany(row, opener) {
    selectedCompany = opener;
    find(".company-meta").textContent = [row.ticker === row.company ? "" : row.ticker, row.sector, row.cap].filter(Boolean).join("  /  ");
    find("#drawer-title").textContent = row.company;
    find(".rule-heading").replaceChildren(badge(row.verdict), element("strong", "", row.rule));
    find(".rule-reason").textContent = row.reason;
    const metrics = [
      ["Return on equity", row.ratios.roe, "roe"],
      ["Operating ROA", row.ratios.roa, "roa"],
    ];
    const headline = find(".headline-metrics");
    headline.replaceChildren(...metrics.map(([label, value, key]) => {
      const group = element("div");
      group.append(element("span", "", label), withDecimal(valueNode("b", "", value, key), value, key));
      if (key === "roa" && row.roa_median !== null) {
        group.append(element("span", "", `Sector median ${format(row.roa_median, "roa")}`));
      }
      return group;
    }));
    const peerCount = element("div");
    peerCount.append(element("span", "", row.filing ? "Same-period sector sample" : "Sector sample"),
      element("b", "", countText(row.peer_count, "row")));
    headline.append(peerCount);
    find(".ratio-grid").replaceChildren(...RATIOS.map((key) => ratioCard(row, key)));

    find(".peer-slot").replaceChildren(buildPeerComparison(row));
    for (const section of dialog.querySelectorAll(".drawer-section")) section.open = false;

    const notes = find(".row-notes");
    notes.replaceChildren();
    if (row.filing) {
      const filing = row.filing;
      const period = [filing.period, filing.end, filing.scope].filter(Boolean).join(" · ");
      notes.append(element("p", "source-row", period));
      if (filing.note) notes.append(element("p", "", filing.note));
      const sources = element("div", "filing-sources");
      filing.sources.forEach((url, index) => {
        if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) return;
        let label = "Filing Link";
        if (url.includes("nsearchives.nseindia.com")) {
          label = "NSE Integrated Filing";
        } else if (url.includes("bseindia.com")) {
          label = "BSE Statutory Filing";
        } else if (index === 0) {
          label = "Official IR Portal";
        } else {
          label = `Source #${index + 1}`;
        }
        const link = element("a", "", label);
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        sources.append(link);
      });
      if (sources.children.length) notes.append(sources);
      const inputs = element("dl", "filing-inputs");
      for (const [label, amount] of Object.entries(row.inputs)) {
        const group = element("div");
        group.append(element("dt", "", label), element("dd", "", amount === null ? "—" : MULTIPLE.format(amount)));
        inputs.append(group);
      }
      notes.append(element("p", "source-row", "Financial inputs (₹ crore)"), inputs);
    } else {
      notes.append(element("p", "source-row", `Source row ${row.line}`));
    }
    if (row.notes.length) {
      const list = element("ul");
      for (const note of row.notes) list.append(element("li", "", note));
      notes.append(list);
    }
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  // ── Event handlers ──
  body.onclick = (event) => {
    const row = event.target.closest("tr[data-index]");
    if (row) openCompany(rows[Number(row.dataset.index)], row.querySelector("button"));
  };
  dialog.onclick = (event) => {
    if (event.target === dialog) dialog.close();
  };
  dialog.onclose = () => selectedCompany?.focus({ preventScroll: true });
  find(".close").onclick = () => dialog.close();
  search.value = "";
  search.oninput = resetPage;
  for (const button of root.querySelectorAll("[data-sort]")) {
    button.onclick = () => {
      const key = button.dataset.sort;
      sort = { key, descending: sort.key === key ? !sort.descending : key !== "company" };
      resetPage();
    };
  }
  find(".prev").onclick = () => { page -= 1; render(); };
  find(".next").onclick = () => { page += 1; render(); };
  render();
}
