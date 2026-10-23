#!/usr/bin/env bash
# Roda o schema.sql (duas vezes, para provar que e idempotente) e todos os
# testes de supabase/tests num Postgres local descartavel, sem tocar no
# Supabase. Precisa de `initdb`, `pg_ctl` e `psql` no PATH.
#
#   supabase/tests/local/run.sh            # todos os testes
#   supabase/tests/local/run.sh 18-painel  # so os que tem esse trecho no nome
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
work="${VOLUMA_PG_DIR:-${TMPDIR:-/tmp}/voluma-pg}"
port="${VOLUMA_PG_PORT:-54329}"

mkdir -p "$work"
if [ ! -f "$work/data/PG_VERSION" ]; then
  initdb -D "$work/data" -U postgres --auth=trust -E UTF8 >/dev/null
fi
if ! pg_ctl -D "$work/data" status >/dev/null 2>&1; then
  pg_ctl -D "$work/data" -o "-k $work -p $port -c listen_addresses=''" -l "$work/log" -w start >/dev/null
fi

psql=(psql -h "$work" -p "$port" -U postgres -v ON_ERROR_STOP=1 -q -tA)
"${psql[@]}" -d postgres -c 'drop database if exists voluma' -c 'create database voluma' >/dev/null
"${psql[@]}" -d voluma -f "$here/stub.sql" >/dev/null

# Dali em diante, como o dono sem superusuario (ver o fim do stub.sql).
export PGOPTIONS="-c role=voluma_owner"
for _ in 1 2; do
  "${psql[@]}" -d voluma -f "$root/supabase/schema.sql" 2>&1 | { grep -v NOTICE || true; }
done

failed=0
for test in "$root"/supabase/tests/*.sql; do
  name="$(basename "$test" .sql)"
  [[ -n "${1:-}" && "$name" != *"$1"* ]] && continue
  if out="$("${psql[@]}" -d voluma -f "$test" 2>&1)" && [ "$(tail -1 <<<"$out")" = ok ]; then
    echo "ok    $name"
  else
    echo "FALHA $name"
    grep -E 'ERROR|CONTEXT' <<<"$out" | head -4
    failed=1
  fi
done
exit "$failed"
