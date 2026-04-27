# Virtual private server as the hosting model

DATE: 2026-04-27

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

Prior decisions establish that the system runs as a set of separate persistent
processes (`2026-04-16-persistent-processes-as-runtime-architecture`) organised
and supervised by Docker Compose
(`2026-04-16-docker-compose-as-process-organisation`). Together these decisions
describe a system composed of long-running containers defined in a
docker-compose.yml file committed to the repository. They do not specify the
category of infrastructure on which that system runs. This decision answers that
question: what class of hosting arrangement is compatible with and appropriate
for the described runtime architecture.

## DECISION

The system is deployed to a virtual private server running a Linux operating
system under the project's administrative control.

## ALTERNATIVES CONSIDERED

### Plausible alternatives

**Platform-as-a-service**: Services such as Render, Railway, and Fly.io accept a
repository or a container image, manage the runtime environment, and expose the
application on a public URL. They abstract away operating system configuration,
process supervision, and server maintenance. Several of these platforms accept a
`docker-compose.yml` as a deployment descriptor, making them superficially
compatible with the process organisation decision. Rejected because
compatibility is partial. PaaS platforms impose their own process lifecycle
management on top of whatever the compose file describes, handle restart
policies and health checking through their own mechanisms, and restrict access
to the underlying host in ways that conflict with direct supervision via Docker
Compose. Network configuration between services, environment variable injection,
and volume handling are all mediated by the platform rather than declared in the
compose file, which undermines the property that the compose file is the
authoritative description of how the system is assembled. Egress costs and
per-service pricing models also scale poorly relative to a fixed server cost as
the number of components grows.

**Managed container orchestration**: Services such as Amazon ECS, Google Cloud
Run, and Azure Container Apps manage the scheduling and execution of containers
without requiring the project to administer a server directly. They handle
scaling, restart, and placement. Rejected because these platforms are designed
for distributed workloads across multiple machines and expose configuration
surfaces of considerable complexity in exchange for that capability. Docker
Compose is not their native deployment descriptor, and the compose file would
not translate directly without tooling that reinterprets it. The project's scale
does not approach the point where multi-host distribution is required. The
operational overhead introduced is not justified by any capability the project
currently needs.

**Bare metal server**: A physical machine rented from a provider rather than a
virtualised instance. Provides full hardware access and eliminates the
virtualisation layer. Rejected because the cost is higher than a virtual machine
at equivalent specifications, provisioning is slower, and hardware failure is
the operator's problem to recover from rather than the provider's problem to
replace. The performance difference between bare metal and a well-provisioned
virtual machine is not material for this project's current workload.

### Excluded by prior decisions

The following categories are listed not as rejected alternatives but as
arrangements that prior decisions make structurally incompatible, recorded here
to make that incompatibility explicit.

**Serverless functions**: Platforms such as AWS Lambda, Google Cloud Functions,
and Cloudflare Workers execute individual functions in response to events,
spinning up a runtime on demand and tearing it down after the invocation
completes. This model is directly incompatible with
`2026-04-16-persistent-processes-as-runtime-architecture`, which establishes
that system components run as separate persistent processes that remain running
for the duration of the system's operation. A serverless function by definition
does not persist. The warm start problem, in which a cold invocation pays the
full startup cost of the Python engine and its scientific library imports, is
precisely the problem that decision was made to avoid.

**Edge compute runtimes**: Platforms such as Cloudflare Workers and Deno Deploy
distribute execution across a global network of lightweight runtimes close to
users, with strict constraints on what code can run, how long it can run, and
what resources it can access. These constraints are incompatible with the
project's runtime architecture for the same reasons as serverless functions. The
calculation engine's dependencies, NumPy, Pandas, and SciPy, cannot run in a V8
isolate. The database cannot be co-located at the edge without a distributed
database arrangement the project has not adopted.

## RATIONALE

A virtual private server running Linux under the project's administrative
control is the only hosting model that is simultaneously compatible with the
full set of prior decisions and appropriate for the project's current scale. It
provides a persistent Linux environment on which Docker and Docker Compose run
without modification or platform-imposed mediation, preserving the property that
the compose file is the authoritative description of the running system.
Administrative access to the host means the project is not dependent on a
platform's interpretation of its deployment descriptor. All components,
including the database, the application server, the calculation engine, and any
future additions, run under a single consistent supervision model on a single
machine, which is all the project's current scale requires.

## CONSEQUENCES

**Positive**: the `docker-compose.yml` is the authoritative and unmediated
description of the running system. No platform interposes its own process
lifecycle management. Administrative access to the host allows direct debugging,
log inspection, and configuration changes without a platform intermediary. Cost
is fixed and predictable regardless of the number of components.

**Negative**: operating system maintenance, security updates, and server
configuration are the project's responsibility rather than a managed platform's.
Failure of the host machine requires manual recovery or a pre-established
failover arrangement. The project has a single point of failure at the
infrastructure level.

**Neutral**: the choice of provider for the virtual private server, including
the specific region, machine specifications, and pricing model, is a separate
decision. This decision establishes only the hosting model category.
