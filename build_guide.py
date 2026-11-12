"""Generate the executive methodology PDF with ReportLab."""

from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

from engine import make_sheet, quantile, screen


HERE = Path(__file__).resolve().parent
TITLE = "How the DuPont Screening Engine Thinks: From First Principles to Institutional Grading."
WIDTH, HEIGHT = 612, 792
LEFT, RIGHT = 48, 564
BODY = RIGHT - LEFT
INK = "#16283C"
MUTED = "#4B6277"
LINE = "#D8E4EB"
SOFT = "#EFF5F7"
TEAL = "#086E65"
GREEN = "#E5F5EE"
AMBER = "#FFF2DC"
RED = "#FCEBF0"
WHITE = "#FFFFFF"
CFA = "https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/financial-analysis-techniques"
STERN = "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/AccPrimer/accstate.htm"


class Guide:
    def __init__(self, path):
        fonts = Path(reportlab.__file__).parent / "fonts"
        pdfmetrics.registerFont(TTFont("Vera", str(fonts / "Vera.ttf")))
        pdfmetrics.registerFont(TTFont("VeraBold", str(fonts / "VeraBd.ttf")))
        self.pdf = Canvas(str(path), pagesize=(WIDTH, HEIGHT), pageCompression=1, initialFontName="Vera")
        self.pdf.setTitle(TITLE)
        self.pdf.setAuthor("DuPont Screener")
        self.pdf.setSubject("Five-factor DuPont analysis and sector-relative screening")

    def text(self, x, y, value, size=11, color=INK, bold=False):
        self.pdf.setFillColor(colors.HexColor(color))
        self.pdf.setFont("VeraBold" if bold else "Vera", size)
        self.pdf.drawString(x, HEIGHT - y, value)

    def para(self, x, top, value, width=BODY, size=11, leading=15, color=MUTED, bold=False):
        style = ParagraphStyle("body", fontName="VeraBold" if bold else "Vera",
                               fontSize=size, leading=leading, textColor=colors.HexColor(color))
        paragraph = Paragraph(escape(value), style)
        _, height = paragraph.wrap(width, HEIGHT)
        paragraph.drawOn(self.pdf, x, HEIGHT - top - height)
        return top + height

    def box(self, x, y, width, height, fill=SOFT, stroke=None, radius=8):
        self.pdf.setFillColor(colors.HexColor(fill))
        self.pdf.setStrokeColor(colors.HexColor(stroke or fill))
        self.pdf.roundRect(x, HEIGHT - y - height, width, height, radius, fill=1, stroke=bool(stroke))

    def line(self, x1, y1, x2, y2, color=LINE, width=1):
        self.pdf.setStrokeColor(colors.HexColor(color))
        self.pdf.setLineWidth(width)
        self.pdf.line(x1, HEIGHT - y1, x2, HEIGHT - y2)

    def dot(self, x, y, color, radius=4):
        self.pdf.setFillColor(colors.HexColor(color))
        self.pdf.circle(x, HEIGHT - y, radius, fill=1, stroke=0)

    def start(self, section, heading=None):
        self.line(LEFT, 45, RIGHT, 45)
        self.text(LEFT, 35, "DUPONT SCREENER  /  METHODOLOGY", 9, TEAL, True)
        self.text(RIGHT - 139, 35, section, 9, MUTED, True)
        if heading:
            self.text(LEFT, 87, heading, 29, INK, True)

    def finish(self, page):
        self.line(LEFT, 748, RIGHT, 748)
        self.text(LEFT, 766, "DUPONT SCREENER", 8, MUTED, True)
        self.text(RIGHT - 25, 766, f"{page} / 5", 8, MUTED, True)
        self.pdf.showPage()

    def callout(self, y, heading, description, height=64, fill=SOFT):
        self.box(LEFT, y, BODY, height, fill)
        self.text(LEFT + 13, y + 19, heading, 11, TEAL, True)
        self.para(LEFT + 13, y + 26, description, BODY - 26, 10.5, 14)

    def subhead(self, y, heading):
        self.text(LEFT, y, heading, 14, INK, True)

    def source(self, x, y, label, url):
        self.text(x, y, label, 9, TEAL, True)
        width = self.pdf.stringWidth(label, "VeraBold", 9)
        self.pdf.linkURL(url, (x, HEIGHT - y - 3, x + width, HEIGHT - y + 10), relative=0)


