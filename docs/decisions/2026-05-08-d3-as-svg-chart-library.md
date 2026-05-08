# D3 as the visualization library

DATE: 2026-05-08

SUPERSEDES: `2026-05-04-d3-as-chart-library`

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

A prior decision (`2026-05-07-svg-as-2d-chart-engine`) establishes that
two-dimensional charts use SVG. The project's intellectual contribution is not
novel models but novel ways of making established models visible, interactive,
and intuitive to a retail investor audience. This places unusual demands on the
visualization layer: charts require time range controls with correct axis
behavior across zoom levels, variable-speed replay of historical data, live data
stream rendering with model prediction overlays updating at independent
cadences, and parameter-driven model recalculation visualized in real time. No
library provides these as built-in chart types.

## DECISION

D3 is the visualization library.

## ALTERNATIVES CONSIDERED

**Apache ECharts**: Rejected because its animation system does not expose
programmatic control over duration, easing, cancellation, or queuing;
variable-speed replay requires this control. Unusual chart forms are
configuration problems in ECharts and composition problems in D3.

**Chart.js**: Rejected because it provides configurable standard chart types
rather than visualization primitives; the chart forms this project requires
cannot be expressed as Chart.js configurations.

**Plotly.js**: Rejected because it provides configurable chart types rather than
visualization primitives. Bundle size is large relative to the charts it would
contribute.

**Nivo**: Rejected for the same reason as Chart.js and Plotly.js: it provides
configurable chart types, not primitives from which arbitrary visual forms can
be composed.

## RATIONALE

D3 provides scales, path generators, and transition machinery as composable
primitives rather than chart types. Its time scale selects tick intervals and
label formats automatically across zoom levels without configuration. The
transition system exposes duration, easing, cancellation, and queuing
programmatically, with animation rate adjustable mid-session. Independent data
layers share a coordinate system and update at different cadences without
interference. Scales produce pixel coordinates and path generators produce SVG
path strings, integrating directly with the SVG rendering layer. D3 is
institutionally stable and tree-shakeable.

## CONSEQUENCES

**Positive**: complete control over every visual element enables charts that
function as research arguments. D3's time scale handles financial time series
edge cases natively. Only modules in use are bundled.

**Negative**: D3 provides no chart types. Every chart is built from primitives;
development time per chart is higher than with a configurable library.

**Neutral**: the three-dimensional chart library decision remains deferred until
the first model requiring a 3D chart is introduced.
