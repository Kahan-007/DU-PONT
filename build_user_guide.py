"""Generate the DuPont Screener operating guide."""

from pathlib import Path

from build_guide import Guide, LEFT, RIGHT, INK, MUTED, TEAL


TITLE = "DuPont Screener | Website User Guide"
SITE = "https://dupont-screener-kahan.appreciativemirth4.chatgpt.site/"
PAGES = (
    ("Navigate the screener", "Find a company, narrow the universe, and read a verdict.",
     (
         ("Start in Overview", "The default view shows the current company count, a scatter plot, and verdict charts. The source label below Company universe identifies the data view. Each company row shows its reporting period where available."),
         ("Filter the universe", "Open Sector to select one or several sectors. Use Market cap and Verdict to narrow the selection. Search matches a company name or ticker. The charts and table update together, and Reset filters brings back the full universe."),
         ("Find and sort companies", "Select Companies to see the table. Click Company or a ratio heading to sort. Click it again to reverse the order. Use Previous and Next to move between pages. Percentages appear with their decimal equivalents, and asset turnover and the equity multiplier appear as multiples."),
         ("Open company details", "Click a company name or select its dot on the scatter plot. The summary shows ROE, operating ROA, the verdict reason, and the same-period sector sample. Open DuPont factor explanations for the individual ratios and Financial inputs and sources to inspect the amounts and links."),
         ("Try it", "Type RELIANCE in Company search, choose Companies, and open Reliance Industries. Read the reporting period and sector sample before interpreting its verdict."),
     )),
    ("Read the charts", "Use the overview to spot patterns and the comparison view to inspect individual differences.",
     (
         ("Margin vs. asset turnover", "Each dot represents a company. Moving right means more sales per unit of assets. Moving up means more operating profit per unit of sales. Multiply the two factors to get operating ROA."),
         ("ROE vs. equity multiplier", "Use Chart view to see how ROE varies with assets per unit of equity. Companies at similar ROE levels can have different financing profiles. Open the dots to compare their other factors."),
         ("ROE vs. interest burden", "Use this view to compare ROE with the share of EBIT reaching pre-tax income. A high reading can reflect other income as well as financing costs. Inspect the financial inputs before attributing the difference to borrowing."),
         ("Interact with chart points", "Hover over a dot to see its ticker, metrics, verdict, and reporting period. Click the dot to open company details. With keyboard focus on the chart, use arrow keys to browse the points and Enter to open the selected company."),
         ("Sector and verdict bars", "The stacked sector bars show the mix of verdicts within each sector under your filters. Select a sector bar to focus on that sector. The verdict breakdown shows counts before the verdict filter itself is applied, so you can switch categories directly."),
         ("Compare two companies", "Open Compare and select Company A and Company B. This view can select any two companies in the universe. Compare bar lengths within each factor and use the exact values across factors. Check both dates and time spans before interpreting differences."),
     )),
    ("Understand the numbers", "Read the factor definitions, benchmarks, and grading rules together.",
     (
         ("The five factors", "Tax burden = net income / EBT. Interest burden = EBT / EBIT. Operating margin = EBIT / revenue. Asset turnover = revenue / assets. Equity multiplier = assets / equity. Their product equals net income / equity, or ROE, when the factors are defined."),
         ("Financial amounts and time periods", "Inputs are shown in INR crore when available. The screener uses average assets and equity when available and flags period-end substitutes. TTM means trailing 12 months. Check the period and scope before comparing an annual, TTM, or shorter-period observation."),
         ("Peer comparisons and percentiles", "The benchmark groups comparable records by sector, reporting period, and end date when this information is supplied. P25, P50, and P75 are the lower quartile, median, and upper quartile. A difference of 15% versus 12% is 3 percentage points. Filters change the displayed selection while benchmark cohorts stay fixed."),
         ("Good and Decent", "Quality Compounder requires positive ROE at or above sector P70, margin or turnover above P60, an equity multiplier at or below 1.3 times the sector median, and interest burden of at least 80%. Decent covers comparable profiles outside the Good and Bad rules, including cases where turnover offsets low margin."),
         ("Bad and Unrated", "Bad flags invalid equity, non-positive EBIT or EBT, or high ROE above 15% paired with high leverage and interest burden below 70%. High leverage means above sector P75 or above 3.5 times equity. Unrated indicates insufficient comparable inputs after risk overrides are checked."),
     )),
    ("Operate and refresh", "Use the hosted copy for sharing and the offline file for local access.",
     (
         ("Hosted website and offline copy", "Visitors use the public site. Select Download offline app to save a self-contained HTML file, then double-click it to open in a browser. Its data reflects the version you downloaded. The information button and both PDF downloads work in the offline copy. External filing links require internet access."),
         ("Prepare a data update", "In DuPont Screener - Complete, update data/latest.csv or replace data/final_dupont_cleaned_v3.xlsx. Keep the original 150 tickers. Preserve the CSV reporting periods and available source fields. For Excel, use the Cleaned 5-Point DuPont worksheet and close Excel after saving."),
         ("Daily publication", "The configured Codex refresh checks for changes at 7:00 a.m. India time when it can access the computer and folder. If both inputs changed, the most recently saved source is used. The refresh validates the stock list, rebuilds the two HTML files, publishes, and checks the files served by the live site."),
         ("Build or troubleshoot locally", "From the Complete folder, run python build_web.py after installing the dependencies in requirements.txt. Open DuPont-Screener.html for a local check. If an update fails, check for missing or duplicate tickers, unusable inputs, an unavailable folder, or a hosting error. A validation error leaves the last published data online."),
         ("Where to find more", "Use the Methodology PDF in the site header for the full scoring rules and worked calculation examples. Use the source links in company details to check the figures behind a specific ratio."),
     )),
)


def build():
    destination = Path(__file__).resolve().with_name("DuPont_Website_User_Guide.pdf")
    guide = Guide(destination)
    guide.pdf.setTitle(TITLE)
    guide.pdf.setSubject("Website controls, interpretation, and operation")
    for number, (heading, intro, entries) in enumerate(PAGES, 1):
        guide.line(LEFT, 45, RIGHT, 45)
        guide.text(LEFT, 33, "DUPONT SCREENER  /  WEBSITE USER GUIDE", 9, TEAL, True)
        guide.text(LEFT, 91, heading, 28, INK, True)
        y = guide.para(LEFT, 109, intro, size=12, leading=17) + 22
        for title, description in entries:
            guide.text(LEFT, y + 11, title, 12, INK, True)
            y = guide.para(LEFT, y + 20, description, size=10.5, leading=15) + 17
        if y > 710:
            raise ValueError(f"Guide content exceeds page {number}")
        guide.source(LEFT, 734, "Open the public screener", SITE)
        guide.line(LEFT, 748, RIGHT, 748)
        guide.text(RIGHT - 35, 766, f"{number} / {len(PAGES)}", 8, MUTED, True)
        guide.pdf.showPage()
    guide.pdf.save()


if __name__ == "__main__":
    build()
