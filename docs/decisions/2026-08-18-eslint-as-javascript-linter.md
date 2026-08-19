# ESLint as the JavaScript and TypeScript linter

DATE: 2026-08-18

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

A prior decision (`2026-04-11-go-as-backend-language`) brought a backend whose
toolchain includes `go vet`, and the publish workflow has gated on it from the
beginning: nothing reaches the registry unless the backend builds and vets
clean. The frontend has had no equivalent. A prior decision
(`2026-04-26-typescript-as-frontend-language`) chose a typed language, and the
type checker that would make that choice worth anything has never been run
outside an editor. A prior decision
(`2026-04-18-react-as-frontend-component-library`) brought React, whose rules
about hooks are real constraints that the language cannot express and the
compiler cannot see.

The practical result was that the frontend could ship a broken type, an unused
import, a hook called conditionally, or an image with no alternative text, and
nothing in the pipeline would notice. Astro builds a page with any of those in
it. The container healthcheck passes. The artefact guard in the workflow checks
that files were emitted, not that they are correct.

The other three sites in the estate already run a linter and a type check on
every publish. This one did not, which also meant a lesson learned in one
repository had nowhere to land here.

## DECISION

ESLint is used as the linter for JavaScript, TypeScript and Astro source.
`astro check` is used as the type check. Both run in three places: on demand
as `pnpm lint` and `pnpm check`, in the local preflight of `deploy.sh`, and as
a gate in the publish workflow, where a failure stops the image being built.

The configuration is ESLint's flat config, deliberately the same shape as the
other sites in the estate: the recommended rule sets from ESLint, from
typescript-eslint and from eslint-plugin-astro, plus the React hooks rules and
the accessibility rules on anything that renders markup.

## ALTERNATIVES CONSIDERED

**Nothing, as before**: Rejected. The asymmetry with the backend was not a
decision anybody made, it was an omission, and the first time the linter was
run it found six errors in code that had been serving traffic: two dead
constants, a dead binding, a dead import, eight state updates that could not
do anything, and a function call formatted so that it reads as two statements.
None of those would ever have surfaced on their own.

**Type checking only, without a linter**: Appealing because `astro check`
requires no new configuration and catches the most severe class of problem. It
also catches none of what was actually found: unused bindings, hook rules and
accessibility are all outside what a type system judges. Rejected as
insufficient on its own, and adopted alongside the linter rather than instead
of it.

**Biome**: A single fast binary covering both linting and formatting, written
in Rust, with no plugin ecosystem to assemble. Genuinely faster and simpler to
configure. Rejected because its Astro support is partial, the React hooks rules
are not the ones the React team maintains, and the other three repositories
here already run ESLint. Adopting a different linter for this one repository
would mean a rule learned anywhere in the estate could not be applied
everywhere, which is the specific cost this decision exists to avoid.

**oxlint**: Faster still, and increasingly complete. Rejected for the same
consistency reason, and because its type-aware rules were not mature at the
time of writing.

**A formatter as well, such as Prettier**: Deferred rather than rejected. The
existing source is consistently formatted by hand, at four-space indentation,
and introducing a formatter now would rewrite every file in a single commit and
bury the history of the ones that matter. Worth revisiting if the source ever
stops being consistent on its own.

## RATIONALE

ESLint is the only option that covers all three of the things this repository
needs judged and that the other three repositories are already using. The
plugin set is not incidental: eslint-plugin-astro understands the component
format the project builds pages in, typescript-eslint reads the types the
project chose to have, and the React hooks plugin is maintained by the same
people who define the rules it enforces.

Running the same tools in the preflight and in the workflow is deliberate
redundancy. The preflight fails in seconds on the developer's machine; the
workflow is the gate that cannot be skipped by someone who has not installed
the toolchain. Neither alone is enough: the first can be bypassed, the second
costs a round trip through a build to find a missing semicolon.

The generated pages under `frontend/dev/pages-removed-details` are excluded from
both tools. They are output, not source, they are already gitignored, and they
sit one folder deeper than the pages they are copied from, so their relative
imports do not resolve and every one of them reports errors nobody wrote.

## CONSEQUENCES

**Positive**: the frontend now has the same standing as the backend in the
pipeline, and neither can reach the registry without passing. A class of dead
code and formatting ambiguity that had accumulated silently is now visible at
the moment it is written. Accessibility mistakes, which are invisible to
everyone who is not affected by them, are caught mechanically. The estate has
one linting configuration rather than three plus an exception.

**Negative**: eleven development dependencies where there were none, an install
step in the publish workflow that did not exist, and roughly ten seconds added
to every publish. Rules occasionally flag correct code, and each of those needs
a judgement and a written reason rather than a reflexive disable.

**Neutral**: eslint-plugin-jsx-a11y has not yet declared support for ESLint 10
and installs with a peer dependency warning. It works, and the same warning is
present in the other three repositories, so it is a known state of the ecosystem
rather than a problem with this configuration.
