"""One rule, one place: what every fundamentals field MEANS.

Units are the bug class that survives code review, because a mis-scaled number
still looks like a number. Three of them were already found the hard way and are
recorded as comments scattered across `yfinance_provider.py`:

  * ``dividendYield`` arrives already in percent (3.20 = 3.20%), so ``_pct``
    would over-scale it 100x.
  * ``debtToEquity`` arrives multiplied by 100 and has to be divided back down.
  * ``payoutRatio`` arrives as a fraction and does need ``_pct``.

A comment beside one call site cannot be checked, cannot be reused by the
consumer, and does not exist at all for the next field somebody adds. This table
can be: `analytics/tests/test_field_spec.py` fails the build if a
``FundamentalsSnapshot`` field is missing from it, and
:func:`normalise_fundamentals` is the single place the rules are applied.

**The margin sentinel.** yfinance reports ``grossMargins``/``ebitdaMargins`` as
exactly ``0.0`` for companies where the concept does not apply — every bank we
cover, and pre-revenue explorers. ``0.0`` is not "zero percent", it is "not
reported": a company with revenue cannot have a margin of exactly 0.0000, and
one without revenue has no margin at all. Scoring read those zeros as a real,
terrible 0% and marked 71 stocks down for it (see `docs/data-audit.md` D1).
``zero_means_na`` is how that fact is now stated once instead of nowhere.
"""

from dataclasses import dataclass, fields
from typing import Literal, Optional

from _engine.providers.base import FundamentalsSnapshot

Unit = Literal[
    "percent",   # already scaled to percent: 3.2 means 3.2%
    "ratio",     # dimensionless multiple: 0.78 means 0.78x
    "money",     # absolute currency amount (see `financial_currency` — NOT always
                 # the same currency as the share price)
    "price",     # per-share amount, always in the stock's price currency
    "count",     # a plain integer count
    "text",      # non-numeric
]


@dataclass(frozen=True)
class FieldSpec:
    unit: Unit
    #: True when an exact 0.0 from the provider means "not reported" rather than
    #: a real zero. Only ever set where a genuine zero is impossible.
    zero_means_na: bool = False
    #: Cross-universe median we expect this field to sit near, as a
    #: (low, high) band. Not a per-value clamp — a real stock is allowed to be
    #: an outlier. It is the tripwire for a PROVIDER-side unit change: if
    #: yfinance flips a field between fraction and percent again, the median
    #: moves by 100x and lands far outside the band while every individual value
    #: still looks perfectly plausible. Checked by
    #: `analytics/cron/check_field_units.py` against live data.
    median_band: Optional[tuple[float, float]] = None
    note: str = ""