def identity(g):
    g.start("01  /  THE IDENTITY")
    g.box(LEFT, 65, BODY, 166, "#0D263C")
    g.text(LEFT + 20, 90, "EXECUTIVE STUDY GUIDE", 9, "#92E1D3", True)
    g.text(LEFT + 20, 124, "How the DuPont Screening", 25, WHITE, True)
    g.text(LEFT + 20, 154, "Engine Thinks:", 25, WHITE, True)
    g.text(LEFT + 20, 182, "From First Principles to Institutional Grading.", 16.5, WHITE, True)
    g.text(LEFT + 20, 210, "An operating, financing and tax bridge from revenue to ROE.", 11, "#C8DFE8")

    g.para(LEFT, 252,
           "Return on equity (ROE) asks how much net income a business generated per unit of shareholders’ book equity. "
           "DuPont writes that same result as a chain of five quantities that explain where the return came from.")
    g.box(LEFT, 309, BODY, 51)
    g.text(LEFT + 13, 330, "ROE = (NI / EBT) × (EBT / EBIT) × (EBIT / Sales) × (Sales / Assets) × (Assets / Equity)", 9.6, INK, True)
    g.text(LEFT + 13, 347, "EBT, EBIT, Sales and Assets cancel, leaving NI / Equity.", 10, TEAL)

    factors = [
        ("Tax burden", "NI ÷ EBT", "The share of pretax earnings left after tax and other items in net income."),
        ("Interest burden", "EBT ÷ EBIT", "The share of operating profit that reaches pretax income."),
        ("Operating margin", "EBIT ÷ Sales", "Operating profit per unit of revenue."),
        ("Asset turnover", "Sales ÷ Avg assets", "Revenue generated per unit of assets."),
        ("Equity multiplier", "Avg assets ÷ Avg equity", "Assets supported by each unit of book equity."),
    ]
    g.text(LEFT, 388, "FACTOR", 8.5, TEAL, True)
    g.text(174, 388, "CALCULATION", 8.5, TEAL, True)
    g.text(311, 388, "ECONOMIC MEANING", 8.5, TEAL, True)
    for i, (name, formula, meaning) in enumerate(factors):
        y = 398 + i * 39
        g.line(LEFT, y, RIGHT, y)
        g.text(LEFT, y + 16, name, 10.5, INK, True)
        g.text(174, y + 16, formula, 9.5)
        g.para(311, y + 6, meaning, RIGHT - 311, 10, 12)

    g.callout(610, "Match the period and the accounting basis",
              "Use one reporting period and a consistent currency scale. Average assets and equity over that period, typically using opening and closing balances. "
              "The app flags period-end amounts used as proxies.", 76)
    g.para(LEFT, 700, "NI is net income, EBT is earnings before tax, and EBIT is earnings before interest and tax.", size=9, leading=12)
    g.finish(1)


