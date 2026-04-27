# Client-side calculation via Pyodide as the default model execution strategy

DATE: 2026-04-18

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

The Python engine contains the quantitative models whose outputs are displayed
and explored on model pages. Interactive elements allow users to adjust
parameters and observe how outputs change. This requires executing model code in
response to parameter changes.

## DECISION

Model calculations run client-side via Pyodide by default. Pyodide is a port of
the CPython interpreter and the scientific Python stack to WebAssembly, allowing
Python code to run inside the browser without a server round trip. Server-side
execution via Go is used for a specific model when client-side execution is not
viable, for example due to dependency on libraries unavailable in Pyodide, data
volumes too large to transfer to the browser, or computation too expensive for
the browser's memory or CPU budget. The default requires an explicit reason to
override on a per-model basis.

## ALTERNATIVES CONSIDERED

**Alternative Python-in-browser runtimes**: MicroPython is a Python interpreter
compiled to WebAssembly at a fraction of Pyodide's bundle size but does not
support the scientific Python stack and is not viable for quantitative models.
PyScript is a framework built on top of Pyodide rather than an independent
runtime. RustPython is a Python interpreter written in Rust that compiles to
WebAssembly but is experimental and lacks scientific library support. Brython
implements Python in JavaScript rather than WebAssembly with no scientific stack
support. None constitute a viable alternative for the project's use case. If the
constraint is scientific Python in the browser, Pyodide is the only
production-ready option.

**Server-side calculation only**: all parameter changes trigger API calls to the
Python engine via the Go server. The full scientific Python stack is available
without WebAssembly compatibility constraints, including QuantLib and any other
library with C extensions. Rejected as the default because server load scales
linearly with concurrent interactive users, every parameter change incurs a
network round trip degrading interactivity, and the infrastructure requirement
at realistic concurrent user counts is disproportionate to a research platform.
The server-side path remains available per model where client-side is not
viable.

**Client-side calculation only**: all models run via Pyodide with no server-side
fallback. Rejected because it is not viable as an absolute constraint. Models
requiring QuantLib or similar unported libraries, large input datasets, or
parallelism have no client-side path. Ruling out server-side execution in
advance forecloses legitimate future models.

## RATIONALE

Client-side execution eliminates network latency from the parameter exploration
loop and offloads computation to users' machines, meaning server infrastructure
scales with data access rather than with interactive usage. A research platform
whose traffic spikes when content is shared is particularly poorly served by
server-side computation, which buckles precisely when load is highest. Under
client-side Pyodide, traffic spikes are absorbed by users' machines and the
server handles only data queries. Python model source files are served as static
assets by the Go server and loaded into Pyodide at runtime, with the most recent
data fetched from the Go API on page load and passed into the model running in
the browser. No Python process is involved in interactive parameter exploration.
For models built on NumPy, SciPy, pandas, and scikit-learn, which covers most
initial model pages, Pyodide's execution speed is adequate and the interactivity
improvement over server round trips is significant. The initial load cost is
paid once per session rather than on every parameter change. Server-side
fallback is retained for models where client-side execution is not viable.

## CONSEQUENCES

**Positive**: parameter exploration is interactive without network latency for
models running client-side. Server load does not scale with concurrent
interactive users. Viral traffic spikes are absorbed by users' machines. The
same Python model code runs in the browser and on the server for batch
computation, keeping the implementation surface small.

**Negative**: Pyodide's initial load adds tens of megabytes to the first
session, requiring explicit UI handling during initialisation. Python's
threading and multiprocessing are unavailable in the browser's WebAssembly
environment. Browser memory limits constrain how much data a model can hold.
Models requiring libraries without WebAssembly builds must use server-side
execution. QuantLib, the most comprehensive open-source quantitative finance
library, has no WebAssembly build and is unavailable in Pyodide; models
requiring it for derivatives pricing, yield curve construction, or interest rate
modelling have to use server-side.

**Neutral**: the per-model execution strategy is a contribution-time decision
documented alongside each model. The Go API for server-side execution exists
regardless, as it serves data to the frontend independently of the calculation
question.
