# Paralx

Open source project for transparent dynamic finance research.

The project is in early development (v0.0.1). The site is live with an index
and about page. The first model page is in progress.

## Structure

```
docs/decisions/   architectural decision records
backend/          Go server, plain HTTP behind the Caddy proxy
frontend/         Astro frontend (model pages, components, layouts)
```

## Development

See `CONTRIBUTING.txt` for setup and development instructions.

## Deploying

```
git add . && git commit -m "..." && git push
./deploy.sh
```

That is the whole thing. The script takes no arguments.

Pushing to main deploys nothing. `deploy.sh` triggers the `publish` workflow,
which builds the image on GitHub and pushes it to GHCR, then pulls that exact
commit onto the server from your machine. No SSH key or secret is stored on
GitHub.

`deploy.sh` holds only what is particular to this project. The steps themselves
are shared with the other sites and live in `infrastructure/deploy/deploy-lib.sh`,
which this expects to find in a sibling `infrastructure/` directory.

paralx runs on `eu1`, not on the box the other sites share, because it is the
only one with a database behind it. The backend speaks plain HTTP on 8080 and
publishes nothing to the host; the Caddy proxy at `/opt/proxy` on eu1 terminates
TLS and routes to it by its `web`-network alias, `paralx`. Postgres is on a
separate internal network that the proxy cannot reach at all.

`.env` holds the FRED key and the database credentials. It is git ignored and
sent to the server by `deploy.sh` over ssh, so it exists on this machine and on
eu1 and nowhere else.
