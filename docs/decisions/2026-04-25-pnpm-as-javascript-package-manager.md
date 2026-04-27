# pnpm as the JavaScript package manager

DATE: 2026-04-25

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

A prior decision (`2026-04-25-nodejs-as-frontend-build-runtime`) establishes
Node.js as the runtime for the frontend build step. The build step requires
Astro, React, and their dependency graphs to be installed and available before
execution. A package manager is required to resolve, fetch, and install those
dependencies. The package manager operates at build time only, on developer
machines and in the CI/CD pipeline. It has no presence in production.

## DECISION

pnpm is used as the JavaScript package manager.

## ALTERNATIVES CONSIDERED

**npm**: Ships bundled with Node.js and requires no additional installation.
Uses a flat node_modules structure in which every package in the resolved
dependency graph is installed as a direct sibling, regardless of whether it was
explicitly declared. This structure allows code to import packages that were
never declared as dependencies, because they were installed as transitive
dependencies of something that was declared as dependencies. npm does not detect
or prevent this at install time. Disk usage is high: each project receives its
own full copy of every dependency, with no sharing across projects on the same
machine. Rejected because pnpm addresses both of these properties without
meaningful trade-offs at this project's scale.

**Yarn Classic (version 1)**: Introduced a deterministic lockfile before npm did
and was faster than early npm at the time of its release. Now in maintenance
mode, receiving no new features. Its node_modules structure carries the same
flat layout and the same implicit dependency access problem as npm. Rejected
because it offers no advantage over pnpm and is no longer actively developed.

**Yarn Berry (version 2 and later)**: A complete rewrite of Yarn with a
Plug'n'Play mode that eliminates node_modules entirely, replacing it with a
generated resolution map and a global package cache. PnP enforces strict
dependency declarations and enables zero-installs, in which the cache is
committed to the repository and no install step is required on a fresh checkout.
Rejected because PnP compatibility with tooling that assumes node_modules is
present is uneven, and the zero-installs feature, while technically interesting,
commits the package cache to the repository and substantially increases its
size. The Yarn Berry nodeLinker setting can restore a node_modules layout, which
resolves compatibility concerns but surrenders PnP's primary advantages. pnpm
provides the same strictness guarantees with higher ecosystem compatibility and
without repository bloat.

**Bun as package manager under Node.js**: Bun's package manager can be used
independently of the Bun runtime, installing packages into a standard
node_modules layout consumable by Node.js. It is the fastest of the available
options. Rejected because its lockfile is a binary format that is not
human-readable, which conflicts with the legibility values applied elsewhere in
the project, and the speed advantage over pnpm is not meaningful at this
project's dependency count and install frequency.

## RATIONALE

pnpm maintains a global content-addressable store on the developer's machine.
Packages are downloaded once to this store and hard-linked into each project's
node_modules. A hard link is a second filesystem reference to the same
underlying data, not a copy, so disk usage does not multiply across projects
that share dependencies. pnpm's node_modules structure is non-flat: each
package's node_modules contains only the packages that package explicitly
declared, preventing code from importing transitive dependencies it never
declared. This strictness catches accidental reliance on transitive packages at
install time rather than at the point where a dependency upgrade silently
removes them. The lockfile is pnpm-lock.yaml, a human-readable text format
consistent with the legibility values the project applies elsewhere. Ecosystem
compatibility is high because node_modules remains present and structurally
recognizable to tools that expect it. Workspace support is mature and will be
available if the repository structure requires it.

## CONSEQUENCES

**Positive**: disk usage across projects sharing dependencies is substantially
lower than npm or Yarn Classic. Implicit transitive dependency access is
prevented by the node_modules structure. The lockfile is human-readable. Install
speed is meaningfully faster than npm.

**Negative**: pnpm is not bundled with Node.js and requires installation, via
npm install -g pnpm or via the recommended standalone installer. Contributors
must have it installed before they can run the project. The non-flat
node_modules structure occasionally causes compatibility issues with tooling
that assumes the flat layout, though this is uncommon in the current ecosystem.

**Neutral**: the global store is a per-machine concern and does not affect the
repository or the CI/CD pipeline beyond requiring pnpm to be available in the
pipeline environment, which is a one-line addition to any standard CI
configuration.
