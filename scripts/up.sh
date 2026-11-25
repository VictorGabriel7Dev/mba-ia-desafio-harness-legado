#!/usr/bin/env bash
#
# up.sh - sobe TODA a cópia atual com um comando só, a partir de um clone limpo:
# instala dependências se faltarem, sobe um Postgres próprio desta cópia, aplica
# as migrations, carrega a seed (idempotente), ativa o hook de git e deixa API,
# worker e front no ar em segundo plano. No fim, imprime os endereços DESTA cópia.
#
# Rodar de novo (sem derrubar) é seguro: reaproveita o que já está no ar, não
# duplica a seed e mantém os mesmos endereços (gravados em .runtime/ports.env).
#
# Isolamento entre cópias (git worktrees): portas, banco e pasta de anexos são
# derivados do caminho da worktree. Veja scripts/_harness-lib.sh.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/_harness-lib.sh"

carregar_ambiente || exit 1
cd "$RAIZ" || exit 1

mkdir -p "$UPLOAD_DIR"

echo "==> cópia em $RAIZ (sufixo $SUFIXO)"

# 1) Dependências (idempotente): só instala se faltar node_modules.
instalar_deps() {
  local dir="$1"
  if [ ! -d "$RAIZ/$dir/node_modules" ]; then
    echo "==> instalando dependências em $dir/"
    ( cd "$RAIZ/$dir" && npm ci --no-audit --no-fund ) || { echo "falha no npm ci em $dir" >&2; exit 1; }
  fi
}
instalar_deps api
instalar_deps web

# 2) Cliente Prisma gerado (necessário para a API e os testes). Gera se faltar.
if [ ! -d "$RAIZ/api/node_modules/.prisma/client" ]; then
  echo "==> gerando o cliente Prisma"
  ( cd "$RAIZ/api" && npx prisma generate ) || { echo "falha no prisma generate" >&2; exit 1; }
fi

# 3) Postgres próprio desta cópia (container nomeado pelo sufixo, porta própria).
if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  echo "==> Postgres já no ar ($PG_CONTAINER, porta $DB_PORT)"
elif docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  echo "==> reiniciando Postgres parado ($PG_CONTAINER)"
  docker start "$PG_CONTAINER" >/dev/null
else
  echo "==> subindo Postgres ($PG_CONTAINER) na porta $DB_PORT"
  docker run -d \
    --name "$PG_CONTAINER" \
    -e POSTGRES_USER=balcao \
    -e POSTGRES_PASSWORD=balcao \
    -e POSTGRES_DB=balcao \
    -p "127.0.0.1:${DB_PORT}:5432" \
    -v "${PG_VOLUME}:/var/lib/postgresql/data" \
    postgres:16 >/dev/null || { echo "falha ao subir o Postgres" >&2; exit 1; }
fi

echo "==> esperando o Postgres aceitar conexões"
pronto=0
for _ in $(seq 1 60); do
  if docker exec "$PG_CONTAINER" pg_isready -U balcao -d balcao >/dev/null 2>&1; then
    pronto=1; break
  fi
  sleep 1
done
if [ "$pronto" -ne 1 ]; then
  echo "o Postgres não ficou pronto a tempo" >&2
  exit 1
fi

# 4) api/.env desta cópia (portas, banco e pasta de anexos próprios).
DATABASE_URL="postgresql://balcao:balcao@localhost:${DB_PORT}/balcao"
DATABASE_URL_TEST="postgresql://balcao:balcao@localhost:${DB_PORT}/balcao_test"
cat > "$RAIZ/api/.env" <<EOF
# Gerado por scripts/up.sh para ESTA cópia (sufixo $SUFIXO). Não versionado.
DATABASE_URL=$DATABASE_URL
DATABASE_URL_TEST=$DATABASE_URL_TEST
PORT=$API_PORT
WEB_ORIGIN=http://localhost:$WEB_PORT
UPLOAD_DIR=$UPLOAD_DIR
AI_MODE=fake
OPENAI_API_KEY=
TRIAGE_INTERVAL_MS=1000
JWT_SECRET=dev-secret
EOF

# 5) Migrations + seed (ambos idempotentes).
echo "==> aplicando migrations"
( cd "$RAIZ/api" && DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy ) \
  || { echo "falha no migrate deploy" >&2; exit 1; }

echo "==> carregando a seed (idempotente)"
( cd "$RAIZ/api" && npm run --silent seed ) || { echo "falha na seed" >&2; exit 1; }

# 6) Hook de git: ativa o pre-commit versionado (tipo + lint) sem passo extra.
git config core.hooksPath scripts/githooks
chmod +x "$RAIZ/scripts/githooks/pre-commit" 2>/dev/null || true
echo "==> hook de pre-commit ativo (core.hooksPath=scripts/githooks)"

# 7) Processos em segundo plano. Cada um sobe com setsid (vira líder de grupo),
#    para o down.sh derrubar a árvore inteira pelo PID. Só sobe se não houver um
#    já vivo desta cópia.
subir_proc() {
  local nome="$1" pidfile="$2" log="$3"; shift 3
  if pid_vivo "$pidfile"; then
    echo "==> $nome já no ar (pid $(cat "$pidfile"))"
    return 0
  fi
  setsid bash -c "$*" > "$log" 2>&1 &
  echo $! > "$pidfile"
  echo "==> $nome subindo (pid $(cat "$pidfile"), log $log)"
}

subir_proc "API"    "$PID_API"    "$RUNTIME/api.log"    "cd '$RAIZ/api' && exec npm run --silent start"
subir_proc "worker" "$PID_WORKER" "$RUNTIME/worker.log" "cd '$RAIZ/api' && exec npm run --silent worker"
subir_proc "front"  "$PID_WEB"    "$RUNTIME/web.log"    "cd '$RAIZ/web' && WEB_PORT=$WEB_PORT VITE_API_URL=http://localhost:$API_PORT exec npm run --silent dev -- --host 127.0.0.1"

# 8) Espera a API responder no /api/health.
echo "==> esperando a API responder"
api_ok=0
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    api_ok=1; break
  fi
  sleep 0.5
done
if [ "$api_ok" -ne 1 ]; then
  echo "a API não respondeu no /api/health; veja $RUNTIME/api.log" >&2
  exit 1
fi

cat <<EOF

================ BALCÃO NO AR ================
  API ........ http://localhost:$API_PORT
  front ...... http://localhost:$WEB_PORT
  banco ...... postgresql://balcao:balcao@localhost:$DB_PORT/balcao (container $PG_CONTAINER)
  anexos ..... $UPLOAD_DIR
  logs ....... $RUNTIME/{api,worker,web}.log
==============================================
  derrubar só esta cópia: bash scripts/down.sh
EOF
