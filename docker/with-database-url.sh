#!/bin/sh
set -eu

DATABASE_URL="$(node -e 'const url = new URL("postgresql://postgres:5432"); url.username = process.env.POSTGRES_USER; url.password = process.env.POSTGRES_PASSWORD; url.pathname = `/${encodeURIComponent(process.env.DATABASE_NAME)}`; process.stdout.write(url.href)')"
export DATABASE_URL

exec "$@"