def operating_models(g):
    g.start("02  /  SECTOR PEERS", "Compare operating models")
    g.para(LEFT, 106,
           "Operating margin and turnover multiply to operating return on assets. A business can earn the same operating ROA by making more per sale or by generating more sales per unit of assets.")
    g.box(LEFT, 160, BODY, 276, WHITE, LINE)
    g.text(LEFT + 14, 180, "OPERATING ROA = EBIT / AVERAGE ASSETS", 9, TEAL, True)

    x0, x1, y0, y1 = 105, 533, 390, 208

    def project(turnover, margin):
        return x0 + (turnover - 0.5) / 3.5 * (x1 - x0), y0 - margin / 0.25 * (y0 - y1)

    for margin in (0, .05, .10, .15, .20, .25):
        _, y = project(.5, margin)
        g.line(x0, y, x1, y)
        g.text(x0 - 29, y + 3, f"{margin:.0%}", 8.5, MUTED)
    for turnover in (.5, 1, 1.5, 2, 2.5, 3, 3.5, 4):
        x, _ = project(turnover, 0)
        g.line(x, y0, x, y0 + 4, MUTED)
        g.text(x - 8, y0 + 16, f"{turnover:.1f}×", 8.5, MUTED)
    g.line(x0, y1, x0, y0, MUTED)
    g.line(x0, y0, x1, y0, MUTED)
    g.text(LEFT + 14, 198, "Operating margin", 8.5, MUTED)
    g.text(285, 422, "Asset turnover", 9, MUTED, True)
    previous = project(.5, .12 / .5)
    for i in range(1, 101):
        turn = .5 + i * .035
        current = project(turn, .12 / turn)
        g.line(*previous, *current, TEAL, 1.8)
        previous = current
    for turnover, margin, x_offset, y_offset, label in [
        (.6, .20, 13, -3, "A   20% × 0.60×"),
        (2, .06, 12, -7, "B   6% × 2.00×"),
    ]:
        x, y = project(turnover, margin)
        g.dot(x, y, TEAL)
        g.text(x + x_offset, y + y_offset, label, 9, INK, True)
    g.text(427, 320, "12% operating ROA", 9, TEAL, True)
    g.line(495, 325, 508, 362, TEAL, .7)

    g.subhead(468, "Build a benchmark from the uploaded sector")
    g.para(LEFT, 479,
           "The engine groups comparable rows by sector and sorts each ratio. P50 is the median. P25 and P75 bracket the middle half of the distribution. "
           "To find percentile p, interpolate at zero-based position (n − 1) × p, with p as a decimal.")
    g.para(LEFT, 532,
           "For margins of 5%, 7%, 9%, 12% and 15%, P35 sits at position 1.4. It equals 7% + 0.4 × (9% − 7%) = 7.8%. "
           "Margin and turnover are Weak below P35, Moderate from P35 through P65, and Strong above P65.")

    g.callout(593, "What goes into the comparison",
              "Peers need a company or ticker, a sector, and finite ROE and operating ROA with valid operating and equity bases. "
              "Loss rows with defined factors can contribute. The sample includes the company being evaluated.", 72)
    g.para(LEFT, 680,
           "The drawer shows sector sample size. A small or tied sample can put many companies on the same cutoff. "
           "Filters change which rows are visible after grading.", size=10, leading=13)
    g.finish(2)


def decision_tree(g):
    g.start("03  /  RULE ORDER", "Apply the rules in order")
    g.para(LEFT, 105,
           "Start at the top. When a condition is met, assign the result on the right and stop. Otherwise, continue down the tree.")
    steps = [
        ("Distressed equity", "Equity is non-positive, or a ratio-only input implies non-positive equity.",
         "Bad", "Distressed / Invalid ROE", RED),
        ("Operational bleed", "EBIT ≤ 0 or EBT ≤ 0. Use reported amounts where available and infer signs from the ratios otherwise.",
         "Bad", "Unprofitable Core", RED),
        ("Debt trap", "ROE > 15%, leverage > sector P75 or > 3.5×, and interest burden < 70%. Both the leverage and interest tests must pass.",
         "Bad", "Leverage-Driven Risk", RED),
        ("Missing comparison inputs", "The factors, operating base, company identity or sector cannot support a peer-relative grade.",
         "Unrated", "Insufficient comparable data", SOFT),
        ("Quality compounder", "Positive ROE ≥ sector P70, margin or turnover > sector P60, leverage ≤ 1.3× sector median and interest burden ≥ 80%.",
         "Good", "Quality Compounder", GREEN),
        ("Volume offsets margin", "Margin < sector P35, turnover > sector P75 and operating ROA > sector P50.",
         "Decent", "Volume offsets margin", AMBER),
        ("Stable operations", "Interest burden ≥ 75%, positive margin and operating ROA from sector P35 through P65.",
         "Decent", "Stable Operations", AMBER),
    ]
    for i, (label, question, grade, result, tint) in enumerate(steps):
        y = 147 + i * 76
        g.box(LEFT, y, 330, 59, WHITE, LINE)
        g.text(LEFT + 11, y + 16, label, 10.5, INK, True)
        g.para(LEFT + 11, y + 22, question, 309, 9.2, 11.5)
        g.line(LEFT + 331, y + 28, LEFT + 371, y + 28, TEAL)
        g.text(LEFT + 340, y + 22, "YES", 7.5, TEAL, True)
        g.box(LEFT + 372, y + 3, 144, 53, tint)
        g.text(LEFT + 382, y + 22, grade, 11, INK, True)
        g.para(LEFT + 382, y + 28, result, 125, 9, 11)
        g.line(LEFT + 20, y + 59, LEFT + 20, y + 75, MUTED)
        g.text(LEFT + 25, y + 70, "NO", 7.5, MUTED, True)
    g.box(LEFT, 680, BODY, 43, AMBER)
    g.text(LEFT + 11, 698, "Decent  /  Other Comparable Profile", 11, INK, True)
    g.text(LEFT + 11, 713, "Every remaining comparable row receives this residual verdict.", 9.5, MUTED)
    g.finish(3)


