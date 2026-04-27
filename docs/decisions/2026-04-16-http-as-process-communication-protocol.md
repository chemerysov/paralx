# HTTP as the inter-process communication protocol

DATE: 2026-04-16

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

Prior decisions establish that system components run as separate persistent
processes (`2026-04-16-persistent-processes-as-runtime-architecture`) and that
those processes are organised and supervised by Docker Compose
(`2026-04-16-docker-compose-as-process-organisation`). Docker Compose is a
single-host tool: all containers run on the same machine and communicate over a
private virtual bridge network. This decision is explicitly downstream from that
constraint. The network path between components is a loopback-adjacent
connection with negligible latency and effectively unlimited bandwidth, which
narrows the field of considerations that apply to protocol selection.
Specifically, the efficiency arguments that favour binary protocols over text
protocols in distributed systems, where data crosses real network hops between
machines, carry less weight here. If the project migrates from Docker Compose to
a multi-host orchestrator such as Kubernetes, that constraint changes. The
format used for request and response bodies is a separate decision not settled
here.

## DECISION

Inter-process communication between system components uses HTTP. The Python
engine exposes an HTTP server. The Go application server makes HTTP requests to
it.

## ALTERNATIVES CONSIDERED

**gRPC**: A remote procedure call framework built on HTTP/2 with a binary
encoding defined in schema files. Offers a formal machine-checked contract
between the two sides enforced by generated code, native support for streaming
where a single call carries a sequence of messages in either direction, and more
efficient framing than plain HTTP for high-frequency calls. Rejected for now on
the grounds of toolchain familiarity and upfront complexity. gRPC requires
maintaining .proto schema files, running a code generation step that produces Go
and Python code from those files, and integrating that step into the build
process. Debugging requires gRPC-aware tooling rather than curl or a browser.
These costs are manageable in isolation but are higher when imposed at an early
stage when the codebase is being established and contributor familiarity with
the surrounding tools is still developing. The transition from HTTP to gRPC,
should it become warranted, is bounded: the process architecture, the deployment
model, and the languages do not change. Only the protocol spoken across the
interface changes. The interface between components should be kept narrow and
explicit so that this migration remains a contained operation if it is required.

**Other protocols**: JSON-RPC, MessagePack-RPC, Thrift, ZeroMQ, and raw TCP with
a custom protocol are all technically viable but offer no advantage over HTTP at
this scale that justifies deviating from the most familiar and well-supported
option. ZeroMQ has a following in scientific computing contexts and is noted as
a candidate if the project develops internal data pipeline requirements that do
not fit the request-response model, but it is not appropriate as the primary
communication protocol at this stage.

## RATIONALE

HTTP is the protocol with the widest library support, the most familiar
debugging tools, and the lowest barrier to contribution. The Go standard library
contains a full HTTP client and server. Python's Flask and FastAPI are mature
HTTP server frameworks. Every contributor likely to work on either component
already knows HTTP. A request to the Python engine can be inspected, replicated,
and debugged with curl or a browser without writing any application code. HTTP
header overhead per request is real but not material on a single-host Docker
Compose deployment at low call frequency. The project does not yet have an
observed performance bottleneck attributable to the protocol, and the
appropriate time to pay gRPC's toolchain cost is when that bottleneck appears
and is measured.

## CONSEQUENCES

**Positive**: inter-process communication is immediately debuggable with
standard tools. Contributors need no protocol-specific knowledge beyond HTTP.
The interface is introspectable without specialised tooling. No code generation
step is required.

**Negative**: HTTP header overhead is proportionally higher for small frequent
calls than for infrequent calls with heavy payloads. gRPC's HTTP/2 framing is
more efficient for high-frequency inter-service communication, and if call
frequency grows significantly this difference may become observable.

**Neutral**: the interface between the Go application server and the Python
engine should be kept narrow and explicit so that a migration to gRPC remains a
bounded operation if HTTP proves insufficient. If the project migrates to a
multi-host orchestrator, the assumptions underlying this decision change and the
protocol choice should be reconsidered at that point.
