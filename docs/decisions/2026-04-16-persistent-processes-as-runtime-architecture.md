# Separate persistent processes as the default runtime architecture

DATE: 2026-04-16

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

Prior decisions establish Go as the application server language
(`2026-04-11-go-as-backend-language`) and Python as the calculation engine
language (`2026-04-10-python-as-engine-language`). These decisions treat the two
components as distinct but do not specify how they coexist at runtime. The Go
and Python pair is the immediate occasion for this decision, but the question it
answers is not limited to those two components. The decision is therefore stated
as a general principle governing future components as well, with the exception
conditions under which an on-demand or in-process arrangement remains
appropriate recorded explicitly below.

## DECISION

System components run as separate persistent processes by default. Each
component is started once, remains running for the duration of the system's
operation, and is managed independently. An on-demand or in-process arrangement
is appropriate only when a component has negligible startup cost, requires no
in-memory state between calls, and is invoked infrequently enough that the
overhead of a persistent process, supervision, health checking, and readiness
detection, is not justified by the call volume.

## ALTERNATIVES CONSIDERED

**Embedded Python in the Go process**: The Python interpreter is embedded inside
the Go binary via CGo, Go's facility for calling C code directly, and Python's C
API. The engine is invoked as a library rather than as a separate process. There
is no process boundary and no inter-process communication. Rejected because CGo
introduces substantial build complexity. The Go garbage collector and Python's
memory management do not cooperate naturally, and the boundary between them is a
persistent source of subtle errors. The performance advantage of eliminating the
process boundary is modest when the alternative is a persistent local process,
and it does not justify the build and operational complexity the arrangement
entails.

**On-demand subprocess via `os/exec`**: Go spawns a new Python child process for
each computation using the `os/exec` standard library package. The child process
starts the Python interpreter, imports required libraries, performs the
calculation, writes its result to standard output, and exits. Rejected because
the scientific Python libraries the engine depends on, NumPy, Pandas, SciPy, and
their dependents, carry a cold start cost on every process launch: the
interpreter must initialise and each library must be imported from scratch. For
computations that are intrinsically fast, startup time could dominate total
latency and is directly visible to the user. A persistent process pays this cost
once at startup. The on-demand model also forecloses the engine maintaining any
in-memory state between calls, which prevents a class of optimisations, keeping
loaded datasets, pre-computed intermediates, or initialised model objects
resident across requests, that a persistent process makes available. The
on-demand subprocess model remains appropriate for components that meet
exception criteria.

## RATIONALE

A persistent process loads its runtime and dependencies once at startup. All
subsequent calls find the process already initialised. State can be held in
memory across calls. Each component can be restarted, configured, and eventually
relocated to separate hardware independently without disrupting others. The
infrastructure required to run multiple persistent processes, a network
connecting them, a supervision mechanism, and health checking, will be present
in this project regardless of what is decided for the Go and Python pair
specifically. A database and a proxy server are anticipated components and both
are persistent processes in all realistic configurations. Extending the same
model to the Go and Python pair, and to future components by default, does not
introduce new operational infrastructure so much as populate infrastructure that
must exist anyway. The marginal cost of each additional persistent component
within an already-running multi-process network is lower than the cost of
establishing that network in the first place. Stating this as a general
principle rather than a decision scoped to the current two components records
the architectural intent explicitly and provides a basis for evaluating future
components against it, either conforming to the default or recording a deviation
as a decision.

## CONSEQUENCES

**Positive**: startup costs are paid once per component. In-memory state
persists across calls within a component. Components can be restarted
independently. The model is consistent across the system and does not require
per-component decisions for components that straightforwardly meet the default.
The infrastructure cost is shared with components, the database and proxy
server, that require it independently.

**Negative**: persistent processes must be started, kept running, and monitored.
Components that call other components must be able to detect readiness before
dispatching work. Process supervision and health checking are operational
concerns that on-demand subprocess invocation does not introduce.

**Neutral**: how processes communicate is not settled by this decision and is
deferred to a subsequent ADR. How processes are organised, started, and
supervised at the deployment level is similarly deferred. Future components that
meet the exception criteria may be run on-demand without requiring a superseding
decision, but deviations from the default that reflect an architectural choice
should be recorded.
