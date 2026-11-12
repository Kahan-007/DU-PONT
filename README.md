# DuPont Screener

The Streamlit app calculates the five-factor DuPont identity, compares companies with uploaded sector peers, and shows the rule behind each verdict. The app processes files in memory on your computer and listens on the loopback address.

## Run locally

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
