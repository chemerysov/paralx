# Architecture Decision Record system as the project decision format

DATE: 2026-04-09

STATUS: Accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

The project will involve contributors of varying technical backgrounds.
Decisions about architecture, infrastructure, tooling, and process need to be
recorded in a format that is legible to all contributors, durable, and navigable
without specialized knowledge.

## DECISION

Decisions are recorded as individual files in the `docs/decisions/` folder,
following the Architecture Decision Record convention. Each file covers one
decision, is named by date and subject, and is never deleted or rewritten, only
superseded by a newer file.

## ALTERNATIVES CONSIDERED

**Nothing**: Rejected because code records what was decided but not why.
Explicitly recording rationale resists accepting tools and instincts unchecked,
gives future human contributors immediate context, and gives future AI
contributions a clear basis to work from.

**Commit messages**: Rejected because navigating and searching git history is
significantly more demanding than browsing a folder of files, and some
decisions, infrastructure choices in particular, have no natural home in a
commit.

**Single running log file**: Rejected because superseding old decisions is
structurally messy and the format degrades as the project grows.

**Inline documentation**: Not entirely rejected. Remains appropriate for small
localized decisions such as utility library choices. Rejected as the primary
system because significant decisions are rarely localized to a single file.

**Wiki**: Rejected because wikis live outside the repository, carry a separate
commit history, and are structurally prone to desynchronization. Hosting
decisions on a platform the project does not own creates unnecessary dependency.

**RFC process**: Appealing because it front-loads thinking and records the
deliberative process. Rejected for now as the process weight exceeds what the
project's current scale justifies. A transition to RFC remains a possibility as
the project grows.

## RATIONALE

ADR holds a reasonable position across every relevant axis. Each decision gets
its own legible artifact without requiring a separate platform or heavy process.
Files live inside the repository, sharing its commit history and access
controls. They are navigable by date and subject with nothing beyond a file
browser. The system composes cleanly with the alternatives not fully rejected:
inline documentation handles small localized decisions, commit messages handle
implementation specifics, and ADR handles everything significant, non-localized,
or requiring broad legibility.

## CONSEQUENCES

**Positive**: decisions are legible to all contributors without technical
prerequisites, the rationale behind the project's shape is recoverable at any
point in its history, and the deliberative record resists unreflective
accumulation of choices made by default.

**Negative**: each significant decision requires a new file and a judgment call
about whether it clears the threshold for ADR or belongs in inline
documentation. That threshold will occasionally be unclear.

**Neutral**: the `docs/decisions/` folder will grow over time and may eventually
benefit from subfolders by scope. If the project grows substantially, the ADR
system may need to be supplemented or replaced by an RFC process, would be an
appropriate next step.
