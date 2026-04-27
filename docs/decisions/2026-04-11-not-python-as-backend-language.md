# Python is rejected as the application server language

DATE: 2026-04-11

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

Python has been established in paralx as the language of the calculation engine.
A separate question is what language governs the application server. The engine
was chosen on the basis of ecosystem maturity, contributor accessibility, and
Python's dominance in quantitative research. The application server is selected
on different grounds: concurrency characteristics, memory footprint, and I/O
handling. This ADR records the decision that those grounds justify a language
boundary between the two components. The specific language for the application
server is to be recorded in another decision.

## DECISION

The application server is implemented in a language other than Python. The
specific language is determined in a subsequent decision. Python remains the
exclusive language of the calculation engine.

## CONSIDERATIONS

Python's Global Interpreter Lock prevents true parallelism within a single
process for CPU-bound work. Async frameworks such as FastAPI mitigate this for
I/O-bound workloads but require a fully non-blocking call path throughout. Any
synchronous operation in that path stalls the event loop. The project
anticipates a data layer operating at medium frequency: monitoring multiple
simultaneous input streams at intervals of seconds to minutes. At this cadence
the application server may maintain persistent connections to multiple external
sources while simultaneously serving user requests. Several languages handle
this class of workload more naturally than Python, with lower per-connection
resource consumption and without requiring full async discipline across the
codebase.

The project will initially run on modest infrastructure. That memory must be
shared across all running processes, including the database, the application
server, and the calculation engine. The engine's memory consumption is both
significant and variable. This consumption is the least compressible part of the
system: it is determined by the research requirements, not by engineering
choices. A Python application server running in that same memory envelope adds
overhead that is avoidable. The Python interpreter, loaded libraries, and worker
processes collectively consume memory that could otherwise be available to the
engine. Languages that compile to native binaries have substantially lower
runtime memory overhead. On a one-gigabyte instance, the difference between a
Python web server and a compiled alternative is meaningful.

User-facing latency has two distinct sources in this architecture. For requests
that trigger a model run, latency is dominated by engine calculation time.
Application server overhead in this case is negligible relative to the
calculation, and optimising it produces no meaningful improvement to what the
user experiences. A significant class of requests does not involve the engine at
all: authentication, session management, retrieval of pre-computed results, and
similar operations that the application server handles entirely on its own. For
this class, the application server's performance is the sole latency
contribution. There is no calculation time to dwarf it. A more performant
application server is directly and fully visible to the user in precisely these
cases.

The engine is CPU and memory intensive during calculation runs and largely idle
otherwise. The application server is continuously active with more uniform
resource consumption. Separate processes allow each to be configured, restarted,
and eventually relocated to different hardware independently. This benefit is
reduced while both run on the same physical server, but the separation preserves
the option without requiring a later architectural restructuring.

A multilingual architecture raises the question of contributor burden. However,
the engine is intended to be entirely self-contained behind a defined interface,
and a contributor adding or auditing a model works exclusively in Python. The
application server language is only required of contributors working on
infrastructure. The project effectively has two contributor profiles,
researchers in Python and infrastructure contributors in the application server
language. This is a cost that is accepted.

## ALTERNATIVES CONSIDERED

**Python for the application server, engine as imported library**: The engine is
a Python module imported directly by a Python web framework. One language, one
process, one deployment unit. No network call, no serialization, no interface
versioning. Debugging and testing require no cross-process coordination.
Rejected because it couples the web server and engine lifecycles irrevocably.
Preventing the web server from blocking on calculations requires async or thread
pool workarounds that reintroduce process separation implicitly while retaining
the memory and concurrency costs of a single Python runtime. Remains viable if
scope stays narrow and usage stays very low, and is noted as a fallback if the
multilingual architecture proves too costly for contributors.

**Python for the application server, engine as task queue worker**: The engine
runs as a separate Python worker process consuming jobs from a queue such as
Celery backed by Redis. The web server deposits tasks without blocking. Rejected
because it adds a third operational component, the queue, without addressing the
memory or concurrency concerns that motivate this decision. Queue infrastructure
introduces its own failure modes: tasks lost, queues filled, workers crashed
mid-calculation. This overhead is not justified when the application server
language change addresses the concurrency concerns more directly. A task queue
remains a candidate for internal engine parallelism independently of this
decision.

## RATIONALE

The application server and the calculation engine have different operational
profiles, resource characteristics, and concurrency requirements. Python is the
correct language for the engine. It is adequate but not optimal for the
application server given the anticipated workload. The separation preserves
Python for the component where it is unambiguously correct, keeps the research
contribution layer accessible without requiring a second language, and opens the
application server to languages better suited to concurrent connection handling
and memory-constrained deployment.

## CONSEQUENCES

**Positive**: the engine's memory and CPU headroom is not competed for by the
application server. The application server handles concurrent and I/O-bound
workloads more efficiently. Each component can be restarted, configured, and
eventually scaled independently. Research contributors work entirely in Python.
The engine interface is explicit and machine-readable.

**Negative**: a network interface between the two components must be defined,
maintained, and managed for compatibility as the engine evolves. Debugging
cross-component requests requires correlating logs across two processes in two
languages. Contributors making cross-cutting changes must know both languages.

**Neutral**: the engine interface, as a versioned artifact, requires governance
as the project grows. Changes to model inputs or outputs carry compatibility
implications that purely internal refactors do not. Whether this overhead is net
positive depends on interface stability over time.
