# SVG for two-dimensional charts

DATE: 2026-05-07

SUPERSEDES: `2026-05-04-canvas-and-webgl-as-chart-rendering-engines`

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

Canvas 2D text rendering does not use the browser's full typographic pipeline.
The operating system text stack applies subpixel anti-aliasing and font hinting
to HTML and SVG text, nudging glyph outlines to pixel boundaries and treating
subpixel components as independent rendering units. Canvas 2D rasterizes glyphs
directly into the pixel buffer without these steps. At the sizes required for
axis labels and tick values, the difference is visible: Canvas 2D text is
noticeably softer than the body text adjacent to it.

## DECISION

Two-dimensional charts use SVG.

## RATIONALE

SVG text goes through the same typographic pipeline as the rest of the page,
making axis labels and tick values visually consistent with surrounding body
text.

## ALTERNATIVES CONSIDERED

**Canvas 2D**: Rejected because its text rendering pipeline produces visibly
softer axis labels and tick values relative to surrounding page text.

**Hybrid SVG axes over Canvas 2D data layer**: SVG handles text elements while
Canvas 2D renders the data line, with both layers sharing scale functions.
Rejected because it introduces two rendering contexts, two styling surfaces, and
two interaction models to solve a throughput problem that does not exist at
research page data densities.

**WebGL**: Rejected for lacking native text rendering.

## CONSEQUENCES

**Positive**: Axis labels and tick values render with the crispness of
surrounding page text. Charts are styleable with CSS and exportable as vector
graphics.

**Negative**: SVG DOM accumulation under continuous data load is untested at
live-page densities.

**Neutral**: Live pages will require a separate rendering ADR when implemented.
The three-dimensional chart decision is unchanged.
