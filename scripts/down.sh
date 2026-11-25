#!/usr/bin/env bash
#
# down.sh - derruba TUDO que o up.sh desta cópia iniciou, sem tocar em outra
# cópia: mata API, worker e front (pelo grupo de processos gravado em
# .runtime/*.pid) e remove o container Postgres DESTA cópia (nome derivado do
# caminho da worktree). Nenhuma porta desta cópia volta a responder.
#
# Por padrão o volume de dados do Postgres é PRESERVADO (re-subir reaproveita o
# banco). Use "--volume" para apagar também o volume desta cópia.

set -u

APAGAR_VOLUME=0
if [ "${1:-}" = "--volume" ]; then
  APAGAR_VOLUME=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/_harness-lib.sh"

carregar_ambiente || exit 1

echo "==> derrubando a cópia em $RAIZ (sufixo $SUFIXO)"

# 1) Processos (grupo inteiro, via PID gravado).
matar_pid "$PID_WEB"    "front"
matar_pid "$PID_WORKER" "worker"
matar_pid "$PID_API"    "API"

# 2) Postgres desta cópia.
if docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  echo "  removendo Postgres ($PG_CONTAINER)"
  docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
fi

if [ "$APAGAR_VOLUME" -eq 1 ]; then
  if docker volume ls --format '{{.Name}}' | grep -qx "$PG_VOLUME"; then
    echo "  removendo volume ($PG_VOLUME)"
    docker volume rm "$PG_VOLUME" >/dev/null 2>&1 || true
  fi
fi

echo "==> cópia derrubada. Portas $API_PORT (API), $WEB_PORT (front) e $DB_PORT (banco) liberadas."
