# Markdown as the primary format for project text files

DATE: 2026-04-26

SUPERSEDES: `2026-04-09-plaintext-as-text-format`

STATUS: Accepted

Author: Andrii Chemerysov

## Context

A prior decision (`2026-04-09-plaintext-as-text-format`) established plaintext
as the primary format for human-authored text files on the grounds that it
requires no tooling, no rendering step, and no ecosystem knowledge to read in
its intended form. That reasoning remains sound as far as it goes.

Two properties of the project's actual documents have made the plaintext
constraint increasingly costly. First, ADRs and other documents reference shell
commands, file names, file paths, code fragments, and configuration snippets. In
plaintext these are indistinguishable from surrounding prose, reducing
legibility. Second, Markdown has become the de facto standard format for
technical documentation in open source projects to the degree that contributors
arriving from any software or quantitative background will expect it and know
it. The prior decision's concern that Markdown "carries visible syntax noise in
raw form" understates how transparent Markdown syntax is in practice for a
technically literate audience.

## Decision

Human-authored text files across the project are authored as Markdown (`.md`).
Existing `.txt` files are converted to `.md`. The ADR format and conventions are
largely preserved; only the file extension and the availability of Markdown
syntax change.

## Alternatives considered

**Plaintext (status quo)**: The prior decision's rationale holds that plaintext
is readable anywhere without tooling. This remains true. Rejected because the
cost of forgoing code formatting, inline linking, and tables in technical
documents has proven concrete, while the benefit of raw readability without
rendering is marginal for a contributor base that reads these files through
GitHub.

**AsciiDoc or reStructuredText**: More expressive than Markdown and better
specified. Rejected for the same reasons as in the prior decision: steeper
learning curve, lower contributor familiarity, tooling overhead not justified by
the project's scope.

**Hybrid**: Markdown for new files, plaintext retained for existing files.
Rejected because it produces the format fragmentation the prior decision
identified as a cost, without the consistency benefit of either uniform choice.

## Rationale

Markdown's syntax is familiar to every likely contributor without instruction.
Code blocks, inline code, and shell command formatting restore the legibility
distinction between prose and technical content that plaintext cannot make.
Tables are available for structured reference material. GitHub renders the files
natively in the contributor's primary interface. The compilation step is not an
addition to the project's operational surface because no tooling is required to
produce the rendered output: GitHub renders it, and editors render it in preview
panels that require no configuration. Raw Markdown remains legible in any
terminal or file browser. The prior decision's core concern, that the format be
readable without tooling, is satisfied.

## Consequences

**Positive**: code blocks, inline code, and shell commands are visually distinct
from prose. Tables are available for structured content. GitHub renders files
natively in repository browsing and pull requests. The format is the de facto
standard contributors expect.

**Negative**: Markdown syntax, however familiar, contains some noise in raw
form. The specification is fragmented across dialects; this project targets
GitHub-Flavored Markdown as the rendering target. Existing `.txt` files require
conversion, which is a one-time migration cost.

**Neutral**: the 80-column line width convention established in
`2026-04-15-80-as-txt-line-width` applies to Markdown prose lines unchanged.