def stress_tests(g):
    g.start("04  /  INTERACTIONS", "Stress-test the signals")
    g.subhead(113, "Leverage and the share of EBIT reaching pretax profit")
    g.para(LEFT, 123,
           "Suppose tax burden is 80%, margin is 10%, turnover is 1.00× and leverage is 4.00×. "
           "Keep those four factors fixed and change interest burden.")
    g.box(164, 171, 284, 46, SOFT)
    g.text(178, 191, "High equity multiplier  /  4.00× > 3.50×", 11, INK, True)
    g.text(178, 206, "Does less than 70% of EBIT reach pretax profit?", 9.5, MUTED)
    g.line(306, 217, 306, 230, TEAL)
    g.line(173, 230, 439, 230, TEAL)
    g.line(173, 230, 173, 242, TEAL)
    g.line(439, 230, 439, 242, TEAL)
    g.box(LEFT, 242, 250, 77, RED)
    g.text(LEFT + 12, 260, "YES  /  60% interest burden", 10.5, INK, True)
    g.para(LEFT + 12, 268, "ROE = 19.2%. High leverage and a low retained share trip the debt trap. Verdict: Bad.",
           226, 10.2, 13)
    g.box(314, 242, 250, 77, GREEN)
    g.text(326, 260, "NO  /  90% interest burden", 10.5, INK, True)
    g.para(326, 268, "ROE = 28.8%. The debt-trap test clears. Continue to the other rules and check the sector leverage median.",
           226, 10.2, 13)
    g.para(LEFT, 333,
           "Interest burden captures the full EBIT-to-EBT bridge. If interest expense is the only item in that bridge, "
           "60% retention implies interest consumed 40% of EBIT. Non-operating items can also change EBT.",
           size=10.5, leading=14)

    g.subhead(405, "Follow the signs before reading the ratios")
    g.box(131, 421, 350, 50, SOFT)
    g.text(144, 441, "Raw row  /  EBIT = −40, EBT = −60, net income = −45", 10.5, INK, True)
    g.text(144, 458, "The interest quotient is (−60) ÷ (−40) = 150%.", 10, MUTED)
    g.line(306, 471, 306, 485, TEAL)
    g.line(173, 485, 439, 485, TEAL)
    g.line(173, 485, 173, 498, TEAL)
    g.line(439, 485, 439, 498, TEAL)
    g.box(LEFT, 498, 250, 94, RED)
    g.text(LEFT + 12, 517, "Equity = −100", 10.5, INK, True)
    g.para(LEFT + 12, 524,
           "Loss divided by negative equity would give +45%. The engine suppresses ROE and assigns Bad, Distressed / Invalid ROE.",
           226, 10.2, 13)
    g.box(314, 498, 250, 94, RED)
    g.text(326, 517, "Equity = +100", 10.5, INK, True)
    g.para(326, 524,
           "ROE is −45% with a valid operating base. Non-positive EBIT or EBT assigns Bad, Unprofitable Core. The burden card warns about the 150% quotient.",
           226, 10.2, 13)
    g.callout(611, "Zero denominators and ratio-only files",
              "A zero denominator leaves its factor undefined. Non-positive EBIT or EBT still triggers the profit override. "
              "With ratios alone, non-positive margin signals non-positive EBIT on a valid base. With positive EBIT, non-positive interest burden signals non-positive EBT.",
              88)
    g.finish(4)


def example_inputs():
    raw = ("Alder Components", "Industrials", 500, 90, 81, 60.75, 400, 200)
    headers = ("Company", "Sector", "Revenue", "EBIT", "EBT", "Net Income", "Average Assets", "Average Equity")
    peers = [
        (.06, .7, 1.4), (.07, .8, 1.7), (.09, 1.0, 1.8),
        (.10, .9, 1.9), (.11, .8, 2.0), (.12, .95, 2.1),
        (.13, 1.1, 2.2), (.15, 1.2, 2.3), (.16, 1.3, 2.4),
    ]
    records = [headers, raw]
    for i, (margin, turnover, leverage) in enumerate(peers, start=1):
        assets, ebit = 500 / turnover, 500 * margin
        records.append((f"Peer {i}", "Industrials", 500, ebit, ebit * .9, ebit * .9 * .75, assets, assets / leverage))
    screened, _ = screen(make_sheet("Example", records))
    cuts = {
        key: quantile(sorted(row["ratios"][key] for row in screened), percentile)
        for key, percentile in (("roe", 70), ("margin", 60), ("turnover", 60), ("leverage", 50))
    }
    return screened[0], cuts


