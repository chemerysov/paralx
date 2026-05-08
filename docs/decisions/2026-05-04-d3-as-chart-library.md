# D3 as the visualization library

DATE: 2026-05-04

STATUS: superseded by `2026-05-08-d3-as-svg-chart-library`

AUTHOR: Andrii Chemerysov

## CONTEXT

A prior decision (`2026-05-04-canvas-and-webgl-as-chart-rendering-backends`)
establishes that two-dimensional charts use the Canvas 2D rendering context and
three-dimensional charts use the WebGL rendering context.

The models Paralx presents are established: geometric Brownian motion, yield
curve analysis, factor models, and related constructs are well-understood in
finance. The project's intellectual contribution is not new models but new ways
of making existing models visible, interactive, and intuitive to a retail
investor audience. The chart is the primary medium of the research argument, not
a decorative container for model output. This places unusual demands on the
visualization layer: charts require time range controls with correct axis
behavior across zoom levels, variable-speed replay of historical market data,
live data stream rendering with model prediction overlays that update at
independent cadences, parameter-driven model recalculation visualized in real
time, and mobile-responsive layouts for chart forms that no library provides as
a built-in type.

## DECISION

D3 is the visualization library.

## ALTERNATIVES CONSIDERED

**Apache ECharts with echarts-gl**: ECharts uses Canvas 2D for standard chart
types and the echarts-gl extension adds WebGL three-dimensional chart types
including surface plots. The configuration API is unified across both. Rejected
on three grounds. First, echarts-gl already shows reduced maintenance velocity
relative to the core library; the 3D capability the project requires is
therefore dependent on an extension of uncertain longevity. Second, ECharts'
animation system handles chart mount and update transitions but does not expose
programmatic control over animation duration, easing, cancellation, or queuing;
variable-speed replay and rhetorical animations that reveal model structure
require this control. Third, unusual chart forms, including live price paths
with overlaid model prediction envelopes updating at different cadences, are
configuration problems in ECharts and composition problems in D3; the former
fights the library's update model, the latter uses it as designed.

**Chart.js**: Canvas 2D, comprehensive standard chart types, mature ecosystem.
Rejected because it has no path to three-dimensional rendering and does not
support the novel chart forms the project requires.

**Plotly.js**: Three-dimensional surface plots via WebGL, broad chart type
coverage. Rejected because its two-dimensional charts are SVG-based, which
conflicts with the Canvas 2D requirement of the prior rendering backend
decision. Bundle size is also large relative to the charts it would contribute.

**Nivo**: React-native, Canvas and SVG backends available per chart type, good
defaults. Rejected because it provides configurable chart types rather than
visualization primitives; the chart forms this project requires cannot be
expressed as Nivo configurations.

## RATIONALE

D3 provides mathematical primitives, scales, axes, path generators, and
transition machinery from which arbitrary visual forms can be composed. The time
scale selects appropriate tick intervals and label formats automatically as the
visible range changes, which is essential for time range controls across orders
of magnitude from intraday to all-time. The transition system is fully
programmable, enabling variable-speed replay where the animation rate is
controlled by the server and can change mid-session. The rendering layer is
composable, so a live price path and a model prediction overlay can be
maintained as independent rendering layers sharing a coordinate system and
updated at different cadences without interference. Chart forms with no library
equivalent can be built from primitives without fighting a configuration model.

## CONSEQUENCES

**Positive**: complete control over every visual element enables charts that
function as research arguments rather than data displays. D3's time scale
handles financial time series edge cases natively. D3 is institutionally stable
and tree-shakeable; only the modules in use are bundled.

**Negative**: D3 provides no chart types; every chart is built from primitives,
and development time per chart is higher than with a configurable library.
Responsive behavior must be implemented explicitly per chart.

**Neutral**: D3 does not implement WebGL rendering; the library used for
three-dimensional surface plots is a separate decision deferred until the first
model requiring a 3D chart is introduced.
