# Federal Reserve Economic Data as the US macroeconomic data source

DATE: 2026-05-04

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

Models that operate on US macroeconomic data require a source for time series
produced by US statistical agencies and the Federal Reserve: GDP and its
expenditure components, employment and unemployment, inflation measures (CPI,
PCE, PPI), interest rates across the maturity spectrum, monetary aggregates,
housing, and trade.

## DECISION

The Federal Reserve Economic Data service (FRED), operated by the Federal
Reserve Bank of St. Louis, is the source for US macroeconomic time series data.

## ALTERNATIVES CONSIDERED

**Individual statistical agencies**: The Bureau of Labor Statistics, the Bureau
of Economic Analysis, the Census Bureau, and the Federal Reserve each publish
the series FRED aggregates through their own APIs and data release mechanisms.
These are the primary sources from which FRED ingests. Rejected because each
agency exposes a distinct API with its own authentication scheme, response
format, identifier convention, and rate limit policy. Querying them directly
fragments what FRED unifies into a single API, a consistent identifier system,
and a single authentication arrangement. The ergonomic cost of maintaining
direct agency integrations is not offset by any accuracy advantage: FRED's
ingestion of agency releases is prompt and the series are identical.

**DBnomics**: An open aggregator that pulls from BLS, BEA, OECD, ECB, Eurostat,
the World Bank, and others. Has a Python client and is free to use. Rejected
because its US macroeconomic coverage is thinner than FRED's and its
institutional backing, a French academic consortium, is conceivably less stable
than a Federal Reserve bank. Its comparative advantage is European and
international series.

**OECD API**: Carries US series in harmonised, cross-country-comparable form.
Rejected because its value is cross-country comparability rather than depth of
US domestic coverage, its series tend toward lower frequencies, and querying it
for US data alone ignores its primary purpose. Cross-country work using OECD
data is better addressed as a per-model decision.

**World Bank API**: Free and stable, with a Python client. Rejected because its
US series are annual-frequency development indicators intended for cross-country
comparison rather than domestic macro monitoring. It does not carry the series
central to US macro research at useful frequencies.

**Alpha Vantage**: A financial markets API with a secondary economic indicators
section covering some US macro series. Rejected because macro data is not the
product's primary focus; depth, update cadence, and series coverage reflect
that. Its credibility as a macro data source is lower than FRED's.

**Commercial providers**: Trading Economics, Quandl/Nasdaq Data Link, and Haver
Analytics each offer US macroeconomic data at varying price points. Rejected
categorically because a commercial data dependency is incompatible with the open
source reproducibility requirement: a collaborator without a subscription cannot
reproduce results.

## RATIONALE

FRED is the natural aggregation point for US macroeconomic time series. It is
operated by the Federal Reserve Bank of St. Louis and has run continuously since
1991, making it one of the most institutionally stable data services in
economics. It aggregates BLS, BEA, Census, and Federal Reserve releases under a
single REST API with consistent series identifiers, a free API key, no
meaningful rate limits for the project's usage patterns, and over 800,000
series. A Python client (fredapi) is available. Series identifiers are stable
references that can be committed to model code and documentation without
identifier drift.

## CONSEQUENCES

**Positive**: a single API and authentication arrangement covers the full range
of US macroeconomic series. Series identifiers are stable and citable. The
service is free and has demonstrated institutional permanence.

**Negative**: FRED is an intermediary between the project and primary sources.
Its ingestion pipeline introduces a small lag relative to agency release times.
Any gap in FRED's coverage of a specific series requires falling back to the
originating agency directly.

**Neutral**: ALFRED, the archival companion to FRED operated by the same
institution, provides vintage data: values as published on a specific historical
date before subsequent revisions. Models that backtest against historical dates
should use ALFRED to avoid look-ahead bias from revised data. This is not a
separate data source decision but a usage pattern to be documented at the model
level. Macroeconomic data for non-US countries and cross-country comparative
series are deferred to per-model decisions; OECD, World Bank, and IMF sources
are the expected candidates when those decisions arise.
