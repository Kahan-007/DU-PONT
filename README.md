# DuPont Screener

Open the [live screener](https://kahan-007.github.io/DU-PONT/) and select **Download offline app**. Double-click `DuPont-Screener.html` to run it in your browser. The file includes all 150 stocks, the interface, and the methodology PDF. You can move the file anywhere and open it offline.

Use the filters and sortable columns to narrow the results, and select a company to see its ratios and verdict.

The browser app uses `data/latest.csv`, reconciled against [NSE Integrated Filing – Financials](https://www.nseindia.com/companies-listing/corporate-integrated-filing) on 13 November 2026. Each company shows its reporting period, filing links, and financial inputs in ₹ crore. The company universe comes from the original workbook in `data/stocks.csv`.

Trailing 12-month income figures combine the last full year with the current year-to-date figures and subtract the comparable prior-year period. The calculations use average opening and closing balances when both are available. EBIT equals profit before tax plus reported finance costs. Sector benchmarks use companies with the same reporting period and end date. The historical GSPL row uses the September 2025 filing, before its amalgamation into Gujarat Energy.

Run `python build_web.py` to rebuild the site and offline file from the published data. Use `--workbook` to export the cleaned worksheet and build the original workbook view.

## Screen your own file

The optional Streamlit app calculates the same ratios for an uploaded file and listens on the loopback address.

Clone this repository and run the following commands from its root with Python 3.11 or newer. On systems that expose Python as `python3`, use that command in both lines.

```powershell
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

Open the Local URL printed in the terminal. The default is `http://127.0.0.1:8501`. Upload your own `.xlsx` or `.csv` file to populate the screener. Press Ctrl+C in the terminal to stop the server.

## Prepare a file

| Use case | Accepted columns |
| --- | --- |
| Identity and peer group | Company Name or Ticker, and Sector or Industry |
| Raw financials | Revenue, EBIT, EBT, Net Income, Average Total Assets, Average Shareholders’ Equity |
| Pre-calculated factors | Tax Burden, Interest Burden, Operating Margin, Asset Turnover, Equity Multiplier |
| Optional cap size | Market Cap or Cap Category with Large, Mid, or Small |

The app recognizes common financial aliases, including `NSE Symbol`, `EBT (Pretax)`, and columns with units such as `Revenue (INR Cr)`. It looks for headers within the first 20 rows. Use one row per company, aligned periods, and consistent statement and market cap units. Save Excel formula results before import. Blank or unreadable cells are identified in the company details.

Raw inputs take priority for each factor where both underlying amounts are available. The app uses period-end assets and equity as flagged proxies when the corresponding averages are missing. For a pre-calculated file, rates can be decimals such as `0.18`, text such as `18%`, Excel percentage cells, or percentage points selected in **Import settings and column mapping**. Turnover and leverage use multiples such as `1.25` or `1.25x`.

The app opens the worksheet with the most recognized fields by default and offers a sheet selector for multi-sheet workbooks. Recognized cap labels take priority. For numeric market caps, the default mid- and large-cap minimums are the 33rd and 67th percentiles of positive values in the selected dataset. Values equal to a cutoff enter the higher bucket. Fixed cutoffs can be entered in the file’s units. Rows without a recognized label or positive numeric cap are Unclassified.

## Interpret results

The percentile cutoffs are computed once on the comparable rows of the selected sheet before any screen filters. The 70th-percentile cutoff is inclusive, and numerical ties at thresholds are preserved within floating-point tolerance. The company drawer shows sector medians, quartiles, peer sample size, the matching rule and any data notes.

Non-positive equity suppresses ROE and triggers **Bad · Distressed / Invalid ROE**. Non-positive EBIT or EBT triggers **Bad · Unprofitable Core**. After the overrides, an incomplete row is **Unrated**. A quality compounder needs positive ROE. A qualifying volume trade-off that does not reach Quality Compounder is **Decent · Volume offsets margin**. Comparable profiles outside the named rules are **Decent · Other Comparable Profile**.

The **Methodology PDF** button downloads the included five-page guide. To regenerate it from this folder, install ReportLab and run the generator.

```powershell
python -m pip install reportlab
python build_guide.py
```