#: Every numeric field of :class:`FundamentalsSnapshot`, with its unit.
#: Adding a field to the dataclass without adding it here fails CI.
FUNDAMENTALS_SPEC: dict[str, FieldSpec] = {
    # --- Identity -----------------------------------------------------------
    "ticker":    FieldSpec("text"),
    "name":      FieldSpec("text"),
    "sector":    FieldSpec("text"),
    "industry":  FieldSpec("text"),
    "market":    FieldSpec("text"),
    "currency":  FieldSpec("text", note="currency of the SHARE PRICE"),
    "financial_currency": FieldSpec(
        "text",
        note="currency of the FINANCIAL STATEMENTS — differs from `currency` for "
             "cross-listed reporters (BHP.AX prices in AUD, reports in USD)",
    ),
    "exchange":  FieldSpec("text"),
    "market_cap": FieldSpec(
        "money", median_band=(1e9, 1e11),
        note="in the PRICE currency, unlike the other money fields",
    ),

    # --- Profitability ------------------------------------------------------
    # All four are a ratio of revenue, and all four use 0.0 as "not reported".
    "gross_margin":     FieldSpec("percent", zero_means_na=True, median_band=(25, 60)),
    "operating_margin": FieldSpec("percent", zero_means_na=True, median_band=(8, 30)),
    "net_margin":       FieldSpec("percent", zero_means_na=True, median_band=(4, 22)),
    "ebitda_margin":    FieldSpec("percent", zero_means_na=True, median_band=(12, 35)),
    "roe":              FieldSpec("percent", median_band=(5, 25)),
    "roa":              FieldSpec("percent", median_band=(1, 12)),

    # --- Valuation ----------------------------------------------------------
    "pe":             FieldSpec("ratio", median_band=(10, 40)),
    "forward_pe":     FieldSpec("ratio", median_band=(8, 35)),
    "peg":            FieldSpec("ratio", median_band=(0.5, 5)),
    "price_to_book":  FieldSpec("ratio", median_band=(0.8, 8)),
    "price_to_sales": FieldSpec("ratio", median_band=(0.8, 10)),
    "ev_to_ebitda":   FieldSpec("ratio", median_band=(6, 30)),
    "ev_to_revenue":  FieldSpec("ratio", median_band=(1, 12)),

    # --- Growth -------------------------------------------------------------
    "revenue_growth_yoy":  FieldSpec("percent", median_band=(-5, 30)),
    "earnings_growth_yoy": FieldSpec("percent", median_band=(-15, 60)),
    "total_revenue":       FieldSpec("money", median_band=(5e8, 5e10)),

    # --- Balance sheet ------------------------------------------------------
    "total_debt":     FieldSpec("money", median_band=(1e8, 5e10)),
    "total_cash":     FieldSpec("money", median_band=(5e7, 1e10)),
    # Stored as a plain multiple (0.78x), NOT the percent-like 78.4 yfinance
    # sends. Anything scoring against it assumes the multiple — see
    # scoring/financial_health.py balance-sheet pillar.
    "debt_to_equity": FieldSpec("ratio", median_band=(0.2, 2.0)),
    "current_ratio":  FieldSpec("ratio", median_band=(0.8, 2.5)),
    "quick_ratio":    FieldSpec("ratio", median_band=(0.4, 2.0)),
    "interest_coverage": FieldSpec("ratio", median_band=(2, 30)),

    # --- Cash flow ----------------------------------------------------------
    "free_cashflow":      FieldSpec("money", median_band=(1e8, 1e10)),
    "operating_cashflow": FieldSpec("money", median_band=(2e8, 2e10)),
    # Derived: free_cashflow / market_cap. Withheld when those two are in
    # different currencies (see normalise_fundamentals).
    "fcf_yield_pct":  FieldSpec("percent", median_band=(0.5, 10)),
    "fcf_margin_pct": FieldSpec("percent", median_band=(2, 25)),
    "ebitda":         FieldSpec("money", median_band=(2e8, 2e10)),

    # --- Shareholder returns ------------------------------------------------
    # Already a percent from yfinance — do NOT multiply by 100.
    "dividend_yield_pct":    FieldSpec("percent", median_band=(1.0, 6.0)),
    # A fraction from yfinance — DOES get multiplied by 100.
    "payout_ratio_pct":      FieldSpec("percent", median_band=(15, 60)),
    "shares_change_yoy_pct": FieldSpec("percent", median_band=(-3, 5)),
    "short_pct_of_float":    FieldSpec("percent", median_band=(0.5, 8)),
    "short_ratio":           FieldSpec("ratio", median_band=(1, 8)),

    # --- Ownership ----------------------------------------------------------
    "insider_ownership_pct":     FieldSpec("percent", median_band=(0, 10)),
    "institution_ownership_pct": FieldSpec("percent", median_band=(40, 95)),

    # --- Analyst (third-party, verbatim) ------------------------------------
    "analyst_target_price":   FieldSpec("price"),
    "analyst_low_price":      FieldSpec("price"),
    "analyst_high_price":     FieldSpec("price"),
    "analyst_recommendation": FieldSpec("text"),
    "num_analyst_opinions":   FieldSpec("count", median_band=(5, 30)),

    # --- Price / technicals -------------------------------------------------
    # NOTE: these two come from `info` and are RAW traded prices, whereas
    # `price_bars` is dividend-adjusted (auto_adjust=True). The two are on
    # different bases for anything older than the latest bar — see
    # docs/data-audit.md D5.
    "week52_high":           FieldSpec("price"),
    "week52_low":            FieldSpec("price"),
    "week52_change_pct":     FieldSpec("percent", median_band=(-15, 40)),
    "sp500_52wk_change_pct": FieldSpec("percent", median_band=(-15, 40)),
    "rel_strength_vs_sp500": FieldSpec(
        "percent",
        note="ALWAYS measured against the S&P 500, including for AU and CA "
             "stocks. Not currently displayed anywhere; do not surface it "
             "without picking the right benchmark per market first.",
    ),
    "beta":                  FieldSpec("ratio", median_band=(0.5, 1.5)),

    "dividend_history": FieldSpec("text", note="list of {year, amount} in the price currency"),
}

#: Fields where an exact 0.0 from the provider means "not reported".
ZERO_MEANS_NA: frozenset[str] = frozenset(
    k for k, s in FUNDAMENTALS_SPEC.items() if s.zero_means_na
)


def spec_covers_snapshot() -> tuple[set[str], set[str]]:
    """Return (fields missing from the spec, spec keys with no such field)."""
    declared = set(FUNDAMENTALS_SPEC)
    actual = {f.name for f in fields(FundamentalsSnapshot)}
    return actual - declared, declared - actual


def normalise_fundamentals(f: FundamentalsSnapshot) -> FundamentalsSnapshot:
    """Apply the spec's semantics to a freshly-fetched snapshot.

    Mutates and returns ``f``:

    1. Every ``zero_means_na`` field holding an exact ``0.0`` becomes ``None``,
       so scoring omits the pillar input instead of reading a fabricated 0%.
    2. ``fcf_yield_pct`` is withheld when the free cash flow and the market cap
       are denominated in different currencies — the ratio would silently be off
       by an exchange rate. (``fcf_margin_pct`` is safe: both of its inputs come
       from the financial statements, so they always share a currency.)
    """
    for name in ZERO_MEANS_NA:
        if getattr(f, name, None) == 0:
            setattr(f, name, None)

    if (
        f.financial_currency is not None
        and f.currency is not None
        and f.financial_currency != f.currency
    ):
        f.fcf_yield_pct = None

    return f
