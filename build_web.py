"""Build the static screener from the published company CSV."""

import argparse
from base64 import b64encode
import csv
from collections import defaultdict
import json
from pathlib import Path
from string import Template

from engine import read_workbook, schema_issues, screen


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "stocks.csv"
LATEST_DATA = ROOT / "data" / "latest.csv"
WORKSHEET = "Cleaned 5-Point DuPont"


def refresh_data(workbook):
    sheets = read_workbook(workbook.name, workbook.read_bytes())
    sheet = next((sheet for sheet in sheets if sheet.name == WORKSHEET), None)
    if sheet is None or schema_issues(sheet):
        raise ValueError(f"Expected a complete {WORKSHEET} worksheet")
    columns = ("company", "ticker", "sector", "cap_category", "revenue", "ebit",
               "ebt", "net_income", "closing_assets", "closing_equity")
    indices = [sheet.mapping[column] for column in columns]
    DATA.parent.mkdir(exist_ok=True)
    with DATA.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file, lineterminator="\n")
        writer.writerow(sheet.headers[index] for index in indices)
        writer.writerows([cells[index] for index in indices] for _, cells in sheet.rows)


def build(data_file, output_dir=ROOT, *, require_original_universe=False):
    sheets = read_workbook(data_file.name, data_file.read_bytes())
    if data_file.suffix.lower() == ".xlsx":
        sheet = next((sheet for sheet in sheets if sheet.name == WORKSHEET), None)
        if sheet is None:
            raise ValueError(f"Expected the {WORKSHEET} worksheet")
    else:
        sheet, = sheets
    issues = schema_issues(sheet)
    if issues:
        raise ValueError(", ".join(issues))
    if "Reporting period" in sheet.headers:
        records = {line: dict(zip(sheet.headers, cells)) for line, cells in sheet.rows}
        cohorts = defaultdict(list)
        for line, cells in sheet.rows:
            record = records[line]
            cohorts[record["Reporting period"], record["Period end"]].append((line, cells))
        rows = []
        for entries in cohorts.values():
            cohort = type(sheet)(sheet.name, sheet.headers, entries, sheet.mapping)
            results, _ = screen(cohort)
            for row in results:
                record = records[row["line"]]
                row["filing"] = {
                    "period": record["Reporting period"], "end": record["Period end"],
                    "scope": record["Reporting scope"], "note": record["Filing note"],
                    "sources": [record[key] for key in ("Filing URL", "Annual filing URL", "Prior filing URL")],
                }
                row["inputs"] = {}
                for label, column in (
                    ("Revenue", "Revenue"), ("EBIT", "EBIT"), ("EBT", "EBT"), ("Net income", "Net Income"),
                    ("Average assets", "Average Total Assets"), ("Average equity", "Average Shareholders Equity"),
                ):
                    amount = record[column + " (INR Cr)"]
                    if not amount and label.startswith("Average "):
                        column = "Total Assets" if label == "Average assets" else "Total Equity"
                        label = "Period-end assets" if label == "Average assets" else "Period-end equity"
                        amount = record[column + " (INR Cr)"]
                    row["inputs"][label] = float(amount) if amount else None
                rows.append(row)
        rows.sort(key=lambda row: row["line"])
        period_labels = {row["filing"]["period"] for row in rows if row["filing"]["period"]}
        source = next(iter(period_labels)) if len(period_labels) == 1 else "Financial filings"
        disclosure = (
            "Sector comparisons use the same reporting period and end date. "
            "Open a company to see its peer count, financial inputs, and source links."
        )
    else:
        rows, _ = screen(sheet)
        source = "Cleaned 5-Point DuPont"
        disclosure = "Period-end assets and equity are used where average balances are unavailable. See company details for row notes."
    if any(not row["ticker"] for row in rows) or len({row["ticker"] for row in rows}) != len(rows):
        raise ValueError("The published dataset needs one row per ticker")
    if require_original_universe:
        with DATA.open(encoding="utf-8", newline="") as handle:
            original = {row["NSE Symbol"] for row in csv.DictReader(handle)}
        if len(original) != 150 or {row["ticker"] for row in rows} != original:
            raise ValueError("The update must contain the original 150 tickers")
        unrated = [row["ticker"] for row in rows if row["verdict"] == "Unrated"]
        if unrated:
            raise ValueError("Check missing or invalid inputs for: " + ", ".join(unrated))
    fields = ("company", "ticker", "sector", "sector_key", "cap", "ratios", "verdict",
              "invalid_equity", "rule", "reason", "cards", "roa_median", "peer_count", "notes", "line")
    data = {"source": source, "rows": [
        {key: row[key] for key in (*fields, "filing", "inputs") if key in row} for row in rows
    ]}
    payload = json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":")).replace("<", "\\u003c")
    styles = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in ("app.css", "screen.css", "web.css"))
    script = (ROOT / "screen.js").read_text(encoding="utf-8").replace("export default function (", "function mountScreen(", 1)
    template = Template((ROOT / "web.html").read_text(encoding="utf-8"))
    guide = b64encode((ROOT / "DuPont_Methodology_Guide.pdf").read_bytes()).decode("ascii")
    user_guide = b64encode((ROOT / "DuPont_Website_User_Guide.pdf").read_bytes()).decode("ascii")
    html = template.substitute(styles=styles, screen=(ROOT / "screen.html").read_text(encoding="utf-8"),
                               data=payload, script=script, guide=guide, user_guide=user_guide, disclosure=disclosure)
    output_dir.mkdir(parents=True, exist_ok=True)
    for name in ("index.html", "DuPont-Screener.html"):
        (output_dir / name).write_text(html, encoding="utf-8", newline="\n")
    print(f"Built browser app with {len(rows)} stocks")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, help="Refresh data/stocks.csv from the cleaned workbook")
    args = parser.parse_args()
    if args.workbook:
        refresh_data(args.workbook)
    build(DATA if args.workbook or not LATEST_DATA.is_file() else LATEST_DATA)