def walkthrough(g):
    row, cuts = example_inputs()
    g.start("05  /  WORKED EXAMPLE", "From an Excel row to Good")
    g.para(LEFT, 107,
           "Alder Components is a hypothetical industrial company in a sample of 10 rows. "
           "All statement amounts are in the same units and cover the same reporting period.")
    g.subhead(166, "1   Read the row")
    g.box(LEFT, 178, BODY, 54, SOFT)
    inputs = [("Revenue", "500"), ("EBIT", "90"), ("EBT", "81"), ("Net income", "60.75"), ("Avg assets", "400"), ("Avg equity", "200")]
    for i, (label, value) in enumerate(inputs):
        x = LEFT + 12 + i * 85
        g.text(x, 197, label, 9, MUTED)
        g.text(x, 217, value, 14, INK, True)

    g.subhead(260, "2   Calculate the five factors")
    factor_values = [
        ("Tax burden", "60.75 ÷ 81", "75.0%"), ("Interest burden", "81 ÷ 90", "90.0%"),
        ("Operating margin", "90 ÷ 500", "18.0%"), ("Asset turnover", "500 ÷ 400", "1.25×"),
        ("Equity multiplier", "400 ÷ 200", "2.00×"),
    ]
    for i, (label, formula, value) in enumerate(factor_values):
        y = 280 + i * 19
        g.text(LEFT, y, label, 10.5, INK, True)
        g.text(235, y, formula, 10.5, MUTED)
        g.text(453, y, value, 10.5, INK, True)
        g.line(LEFT, y + 5, RIGHT, y + 5)
    g.para(LEFT, 378,
           "ROE = 0.75 × 0.90 × 0.18 × 1.25 × 2.00 = 30.375%, matching 60.75 ÷ 200. "
           "Operating ROA = 0.18 × 1.25 = 22.50%, matching 90 ÷ 400.", size=10.5, leading=14)

    g.subhead(433, "3   Run the sector checks and assign the verdict")
    g.para(LEFT, 444, "Equity, EBIT and EBT are positive. Leverage and interest burden clear the debt-trap override.")
    checks = [
        ("Positive ROE at or above P70", f"{row['ratios']['roe']:.3%} ≥ {cuts['roe']:.2%}"),
        ("Margin or turnover above P60", f"18.00% > {cuts['margin']:.2%}  /  1.25× > {cuts['turnover']:.2f}×"),
        ("Leverage at or below 1.3× median", f"2.00× ≤ {cuts['leverage'] * 1.3:.3f}×"),
        ("Interest burden at or above 80%", "90.00% ≥ 80.00%"),
    ]
    for i, (check, comparison) in enumerate(checks):
        y = 477 + i * 21
        g.text(LEFT, y, check, 10.5, INK, True)
        g.text(331, y, comparison, 10.5, TEAL)
        g.line(LEFT, y + 6, RIGHT, y + 6)
    g.callout(560, f"{row['verdict']}  /  {row['rule']}",
              "Alder earns a high sector-relative ROE with operating support, controlled leverage and a strong retained share of EBIT.",
              57, GREEN)

    g.para(LEFT, 637,
           "If a row supplies the underlying amounts, the app computes the available factors from them. For pre-calculated inputs, use decimals or explicitly marked percentages for rates and multiples for turnover and leverage. "
           "Pre-labeled cap categories take priority. Otherwise the app uses P33 and P67 of positive uploaded caps or user-entered cutoffs.",
           size=9.5, leading=12.5)
    g.source(LEFT, 711, "CFA Institute, Financial Analysis Techniques", CFA)
    g.source(LEFT, 726, "Aswath Damodaran, A Primer on Financial Statements", STERN)
    g.finish(5)


def build():
    output = HERE / "DuPont_Methodology_Guide.pdf"
    guide = Guide(output)
    for page in (identity, operating_models, decision_tree, stress_tests, walkthrough):
        page(guide)
    guide.pdf.save()
    print(output)


if __name__ == "__main__":
    build()
