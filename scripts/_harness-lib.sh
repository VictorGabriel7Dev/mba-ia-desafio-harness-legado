#!/usr/bin/env bash
#
# _harness-lib.sh - funções comuns ao up.sh e ao down.sh.
#
# Ideia central do isolamento: tudo que pode colidir entre duas cópias (git
# worktrees) é derivado do CAMINHO ABSOLUTO da raiz da cópia. Um hash curto desse
# caminho vira um sufixo determinístico, usado em: nome do container Postgres,
# nome do volume, e um deslocamento de porta (API, front e banco). Assim copia-a
# e copia-b diferem sempre, e subir a MESMA cópia de novo reencontra os mesmos
# recursos (idempotência). As portas escolhidas ficam gravadas em
# .runtime/ports.env, então re-subidas usam exatamente os mesmos endereços.

# Raiz da cópia atual. Em um worktree, show-toplevel aponta para a árvore da
# cópia, não para o repositório principal - é o que queremos.
raiz_copia() {
  git rev-parse --show-toplevel 2>/dev/null
}

# Sufixo determinístico (8 hex) a partir do caminho absoluto da cópia.
sufixo_copia() {
  local raiz="$1"
  printf '%s' "$raiz" | sha1sum | cut -c1-8
}

# Deslocamento de porta (0..899) a partir do sufixo.
deslocamento_porta() {
  local sufixo="$1"
  printf '%d' $(( 0x${sufixo:0:4} % 900 ))
}

# Verdadeiro (0) se a porta TCP já está ocupada em 127.0.0.1.
porta_ocupada() {
  local porta="$1"
  (exec 3<>"/dev/tcp/127.0.0.1/${porta}") 2>/dev/null && { exec 3>&- 3<&-; return 0; }
  return 1
}

# A partir de uma porta base, devolve a primeira porta livre (base, base+1, ...).
primeira_porta_livre() {
  local base="$1"
  local p="$base"
  local limite=$(( base + 80 ))
  while porta_ocupada "$p"; do
    p=$(( p + 1 ))
    if [ "$p" -gt "$limite" ]; then
      echo "nao encontrei porta livre a partir de $base" >&2
      return 1
    fi
  done
  printf '%d' "$p"
}

# Carrega (ou, na primeira vez, calcula e grava) as variáveis de ambiente desta
# cópia em variáveis de shell: RAIZ, RUNTIME, SUFIXO, PG_CONTAINER, PG_VOLUME,
# API_PORT, WEB_PORT, DB_PORT, UPLOAD_DIR, PID_API, PID_WORKER, PID_WEB.
carregar_ambiente() {
  RAIZ="$(raiz_copia)"
  if [ -z "$RAIZ" ]; then
    echo "nao estou dentro de um repositorio git" >&2
    return 1
  fi
  RUNTIME="$RAIZ/.runtime"
  SUFIXO="$(sufixo_copia "$RAIZ")"
  PG_CONTAINER="balcao_pg_${SUFIXO}"
  PG_VOLUME="balcao_pgdata_${SUFIXO}"
  UPLOAD_DIR="$RUNTIME/uploads"
  PID_API="$RUNTIME/api.pid"
  PID_WORKER="$RUNTIME/worker.pid"
  PID_WEB="$RUNTIME/web.pid"

  mkdir -p "$RUNTIME"

  if [ -f "$RUNTIME/ports.env" ]; then
    # shellcheck disable=SC1091
    . "$RUNTIME/ports.env"
  else
    local off
    off="$(deslocamento_porta "$SUFIXO")"
    API_PORT="$(primeira_porta_livre $(( 14000 + off )))" || return 1
    WEB_PORT="$(primeira_porta_livre $(( 16000 + off )))" || return 1
    DB_PORT="$(primeira_porta_livre $(( 25000 + off )))" || return 1
    {
      echo "API_PORT=$API_PORT"
      echo "WEB_PORT=$WEB_PORT"
      echo "DB_PORT=$DB_PORT"
    } > "$RUNTIME/ports.env"
  fi
}

# Verdadeiro (0) se o PID gravado no arquivo existe e está vivo.
pid_vivo() {
  local arq="$1"
  [ -f "$arq" ] || return 1
  local pid
  pid="$(cat "$arq" 2>/dev/null)"
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null
}

# Mata o grupo de processos de um PID (líder de sessão criado com setsid), com
# TERM e, se insistir, KILL. Remove o arquivo de PID.
matar_pid() {
  local arq="$1"
  local nome="$2"
  if pid_vivo "$arq"; then
    local pid
    pid="$(cat "$arq")"
    kill -TERM "-${pid}" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.3
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "-${pid}" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
    fi
    echo "  parado: $nome (pid $pid)"
  fi
  rm -f "$arq"
}
