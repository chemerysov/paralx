# Hybrid rendering model as the frontend rendering strategy

DATE: 2026-04-16

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

The project's primary artifact is the model page: a page dedicated to a specific
quantitative model, containing both static content and interactive elements
inseparably. The static content includes prose methodology explanation and
mathematical proofs. The interactive elements include parameter controls and
charts that respond to those controls. The interactive elements are part of the
research argument. Observing how results change under different parameter
choices is part of how the model is understood. The static and interactive
content are therefore treated as a single document with two kinds of regions,
not as two co-located applications. All model pages are publicly accessible
without authentication. Authentication is optional and gates only peripheral
features: saving parameter configurations by means other than the URL, and
leaving comments. A later stage of the project anticipates an interface that
connects multiple models, allowing parameters and results from one model to
inform another. It is still public, still contains static and interactive
content together, and does not introduce an authenticated zone.

Because all pages are publicly accessible, they are subject to indexing by
search engine crawlers and to link preview generation by social platforms, which
read HTML. A page whose initial HTML is an empty shell waiting for JavaScript to
execute before content appears returns nothing meaningful to a crawler and
produces a blank or generic link preview when shared. For a project whose growth
depends on research pages being discovered through search and shared among
retail investors, the quality of the initial HTML is a direct acquisition
factor. The static content of every model page, the prose and the proofs, must
be present in the HTML delivered by the server before any JavaScript runs. The
interactive elements of those same pages cannot be delivered as static HTML,
because they respond to user input. A chart that updates when a parameter slider
is moved does not have a fixed HTML representation. It requires JavaScript
running in the browser, a component model capable of re-rendering in response to
state changes, and either data fetched from the server or computation performed
locally. The interactive elements are therefore rendered client-side, after the
surrounding static content is already visible. This means the rendering model is
not a choice applied uniformly to all pages, nor a choice applied to separate
zones of the application. It is a choice applied to different regions within the
same page. Static and pre-rendered HTML for the prose and proof regions.
Client-side rendered JavaScript components for the interactive regions. The two
coexist on every model page.

## DECISION

The project uses a hybrid rendering model applied at the region level within
pages rather than at the page. Static content regions, prose, proofs, and
structural page elements, are rendered to complete HTML before JavaScript runs,
either at build time via static generation or at request time via server-side
rendering depending on how frequently the content changes. Interactive regions
within those same pages, parameter controls and charts, are rendered client-side
as JavaScript components that hydrate after the surrounding static content is
already visible and usable. This model applies to all model pages, which
constitute the primary artifact of the project.

## ALTERNATIVES CONSIDERED

**Pure client-side rendering for all content**: A JavaScript bundle renders the
entire page including the prose and proof content. The server delivers an empty
HTML shell. Rejected because the initial HTML would contain no meaningful
content for crawlers or social platform scrapers, producing no search indexing
and no link previews. Since all pages are public and the project's growth
depends on shared links and search discovery, this is an unacceptable cost. The
initial load experience for users on mobile connections encountering the project
cold would also be poor, as nothing appears until the bundle downloads and
executes.

**Pure server-side rendering for all content**: The server renders complete HTML
for every request including the interactive regions, and JavaScript handles
interactivity as progressive enhancement. Rejected because the interactive
regions require a component model capable of re-rendering in response to
parameter changes without server round trips for HTML. Pure server-side
rendering with progressive enhancement cannot deliver interactive charts that
update live under parameter adjustment without becoming an ad hoc and harder to
maintain reimplementation of client-side rendering. It is also incompatible with
client-side computation as a future option for the interactive regions, since
client-side computation requires a capable JavaScript environment.

## RATIONALE

The model page structure, static content and interactive elements coexisting as
parts of a single research argument, means the rendering decision cannot be made
at the page level. It must be made at the region level. The static regions have
requirements that client-side rendering cannot meet: crawler visibility, link
preview generation, fast first paint for unauthenticated users arriving cold.
The interactive regions have requirements that static HTML cannot meet:
responsiveness to user input, live chart updates, and compatibility with
client-side computation. No single rendering model satisfies both. The hybrid
model keeps these concerns cleanly separated within the page. The prose and
proofs are a publishing problem: generate good HTML, deliver it fast, make it
crawlable. The interactive elements are an application problem: manage state,
respond to input, render dynamically. The framework decision that follows from
this one must address how these two rendering strategies coexist within a single
page without requiring contributors to maintain two entirely separate codebases.

## CONSEQUENCES

**Positive**: the static content of model pages is fully indexed by search
engines and produces meaningful link previews when shared. First paint is fast
for unauthenticated users on mobile connections. Interactive regions are free to
use a full client-side component model without the constraints that uniform
pre-rendering would impose. The model is compatible with client-side computation
as a future option for interactive regions. The architecture extends naturally
to the later interconnected multi-model interface, which is the same structure
at larger scope.

**Negative**: the frontend implementation must manage two rendering strategies
within the same page, which increases the complexity of the framework decision
that follows. Contributors must understand which rendering strategy applies to
which region and what constraints each imposes. Regions that are ambiguously
static or interactive, require explicit decisions about how they are treated
during the pre-render phase.

**Neutral**: the boundary between static and interactive regions within a page
will require judgment as new content types are added. The mathematical proof
regions are a clear case for static rendering, assuming server-side KaTeX
rendering. The parameter and chart regions are a clear case for client-side
rendering. Mixed regions or regions that transition between states are the most
likely source of implementation ambiguity and will need to be addressed in the
framework decision that follows.
