# Node.js as the JavaScript runtime for the frontend build step

DATE: 2026-04-25

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

Prior decisions establish Astro as the frontend framework
(`2026-04-18-astro-as-frontend-framework`) and build-time static generation as
the HTML production strategy
(`2026-04-18-build-time-as-frontend-html-generation`). The build step, in which
Astro reads source files, executes React components, and writes static HTML and
JavaScript bundles to disk, is a JavaScript program and requires a JavaScript
runtime to execute. No JavaScript runtime runs in production; this decision
concerns only the runtime under which the build step executes, on developer
machines and in the CI/CD pipeline.

## DECISION

The frontend build step runs under Node.js.

## ALTERNATIVES CONSIDERED

**Bun**: A JavaScript runtime that includes a bundler, package manager, and test
runner as an integrated offering. Astro officially supports Bun. Its package
manager is substantially faster than Node.js equivalents, and its runtime
performance for build tasks is higher. Rejected because Bun is younger and less
battle-tested than Node.js, its binary lockfile format is not human-readable,
which conflicts with the legibility values the project applies elsewhere, and
the speed advantage is not meaningful at the build frequencies and file counts
the project anticipates. The integrated package manager is bundled with a
runtime that introduces compatibility risk, and accepting the runtime in order
to access the package manager inverts the correct priority.

**Deno**: A JavaScript runtime by the original author of Node.js, designed to
correct several of Node.js's early design decisions. Astro officially supports
Deno. It has native TypeScript support, a permission model for sandboxing
runtime access to the filesystem and network, and a cleaner module system.
Rejected because it is meaningfully less common in practice than Node.js for
this class of build tooling, CI/CD environment support is thinner, contributor
familiarity is lower, and the advantages it offers over Node.js are not relevant
to a build step that runs in a controlled environment.

## RATIONALE

Astro was developed and is primarily tested against Node.js. The LTS release
cadence provides a stable and well-supported target. Every CI/CD environment in
common use ships Node.js support without configuration. Contributors are
overwhelmingly likely to have Node.js already installed.

## CONSEQUENCES

**Positive**: the build environment is the same on every developer machine and
in every CI/CD pipeline without configuration. Contributor onboarding requires
no runtime installation in most cases. Astro's documentation and bug reports
consistently assume Node.js, meaning troubleshooting draws on the largest
available knowledge base.

**Negative**: Node.js is the slowest of the three supported runtimes for Astro
builds. This is not currently a meaningful cost but becomes one if the project
grows to a very large number of model pages and build times become a contributor
friction point.

**Neutral**: if build performance degrades to the point of blocking
contributors, migrating to Bun as the build runtime is a bounded operation that
does not affect the production architecture, the Go server, or the Python
engine.
