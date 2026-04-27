# Go as the application server language

DATE: 2026-04-11

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

A prior decision (`2026-04-11-not-python-as-backend-language`) established that
the application server is implemented in a language other than Python, and that
the specific language would be recorded separately. The application server is
responsible for HTTP connection handling, request routing, user authentication,
session management, and coordination between the frontend and the calculation
engine. It is a continuously running process with uniform resource consumption,
distinct in operational profile from the engine.

## DECISION

The application server is implemented in Go.

## ALTERNATIVES CONSIDERED

**Node.js with TypeScript**: A credible and widely used application server
context with a large ecosystem and high contributor familiarity in web
development contexts. The concurrency model is event-loop based. A single
JavaScript thread handles all requests by avoiding blocking: I/O operations are
initiated asynchronously, a callback or promise is registered, and the event
loop moves on. This is efficient for I/O-bound workloads but requires that
nothing in the call path performs blocking work. A synchronous operation
anywhere in the chain stalls the entire event loop and prevents all other
requests from being handled until it completes. Maintaining this discipline
across a growing codebase with multiple contributors is a cost. The project
expects the application server to maintain simultaneous persistent connections
to multiple medium-frequency data streams while concurrently serving user
requests. In Node.js this requires that every component in that stack,
connection handlers, stream processors, request handlers, database calls,
remains non-blocking throughout. A single blocking call introduced by a
contributor unfamiliar with the constraint degrades the entire server's
responsiveness. The memory profile is also a concern. Node.js runs on the V8
engine, which includes a JIT compiler, a garbage collector, and a substantial
heap. Under load, a Node.js application typically consumes several hundred
megabytes. On constrained infrastructure, this competes directly with the
calculation engine for available memory, which is precisely the problem the
language boundary was introduced to avoid. TypeScript's type system is good and
catches a large class of errors at development time. However, types are erased
at runtime. TypeScript's guarantees hold only as far as type definitions are
accurate and complete, and it is possible to bypass them with type assertions
and the any escape hatch. Runtime errors that a fully compiled language would
surface at build time can still occur. However, npm contains more packages than
any other language registry, and for web server work the coverage is
comprehensive. This advantage does not outweigh the concurrency and memory
concerns at this project's probable deployment profile.

**Rust**: Compiled to a native binary, lower memory footprint than Go,
exceptional throughput, and a concurrency model that is safe by construction in
ways Go is not. The case for Rust on technical grounds is strong. Rejected
because the learning curve is steep, the contributor pool is significantly
smaller than Go's, and the web server ecosystem, while growing, is less mature.
The technical gains over Go are real but not large enough to justify the
contributor accessibility cost for this project.

**Java with Kotlin**: Mature, well understood for web server work, with a large
ecosystem and a substantial contributor pool in enterprise contexts. Modern JVM
with GraalVM native image has addressed the historically problematic startup
time and memory consumption. Rejected because the toolchain overhead, build
configuration, dependency management, and JVM-specific operational concerns, is
meaningful for a small project, and the contributor profile in open source
quantitative finance is unlikely to skew toward JVM languages.

**C#**: Mature, performant, and well designed for web server work. ASP.NET Core
is a capable framework with good throughput and a reasonable memory profile,
particularly in recent versions where the runtime has been substantially
optimised. The language is statically typed and compiled, sharing Go's
correctness guarantees at build time. Rejected primarily on contributor
accessibility grounds. C# and the .NET ecosystem are well represented in
enterprise and Microsoft-adjacent contexts but have a small footprint in open
source projects of this kind. The technical case is credible but the contributor
pool argument does not favour it.

**Elixir**: The Erlang VM's concurrency model is specifically designed for
massive numbers of lightweight concurrent processes and is technically
compelling for the connection-heavy workload described in this project. The
Phoenix framework is mature. Rejected because the contributor pool is small and
the language is unfamiliar to the majority of likely contributors.

## RATIONALE

Go compiles to a native binary with minimal runtime overhead. Memory consumption
is low and predictable, leaving meaningful headroom for the calculation engine
on constrained infrastructure. The goroutine-based concurrency model handles
many simultaneous connections natively, without requiring async discipline
throughout the codebase. Each connection or request is handled by its own
goroutine in sequential code. Go's standard library for HTTP is mature and
covers a substantial portion of web server requirements. The type system
enforces correctness at compile time without runtime erasure. The toolchain is
simple: one tool handles building, testing, formatting, and dependency
management. The ecosystem is smaller than Node.js but sufficient and stable,
with lower dependency management overhead as a consequence.

## CONSEQUENCES

**Positive**: the application server's memory footprint is low and leaves
headroom for the calculation engine. Concurrent connections are handled
naturally without async discipline requirements. The compiled binary has no
runtime dependency beyond the operating system. The type system catches
interface errors at build time.

**Negative**: contributors working on the application server must know Go. The
Go ecosystem, while sufficient, is narrower than Node.js and may occasionally
require more implementation work where a Node.js library would exist off the
shelf. The language boundary between Go and Python means cross-cutting changes
require familiarity with both.

**Neutral**: the application server and calculation engine communicate over a
defined network interface whose format is not settled by this decision. The
choice of protocol, REST, gRPC, or other, is a separate decision. Go has mature
library support for all common options.
