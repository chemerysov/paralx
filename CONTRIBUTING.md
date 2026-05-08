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

**Go 1.24+**

```bash
go version
```

**Docker**

Install Docker Desktop at https://www.docker.com/products/docker-desktop, or
a lighter alternative such as OrbStack (https://orbstack.dev) or Colima
(`brew install colima`).

**FRED API key**

Register for a free account at https://fred.stlouisfed.org and generate an API
key under My Account > API Keys.

## Setup

Install frontend dependencies:

```bash
cd frontend
pnpm install
```

Copy the environment variables template and fill in your values:

```bash
cp .env.example .env
```

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` can be any values you
choose. `FRED_API_KEY` must be the key you generated above.

## Development

Start the backend (Postgres + Go server) in the background:

```bash
docker compose -f docker-compose.local.yml up --build -d
```

Start the frontend development server:

```bash
cd frontend
pnpm dev
```

The dev server starts with hot module replacement, meaning changes to pages,
layouts, components, and styles reflect in the browser immediately. API requests
are proxied to the local Go backend at `http://localhost:8080`.

On first load, the Go server fetches the requested series from FRED and stores
it in Postgres. Subsequent loads are served from the database.

To stop the backend:

```bash
docker compose -f docker-compose.local.yml down
```

## Appendix

Node.js 22.0.0+ specifically is required by Astro 6. See
`docs/decisions/2026-04-25-nodejs-as-frontend-build-runtime` and
`docs/decisions/2026-04-18-astro-as-frontend-framework`.
