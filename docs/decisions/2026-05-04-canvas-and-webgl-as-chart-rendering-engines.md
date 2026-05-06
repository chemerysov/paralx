# Canvas and WebGL as the chart rendering engines

DATE: 2026-05-04

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

The project has two categories of chart with materially different rendering
requirements. Standard two-dimensional charts appear on research pages,
rendering on model load and updating in response to parameter changes, and on
live pages, receiving a continuous stream of trade data from a market data
WebSocket and accumulating data over time. Three-dimensional surface plots cover
models parameterised by two independent variables, where the output is a surface
over a parameter grid. The HTML canvas element supports two rendering contexts,
Canvas 2D and WebGL, which are distinct rendering systems sharing the same
element.

## DECISION

Two-dimensional charts use the Canvas 2D rendering context. Three-dimensional
charts use the WebGL rendering context.

## ALTERNATIVES CONSIDERED

**SVG for all charts**: SVG renders each chart element as an addressable DOM
node, supports CSS styling, and scales without quality loss at any display size.
Rejected on two grounds. First, SVG accumulates DOM nodes proportionally to data
volume: a live chart receiving continuous trade data grows its DOM indefinitely,
and per-node browser overhead becomes a measurable performance problem at the
data densities live pages produce. Second, SVG has no mechanism for
three-dimensional rendering. Adopting SVG would either preclude 3D charts or
require mixing SVG with a second rendering context.

**Canvas 2D for all charts**: Canvas 2D handles two-dimensional charts at any
data density by redrawing the pixel buffer at fixed cost regardless of data
volume. Rejected for the 3D case because the Canvas 2D context is a flat pixel
surface with no depth model. Projecting three-dimensional geometry manually onto
a 2D surface forfeits GPU acceleration, perspective correctness, and interactive
rotation.

**WebGL for all charts**: WebGL handles both two-dimensional and
three-dimensional rendering through GPU execution. Rejected on two grounds that
affect every standard annotated chart. First, WebGL has no native text
rendering: axis labels, tick values, date strings, tooltips, and legends cannot
be drawn directly, and glyphs must be pre-rasterized into texture atlases,
rendered using Signed Distance Field techniques with custom shader code, or
composited from a Canvas 2D overlay, which reintroduces a second rendering
context. In practice, libraries that advertise WebGL rendering for
two-dimensional charts handle text through an SVG or Canvas 2D layer regardless.
Second, WebGL renders to a pixel framebuffer and produces jagged edges on
diagonal lines by default; correcting this requires explicit anti-aliasing
configuration. Canvas 2D applies sub-pixel anti-aliasing to lines automatically,
which matters for a project whose two-dimensional charts consist predominantly
of thin time series lines. Canvas 2D redraws at the relevant data densities take
under a millisecond; Pyodide's compute time dominates update latency regardless
of rendering backend.

**SVG for research pages, Canvas for live pages**: Separating rendering backends
by page type rather than chart dimensionality would allow SVG on research pages
where data volume is bounded and Canvas on live pages where it is not. Rejected
because it introduces two rendering systems with different styling models,
different animation APIs, and different interaction handling, creating an
ongoing risk of visual divergence as the chart library evolves.

## RATIONALE

Canvas 2D renders at fixed cost regardless of accumulated data volume. Redrawing
the pixel buffer takes the same time whether the chart holds one hundred or one
hundred thousand points, which is the essential property for live pages where
the dataset grows throughout the trading session. WebGL provides a native depth
model, GPU-executed geometry processing, and interactive surface rotation, which
three-dimensional charts require. Pyodide executes model calculation as
WebAssembly on the CPU; WebGL renders on the GPU. For three-dimensional surface
plots, which are computationally intensive to calculate and visually complex to
render, CPU and GPU carry separate workloads without resource competition. A
single Canvas rendering model applies across all chart types, with a consistent
styling system, animation API, and interaction handling throughout.

## CONSEQUENCES

**Positive**: live pages accumulate data without rendering degradation.
Three-dimensional surface plots are supported. CPU and GPU workloads are
separated for the most demanding chart type. A single rendering model applies
across all two-dimensional charts.

**Negative**: SVG's properties are foregone: charts do not scale without quality
loss, cannot be styled directly with CSS, and cannot be exported as vector
graphics.

**Neutral**: Canvas 2D and WebGL are both obtained from the HTML canvas element.
The chart library implementing these contexts is a separate decision.
