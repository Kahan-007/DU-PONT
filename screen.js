const PAGE_SIZE = 15;
const RATIOS = ["tax", "interest", "margin", "turnover", "leverage"];
const PERCENT = new Intl.NumberFormat("en", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MULTIPLE = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INTEGER = new Intl.NumberFormat("en");
const COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

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

function badge(label) {
  return element("span", "badge " + label.toLowerCase(), label);
}

function countText(count, noun) {
  return `${INTEGER.format(count)} ${noun}${count === 1 ? "" : "s"}`;
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
  let selectedCompany = null;

  const stats = [
    ["Companies", rows.length, "all"],
    ...["Good", "Decent", "Bad"].map((label) =>
      [label, rows.filter((row) => row.verdict === label).length, label.toLowerCase()]),
  ];
  find(".stat-grid").replaceChildren(...stats.map(([label, count, color]) => {
    const card = element("div", "stat");
    const heading = element("div", "stat-label");
    heading.append(element("i", `dot ${color}`), element("span", "", label));
    card.append(heading, element("strong", "stat-number", INTEGER.format(count)));
    return card;
  }));
  find(".dataset").replaceChildren(
    element("span", "source-tag", data.source),
    element("span", "", countText(new Set(rows.map((row) => row.sector_key).filter(Boolean)).size, "sector")),
  );
  const unrated = rows.filter((row) => row.verdict === "Unrated").length;
  if (unrated) find(".dataset").append(element("span", "", `${INTEGER.format(unrated)} unrated`));

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

  function renderRow(row) {
    const tr = element("tr");
    tr.dataset.index = row.index;
    const company = element("td", "company-cell");
    const open = element("button", "company-name", row.company);
    open.type = "button";
    open.setAttribute("aria-haspopup", "dialog");
    company.append(open);
    if (row.ticker && row.ticker !== row.company) company.append(element("span", "ticker", row.ticker));
    const cap = element("td", "cap-cell");
    cap.append(element("span", "cap-label", row.cap));
    tr.append(company, element("td", "sector-cell", row.sector), cap);
    for (const key of [...RATIOS, "roe"]) {
      tr.append(valueNode("td", key === "roe" ? "numeric roe" : "numeric", row.ratios[key], key));
    }
    const verdict = element("td", "verdict-cell");
    verdict.append(badge(row.verdict), element("span", "row-arrow", "›"));
    if (row.invalid_equity) verdict.append(element("span", "verdict-note", row.rule));
    verdict.title = row.rule;
    tr.append(verdict);
    return tr;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const filtered = rows.filter((row) =>
      (!activeSectors.size || activeSectors.has(row.sector_key))
      && (filters.cap === "All" || row.cap === filters.cap)
      && (filters.verdict === "All" || row.verdict === filters.verdict)
      && (!query || `${row.company} ${row.ticker}`.toLowerCase().includes(query))
    ).sort(compareRows);
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
    for (const button of root.querySelectorAll("[data-sort]")) {
      const current = button.dataset.sort === sort.key;
      button.parentElement.setAttribute("aria-sort", current ? (sort.descending ? "descending" : "ascending") : "none");
    }
  }

  function resetPage() {
    page = 0;
    render();
  }

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
        resetPage();
      };
      return button;
    }));
  }

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
      heading, valueNode("div", "ratio-value", row.ratios[key], key), peerComparison,
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
      group.append(element("span", "", label), valueNode("b", "", value, key));
      if (key === "roa" && row.roa_median !== null) {
        group.append(element("span", "", `Sector median ${format(row.roa_median, "roa")}`));
      }
      return group;
    }));
    const peerCount = element("div");
    peerCount.append(element("span", "", "Sector sample"), element("b", "", countText(row.peer_count, "row")));
    headline.append(peerCount);
    find(".ratio-grid").replaceChildren(...RATIOS.map((key) => ratioCard(row, key)));
    const notes = find(".row-notes");
    const sourceRow = element("p", "source-row", `Source row ${row.line}`);
    notes.replaceChildren(sourceRow);
    if (row.notes.length) {
      const list = element("ul");
      for (const note of row.notes) list.append(element("li", "", note));
      notes.append(list);
    }
    dialog.showModal();
    dialog.scrollTop = 0;
  }

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
