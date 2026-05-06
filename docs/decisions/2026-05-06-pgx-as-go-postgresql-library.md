# pgx as the Go PostgreSQL client library

DATE: 2026-05-06

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

Prior decisions establish Go as the application server language
(`2026-04-11-go-as-backend-language`) and PostgreSQL as the database
(`2026-04-18-postgresql-as-database`). The Go application server must open
connections to PostgreSQL, issue queries, and read results. This requires a
client library that speaks the PostgreSQL wire protocol.

## DECISION

`pgx` (`github.com/jackc/pgx/v5`) is the Go PostgreSQL client library. The
`pgxpool` sub-package, which ships inside the `pgx` repository, manages a pool
of reusable connections.

## ALTERNATIVES CONSIDERED

**`database/sql` with a compatible driver**: Go's standard library contains a
`database/sql` package that defines a generic database interface any driver can
implement. Using it as the primary interface to PostgreSQL, backed by a driver
such as `pgx`'s `stdlib` compatibility shim or `lib/pq`, is a valid option for
projects that require database portability. Its design targets the lowest common
denominator across database vendors, which means it cannot surface
PostgreSQL-specific features: `LISTEN/NOTIFY`, the `COPY` protocol for bulk data
transfer, binary encoding for result columns, and batch query execution are all
inaccessible through the standard interface. Its built-in connection pool is
less configurable than `pgxpool`. Rejected because the project is committed to
PostgreSQL and acquires no portability benefit worth having; using
`database/sql` as the primary interface forfeits PostgreSQL-specific
capabilities without compensation.

**`lib/pq`**: An early PostgreSQL driver for Go that implements the
`database/sql` interface. It was the standard choice before `pgx` matured and
remains present in a large proportion of older Go codebases. It is no longer
actively maintained and receives no new features. It uses the Simple Query
Protocol for parameterized queries, meaning every execution incurs a full
parse-plan-execute cycle on the server, and results are always transferred in
text rather than binary format. Rejected because it is unmaintained and
technically inferior to `pgx` on every dimension relevant to this project.

**`sqlx`**: A library that extends the `database/sql` interface with ergonomic
improvements: scanning query results directly into structs by column name, named
query parameters, and slice expansion for `IN` clauses. It does not replace the
driver beneath it; it wraps `database/sql`. Rejected because it inherits all of
`database/sql`'s limitations: PostgreSQL-specific features remain inaccessible,
and the additional reflection-based scanning layer introduces overhead absent
from `pgx`'s native interface. The ergonomic problem `sqlx` solves, manually
scanning each result column into a struct field, is addressed more thoroughly at
compile time by a code generation tool, making `sqlx`'s runtime approach
redundant.

**`GORM`**: A full object-relational mapper. `GORM` abstracts SQL away entirely:
the caller defines Go structs and `GORM` translates struct operations into
queries, manages schema migrations, and handles associations. It supports
multiple database backends, which is the source of both its appeal and its
limitations. Multi-database support requires that `GORM` avoid all
PostgreSQL-specific capabilities, including `JSONB` operations, window
functions, and `CTE`s that fall outside standard SQL. Generated queries are
opaque, making query plan analysis and index reasoning difficult. Benchmarks
consistently show 30 to 50 percent throughput degradation relative to `pgx`
native for equivalent workloads. Rejected because the project requires
transparency and control over its data access layer, which ORM-level abstraction
prevents.

## RATIONALE

`pgx` is the only actively maintained library that speaks the PostgreSQL wire
protocol natively in Go without the `database/sql` abstraction layer. Its native
interface uses the Extended Query Protocol by default, caches prepared
statements, and transfers result data in binary format, reducing payload size
and deserialization cost. PostgreSQL-specific features are accessible through
the native interface, including `LISTEN/NOTIFY`, which is directly relevant to
the medium-frequency live-updating page type that will require server-push
notifications from the database to the Go server. `pgxpool` manages a
configurable pool of reusable connections, which is required in a concurrent
HTTP server where multiple goroutines issue queries simultaneously.

## CONSEQUENCES

**Positive**: full access to PostgreSQL-specific capabilities including
`LISTEN/NOTIFY`, `COPY`, and batch queries. Binary result transfer reduces
payload size and deserialization overhead. Statement caching reduces per-query
planning cost on the server. `pgx` is under active maintenance with a stable
versioned API.

**Negative**: the `pgx` native interface does not implement `database/sql`, so
third-party libraries that depend on `database/sql` cannot be used directly with
`pgx` without its `stdlib` compatibility shim, which forfeits the native
interface's advantages. The native interface requires manual result scanning
unless `sqlc` or an equivalent tool is adopted separately.

**Neutral**: `sqlc` is the natural companion to `pgx` for eliminating manual
result scanning at compile time; that decision is deferred until the data access
layer's friction points are visible.
