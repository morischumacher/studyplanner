#!/usr/bin/env bash
#
# Start a local PostgreSQL for development and tests, and load the schema.
#
#   ./scripts/dev-db.sh up      start the server and apply every migration
#   ./scripts/dev-db.sh down    stop the server
#   ./scripts/dev-db.sh reset   drop everything and rebuild from the SQL files
#   ./scripts/dev-db.sh psql    open a shell against the dev database
#   ./scripts/dev-db.sh url     print the DATABASE_URL to export
#
# Prefers Docker when a daemon is reachable. Falls back to a PostgreSQL server
# installed on the host, which is what CI runners and restricted sandboxes
# usually have. Both paths end at the same database with the same schema, so
# nothing downstream needs to know which one ran.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DIR="$ROOT/backend/sql"

PGPORT="${STUDYPLANNER_DB_PORT:-5433}"
PGUSER="${STUDYPLANNER_DB_USER:-studyplanner}"
PGDATABASE="${STUDYPLANNER_DB_NAME:-studyplanner}"
PGDATA="${STUDYPLANNER_PGDATA:-/tmp/studyplanner-pgdata}"
PGSOCKET="${STUDYPLANNER_PGSOCKET:-/tmp}"
CONTAINER="studyplanner-postgres"

have_docker() { command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; }

# The native path needs the server binaries, which Debian and Ubuntu keep out of
# PATH under /usr/lib/postgresql/<version>/bin.
native_bin() {
  local d
  for d in /usr/lib/postgresql/*/bin /usr/pgsql-*/bin; do
    [ -x "$d/initdb" ] && { echo "$d"; return 0; }
  done
  command -v initdb >/dev/null 2>&1 && { dirname "$(command -v initdb)"; return 0; }
  return 1
}

# initdb refuses to run as root, so the native path needs an unprivileged owner
# for the data directory. Any existing non-root account will do.
unprivileged_user() {
  if [ "$(id -u)" -ne 0 ]; then id -un; return 0; fi
  for u in postgres nobody; do id -u "$u" >/dev/null 2>&1 && { echo "$u"; return 0; }; done
  useradd -m studyplanner-pg >/dev/null 2>&1 || true
  echo studyplanner-pg
}

url() { echo "postgresql://$PGUSER@/$PGDATABASE?host=$PGSOCKET&port=$PGPORT"; }

wait_ready() {
  local bin="${1:-}" i
  for i in $(seq 1 30); do
    if "${bin}pg_isready" -h "$PGSOCKET" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "database did not become ready on port $PGPORT" >&2
  return 1
}

# Migrations are recorded in the same migration_history table the application
# uses on boot, so the script and the app agree on what has been applied and
# `up` is safe to re-run. Each file is applied inside a single transaction: 007
# and 008 require it, because they build ON COMMIT DROP temp tables that psql's
# default autocommit would destroy before the file's closing UPDATE reads them.
# A few files carry their own BEGIN/COMMIT, which is harmless but makes psql
# warn; those warnings are filtered while ON_ERROR_STOP still aborts on error.
apply_migrations() {
  local psql_bin="${1:-psql}"
  local run=("$psql_bin" -h "$PGSOCKET" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE")

  "${run[@]}" --quiet --set ON_ERROR_STOP=1 -c "
    CREATE TABLE IF NOT EXISTS migration_history (
      filename    text PRIMARY KEY,
      executed_at timestamptz NOT NULL DEFAULT now()
    );" >/dev/null

  local applied=0 skipped=0 f name
  for f in "$SQL_DIR"/*.sql; do
    name="$(basename "$f")"
    if [ "$("${run[@]}" -tAc "SELECT 1 FROM migration_history WHERE filename = '$name'")" = "1" ]; then
      skipped=$((skipped + 1))
      continue
    fi
    "${run[@]}" --single-transaction --quiet --set ON_ERROR_STOP=1 -f "$f" 2> >(
      grep -vE 'WARNING:  there is (already a|no) transaction in progress' >&2
    )
    "${run[@]}" --quiet --set ON_ERROR_STOP=1 \
      -c "INSERT INTO migration_history (filename) VALUES ('$name') ON CONFLICT DO NOTHING" >/dev/null
    applied=$((applied + 1))
  done
  echo "migrations: $applied applied, $skipped already present"
}

up_docker() {
  if ! docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker run -d --name "$CONTAINER" \
      -e POSTGRES_USER="$PGUSER" -e POSTGRES_PASSWORD="$PGUSER" -e POSTGRES_DB="$PGDATABASE" \
      -p "$PGPORT:5432" postgres:16 >/dev/null
  else
    docker start "$CONTAINER" >/dev/null
  fi
  PGSOCKET=127.0.0.1
  wait_ready
  PGPASSWORD="$PGUSER" apply_migrations psql
}

up_native() {
  local bin owner
  bin="$(native_bin)/" || { echo "no PostgreSQL server found; install postgresql or start Docker" >&2; exit 1; }
  owner="$(unprivileged_user)"

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    rm -rf "$PGDATA"; mkdir -p "$PGDATA"; chown -R "$owner" "$PGDATA"
    run_as "$owner" "${bin}initdb -D '$PGDATA' -U '$PGUSER' --auth=trust" >/dev/null
  fi
  if ! "${bin}pg_isready" -h "$PGSOCKET" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
    chown -R "$owner" "$PGDATA"
    run_as "$owner" "${bin}pg_ctl -D '$PGDATA' -l '$PGDATA/server.log' -o '-p $PGPORT -k $PGSOCKET' -w start" >/dev/null
  fi
  wait_ready "$bin"
  "${bin}psql" -h "$PGSOCKET" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc \
    "select 1 from pg_database where datname='$PGDATABASE'" | grep -q 1 \
    || "${bin}createdb" -h "$PGSOCKET" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE"
  apply_migrations "${bin}psql"
}

run_as() {
  local user="$1"; shift
  if [ "$(id -un)" = "$user" ]; then bash -lc "$*"; else su "$user" -c "$*"; fi
}

case "${1:-up}" in
  up)
    if have_docker; then up_docker; else up_native; fi
    echo "database ready"
    echo "export DATABASE_URL=\"$(url)\""
    ;;
  down)
    if have_docker && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
      docker stop "$CONTAINER" >/dev/null && echo "stopped container"
    else
      bin="$(native_bin)/"
      run_as "$(unprivileged_user)" "${bin}pg_ctl -D '$PGDATA' -m fast stop" >/dev/null 2>&1 \
        && echo "stopped server" || echo "server was not running"
    fi
    ;;
  reset)
    "$0" down || true
    if have_docker; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; else rm -rf "$PGDATA"; fi
    "$0" up
    ;;
  psql)
    shift || true
    bin=""; have_docker || bin="$(native_bin)/"
    exec "${bin}psql" -h "$PGSOCKET" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$@"
    ;;
  url) url ;;
  *) echo "usage: $0 {up|down|reset|psql|url}" >&2; exit 2 ;;
esac
