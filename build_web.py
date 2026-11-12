"""Build the static screener from the published company CSV."""

import argparse
import csv
import json
from pathlib import Path
from string import Template

from engine import read_workbook, schema_issues, screen


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "stocks.csv"
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


def build():
    sheet, = read_workbook(DATA.name, DATA.read_bytes())
    issues = schema_issues(sheet)
    if issues:
        raise ValueError(", ".join(issues))
    rows, _ = screen(sheet)
    if any(not row["ticker"] for row in rows) or len({row["ticker"] for row in rows}) != len(rows):
        raise ValueError("The published dataset needs one row per ticker")
    fields = ("company", "ticker", "sector", "sector_key", "cap", "ratios", "verdict",
              "invalid_equity", "rule", "reason", "cards", "roa_median", "peer_count", "notes", "line")
    data = {"source": "Cleaned 5-Point DuPont", "rows": [{key: row[key] for key in fields} for row in rows]}
    payload = json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":")).replace("<", "\\u003c")
    styles = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in ("app.css", "screen.css", "web.css"))
    script = (ROOT / "screen.js").read_text(encoding="utf-8").replace("export default function (", "function mountScreen(", 1)
    template = Template((ROOT / "web.html").read_text(encoding="utf-8"))
    html = template.substitute(styles=styles, screen=(ROOT / "screen.html").read_text(encoding="utf-8"),
                               data=payload, script=script)
    (ROOT / "index.html").write_text(html, encoding="utf-8", newline="\n")
    print(f"Built browser app with {len(rows)} stocks")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, help="Refresh data/stocks.csv from the cleaned workbook")
    args = parser.parse_args()
    if args.workbook:
        refresh_data(args.workbook)
    build()
