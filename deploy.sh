#!/usr/bin/env bash
# Ships the current commit to production. One command, no arguments.
#
#   git add . && git commit -m "..." && git push
#   ./deploy.sh
#
# It builds on GitHub rather than here, because this machine is arm64 and the
# server is x86_64, and emulating that locally turns a two minute build into
# half an hour. Everything after the build runs from here, which is why no SSH
# key or environment file has to be stored on GitHub.
#
# Deploying stays a thing you do rather than a thing a push does: nothing in
# this repository is triggered by pushing to main.
#
# This file holds only what is particular to this project. The steps themselves
# are shared with the other sites and live in infrastructure/deploy/deploy-lib.sh.

set -euo pipefail

PROJECT="paralx"
# The box it runs on, as named in ~/.ssh/config. Not useast1: paralx keeps its
# own machine, because it is the only site here with a database behind it.
SERVER="eu1"
# Compose names containers <project>-<service>-N, and the service is not called
# the same thing in every repo.
CONTAINER="$PROJECT-backend-1"
PORT=8080
# The apex goes first: it is also the Host header used to test the container.
DOMAINS="paralx.org www.paralx.org"
# Files the server has no other copy of, sent on every deploy.
#
# .env is in that list and is git ignored, so the FRED key and the database
# password travel from this machine to the server over ssh and are never on
# GitHub. Editing them is editing a local file, which is the point.
SEND="docker-compose.yml .env"

# Whatever this repo can check cheaply and locally, before a build is worth
# starting. The workflow is the real gate and runs its own checks regardless.
preflight() {
	[ -f .env ] || {
		echo "  no .env here. Copy .env.example and fill it in: the server is sent this file." >&2
		exit 1
	}
	# An empty value reaches the server, breaks the database URL or the FRED
	# calls, and leaves a container that starts and then fails on every request.
	for key in FRED_API_KEY POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB; do
		grep -q "^$key=." .env || {
			echo "  .env has no value for $key" >&2
			exit 1
		}
	done
	echo "  .env has all four values"
	if command -v go >/dev/null 2>&1; then
		(cd backend && go vet ./... && go build -o /dev/null ./)
	else
		echo "  go is not installed here, the workflow will build the backend"
	fi

	# The frontend gets the same treatment the backend already had. Astro will
	# happily build a page with a broken type or an unused import, and neither
	# shows up in a healthcheck. The workflow runs these too, but finding out
	# here costs seconds instead of a round trip through a build.
	if command -v pnpm >/dev/null 2>&1 && [ -d frontend/node_modules ]; then
		(cd frontend && pnpm check && pnpm lint)
	else
		echo "  pnpm or frontend/node_modules is not available here, the workflow will run the checks"
	fi
}

LIB="${DEPLOY_LIB:-$(dirname "$0")/../infrastructure/deploy/deploy-lib.sh}"
[ -f "$LIB" ] || {
	echo "Cannot find the shared deploy steps at:" >&2
	echo "  $LIB" >&2
	echo >&2
	echo "They live in the infrastructure repo, which this expects as a sibling of this one." >&2
	echo "Clone it next to this repo, or point DEPLOY_LIB at deploy-lib.sh." >&2
	exit 1
}
# shellcheck source=/dev/null
. "$LIB"

deploy "$@"
