# JSON as the body format for inter-process communication

DATE: 2026-04-16

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

A prior decision (`2026-04-16-http-as-inter-process-communication-protocol`)
establishes HTTP as the protocol for communication between system components.
HTTP governs the structure of requests and responses as envelopes but does not
specify the format of their bodies, the content carried inside those envelopes.
This decision settles that question. The body format determines how data is
serialized into bytes for transmission and deserialized back into program-native
values on the receiving side. The choice affects payload size, serialization
speed, and the legibility of payloads during development and debugging.

## DECISION

Request and response bodies in inter-process communication are formatted as
JSON.

## ALTERNATIVES CONSIDERED

**MessagePack**: A binary encoding that represents the same data model as JSON,
strings, numbers, booleans, null, arrays, and maps, but in a compact binary form
rather than text. Payloads are typically 30 to 50 percent smaller than
equivalent JSON and serialization and deserialization are faster because no text
conversion is required. Schema-free, like JSON, meaning no schema files or code
generation step is required. Rejected for now because the performance advantage
over JSON is not justified by a measured bottleneck. MessagePack is the most
natural first alternative if JSON serialization proves too slow, and the
migration is bounded: the protocol remains HTTP, the change is localised to the
serialization and deserialization calls at the boundary between Go and Python.

**Protocol Buffers**: A binary encoding defined in schema files, also used by
gRPC. More compact and faster than JSON. Enforces a machine-checked contract
between the two sides through generated code. Rejected because the schema files
and code generation step add toolchain complexity that is not justified at this
stage. If the project migrates to gRPC as the protocol, Protocol Buffers follow
as a consequence of that decision and would be recorded there.

**Numpy binary format**: The native binary serialization format of the numpy
numerical computing library. Near-zero encoding overhead for numerical arrays.
Rejected because Go has no native understanding of the format, requiring a
custom parser or tight coupling to numpy's internal representation. Only viable
if Go never needs to inspect the numerical values it forwards, which cannot be
assumed.

## RATIONALE

JSON is the format with the widest library support and the most familiar
debugging experience. The Go standard library contains a full JSON encoder and
decoder. Python's standard library contains the same. Request and response
bodies are human-readable text, meaning logged payloads are directly
interpretable without tooling or schema knowledge. A body can be read in a log,
printed to a terminal, or inspected with curl at any point during development.
This legibility is most valuable early in the project when the data model is
still being defined and unexpected behavior is most likely. The serialization
cost of representing numerical data as text rather than binary is real but has
not been observed as a bottleneck.

## CONSEQUENCES

**Positive**: payloads are human-readable and require no tooling to inspect.
Standard library support in both Go and Python. No schema files, no code
generation, no additional dependencies. The data model can evolve without
ceremony during early development.

**Negative**: text serialization of numerical data is slower and produces larger
payloads than binary alternatives. For requests involving large numerical
arrays, this cost may become observable as the engine's workload grows.

**Neutral**: if JSON serialization proves to be a bottleneck, MessagePack is the
natural first replacement. The migration is localised and does not affect the
protocol, the process architecture, or the deployment model.
