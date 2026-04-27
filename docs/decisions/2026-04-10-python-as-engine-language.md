# Python as the language for quantitative calculation and modelling

DATE: 2026-04-09

STATUS: accepted

AUTHOR: Andrii Chemerysov

## CONTEXT

The project requires a language in which quantitative calculations, statistical
models, and financial analysis are implemented. This language choice affects
contributor accessibility, the availability of relevant libraries, runtime
performance characteristics, and the degree to which the calculation layer can
be integrated with or isolated from other system components.

## DECISION

Quantitative calculation and modelling code is written in Python.

## ALTERNATIVES CONSIDERED

**Julia**: Designed specifically for high-performance numerical computing, with
syntax close to mathematical notation and performance approaching compiled
languages for numerical workloads. Rejected because the contributor pool
familiar with Julia is significantly smaller than for Python, the ecosystem of
financial and statistical libraries is narrower, and the performance advantage
does not justify the accessibility cost at the project's current scale.

**R**: Mature statistical computing language with a strong ecosystem for
financial time series, econometrics, and research workflows. Rejected because R
is not a general application language and integrating an R calculation layer
with the rest of a software system introduces significant operational
complexity. The statistical libraries available in R are either replicated in
Python or wrappable via rpy2, which is an acceptable escape hatch.

**C or C++**: Would offer maximum performance for numerically intensive
workloads. Rejected because the development overhead is not justified by the
project's current performance requirements, the contributor pool is
significantly narrower, and the scientific Python ecosystem already delegates
its performance-critical internals to compiled code.

**Rust**: Strong performance and memory safety guarantees, with a growing
numerical ecosystem. Rejected for the same reasons as C++, and additionally
because the financial and statistical library ecosystem in Rust is not mature
relative to Python's.

## RATIONALE

Python is the dominant language in quantitative finance, data science, and
scientific computing. Contributors to a project in this domain are
overwhelmingly likely to already know it. The scientific Python ecosystem,
NumPy, SciPy, Pandas, statsmodels, and their dependents, represents decades of
accumulated work that would be impractical to replicate or meaningfully improve
upon at the project level. The language's performance characteristics are
adequate for the workloads in scope, cases requiring lower-level performance are
addressable through Cython, Numba, or targeted use of compiled extensions
without abandoning Python as the primary layer. The choice also keeps the
calculation layer accessible to contributors whose background is in finance or
research rather than software engineering, which is consistent with the
project's goal of making quantitative methodology legible and participatory.

## CONSEQUENCES

**Positive**: the full scientific Python ecosystem is available without
integration overhead. Contributors with quantitative backgrounds can contribute
to the calculation layer without acquiring a new language. The choice is
unsurprising and requires no justification to new contributors.

**Negative**: Python's concurrency model imposes constraints on parallelism
within a single process. Workloads that are both computationally intensive and
require true parallelism may require explicit use of multiprocessing, a task
queue, or compiled extensions.
