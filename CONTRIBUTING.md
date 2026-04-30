# Contributing

Paralx is open source and welcomes contributions.

## Prerequisites

**Node.js 22.0.0+**

```bash
node --version
```

**pnpm**

```bash
npm install -g pnpm
```

## Setup

Install frontend dependencies:

```bash
cd frontend
pnpm install
```

## Development

Start the frontend development server:

```bash
cd frontend
pnpm dev
```

The dev server starts with hot module replacement, meaning changes to pages,
layouts, components, and styles reflect in the browser immediately.

## Appendix

Node.js 22.0.0+ specifically is required by Astro 6. See
`docs/decisions/2026-04-25-nodejs-as-frontend-build-runtime.md` and
`docs/decisions/2026-04-18-astro-as-frontend-framework.md`.
