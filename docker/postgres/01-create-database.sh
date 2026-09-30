#!/bin/sh
set -eu

: "${DATABASE_NAME:?DATABASE_NAME must be set}"

psql --username "$POSTGRES_USER" --dbname postgres --set=ON_ERROR_STOP=1 \
  --set=database_name="$DATABASE_NAME" <<'SQL'
SELECT format('CREATE DATABASE %I', :'database_name')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database_name')
\gexec
SQL
