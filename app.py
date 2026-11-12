"""Run with python -m streamlit run app.py from this directory."""

from pathlib import Path

import streamlit as st

from engine import FIELDS, header_score, read_workbook, schema_issues, screen


HERE = Path(__file__).resolve().parent
st.set_page_config(page_title="DuPont Screener", page_icon="📊", layout="wide")
st.html(HERE / "app.css")

@st.cache_resource(show_spinner=False)
def screen_component(html, css, js):
    return st.components.v2.component("dupont_screen", html=html, css=css, js=js)


render_screen = screen_component(
    html=(HERE / "screen.html").read_text(encoding="utf-8"),
    css=(HERE / "screen.css").read_text(encoding="utf-8"),
    js=(HERE / "screen.js").read_text(encoding="utf-8"),
)

brand, guide = st.columns([4, 1], vertical_alignment="center")
with brand:
    st.html("""
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Equity Research</span>
      </div>
    """)
with guide:
    pdf = HERE / "DuPont_Methodology_Guide.pdf"
    if pdf.is_file():
        st.download_button(
            "Methodology PDF", pdf.read_bytes(), pdf.name, "application/pdf",
            icon=":material/download:", width="stretch", on_click="ignore",
        )

st.html("""
  <section class="hero" aria-labelledby="page-title">
    <div class="hero-copy">
      <span class="hero-kicker"><i></i> LOCAL WORKSPACE</span>
      <h1 id="page-title">DuPont Screener</h1>
      <p>See what drives return on equity and how each company compares with its sector peers.</p>
    </div>
    <div class="hero-formula" aria-label="Return on equity equals tax burden times interest burden times operating margin times asset turnover times equity multiplier">
      <span class="hero-formula-label">RETURN ON EQUITY</span>
      <div class="factor-line" aria-hidden="true">
        <span>Tax</span><b>×</b><span>Interest</span><b>×</b><span>Margin</span><b>×</b><span>Turnover</span><b>×</b><span>Leverage</span>
      </div>
    </div>
  </section>
""")

with st.container(border=True):
    intro, upload = st.columns([2, 3], vertical_alignment="center")
    with intro:
        st.html("""
          <div class="import-intro">
            <span class="import-icon" aria-hidden="true">↑</span>
            <div><strong>Company workbook</strong><p>Upload raw financials or five pre-calculated factors.</p></div>
          </div>
        """)
    with upload:
        file = st.file_uploader("Upload company data", type=["xlsx", "csv"], label_visibility="collapsed")


@st.cache_data(max_entries=6, show_spinner=False)
def load_file(filename, content):
    return read_workbook(filename, content)


if file is None:
    st.info("Upload your company workbook to begin.")
    st.stop()

source_name = file.name
source_id = file.file_id
try:
    sheets = load_file(source_name, file.getvalue())
except Exception as error:
    st.error(f"Could not open {source_name}. {error}")
    st.stop()

valid_sheets = [item for item in sheets if not schema_issues(item)]
if valid_sheets:
    sheets = valid_sheets
sheet = max(sheets, key=lambda item: header_score(item.mapping))
rate_points = False
cutoffs = None
if file is not None:
    with st.expander("Import settings and column mapping"):
        options = st.columns(2)
        if len(sheets) > 1:
            with options[0]:
                chosen = st.selectbox("Excel worksheet", range(len(sheets)), index=sheets.index(sheet),
                                      format_func=lambda index: sheets[index].name, key=f"sheet:{file.file_id}")
                sheet = sheets[chosen]
        with options[1] if len(sheets) > 1 else options[0]:
            if any(field in sheet.mapping for field in ("tax", "interest", "margin")):
                rate_format = st.selectbox(
                    "Unmarked tax, interest and margin values",
                    ("Decimal ratios (0.18 = 18%)", "Percentage points (18 = 18%)"),
                    help="Cells marked as percentages and headers with percent units use those units automatically.",
                )
                rate_points = rate_format.startswith("Percentage")
        if "market_cap" in sheet.mapping:
            method = st.radio("Market cap thresholds", ("Use uploaded distribution", "Enter fixed cutoffs"), horizontal=True,
                              help="Pre-labeled cap categories take priority. Automatic cutoffs use the P33 and P67 of the positive uploaded market caps.")
            if method == "Enter fixed cutoffs":
                low, high = st.columns(2)
                with low:
                    mid = st.number_input("Mid cap minimum (file units)", min_value=0.0, value=None, format="%.6g")
                with high:
                    large = st.number_input("Large cap minimum (file units)", min_value=0.0, value=None, format="%.6g")
                if mid is None or large is None or not 0 < mid < large:
                    st.info("Enter two positive cutoffs with the large-cap minimum above the mid-cap minimum. Automatic cutoffs are active until both are valid.")
                else:
                    cutoffs = (mid, large)

        mapping_rows = [
            {"Field": FIELDS[field][0], "Detected column": sheet.headers[index]}
            for field, index in sheet.mapping.items()
        ]
        if mapping_rows:
            st.dataframe(mapping_rows, hide_index=True, width="stretch")
        else:
            st.info("No recognized headers were found in the first 20 rows.")

    for issue in schema_issues(sheet):
        st.warning(issue)

with st.spinner("Calculating sector benchmarks…", show_time=False):
    rows, (mid, large) = screen(sheet, rate_points=rate_points, cap_cutoffs=cutoffs)

if any("Period-end" in note for row in rows for note in row["notes"]):
    st.caption("Period-end assets or equity were used where average balances were unavailable. Affected rows carry a note in their company details.")
if mid is not None:
    st.caption(f"Market cap cutoffs in file units · Mid ≥ {mid:,.6g} · Large ≥ {large:,.6g}")

render_screen(
    key=f"screen:{source_id}:{sheet.name}",
    data={"rows": rows, "source": source_name},
)
