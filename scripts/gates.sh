#!/usr/bin/env bash
#
# gates.sh - roda TODAS as verificações mecânicas (guardrails) do projeto.
#
# Uso:
#   bash scripts/gates.sh
#
# Como funciona:
#   - roda cada gate em sequência e NÃO para na primeira falha;
#   - cada gate imprime uma linha por violação no formato "<ID> <caminho>"
#     (para dependência sem uso: "<ID> <pacote>/package.json <nome>");
#   - no fim, imprime a lista consolidada (uma linha por violação) e sai com
#     código != 0 se qualquer regra falhou ou se algum gate quebrou;
#   - sai com código 0 somente se tudo passou (nenhuma violação).
#
# As 12 invariantes:
#   G1  tsc --noEmit sem erro em api/ e web/            (scripts/gate-tsc.mjs)
#   G2  eslint sem erro nem warning em api/ e web/      (scripts/gate-eslint.mjs)
#   G3  testes unitários da api passam                  (scripts/gate-vitest.mjs)
#   G4  http não importa prisma nem repositories        (scripts/gate-arch.mjs)
#   G5  env só na camada de configuração                (scripts/gate-arch.mjs)
#   G6  services não importam http/express/multer        (scripts/gate-arch.mjs)
#   G7  openai só em integrations                       (scripts/gate-arch.mjs)
#   G8  web não importa api                             (scripts/gate-arch.mjs)
#   G9  sem import circular                             (scripts/gate-arch.mjs)
#   G10 sem arquivo/export/dependência sem uso          (scripts/gate-knip.mjs)
#   G11 pureza do domínio                               (scripts/gate-arch.mjs)
#   G12 instância única do Prisma                       (scripts/gate-arch.mjs)

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO" || { echo "nao foi possivel entrar em $REPO" >&2; exit 2; }

VIOLACOES="$(mktemp)"
trap 'rm -f "$VIOLACOES"' EXIT

ERRO_INFRA=0

# Executa um gate (script node). A saída de violações vai para o acumulador;
# os diagnósticos do gate aparecem no stderr. Se o gate quebrar (código != 0),
# registramos falha de infraestrutura.
roda_gate() {
  local nome="$1"
  shift
  "$@" >> "$VIOLACOES"
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "[gates] o gate '$nome' quebrou (codigo $rc)." >&2
    ERRO_INFRA=1
  fi
}

roda_gate "arquitetura (G4-G9,G11,G12)" node scripts/gate-arch.mjs
roda_gate "tipos (G1)" node scripts/gate-tsc.mjs
roda_gate "lint (G2)" node scripts/gate-eslint.mjs
roda_gate "testes (G3)" node scripts/gate-vitest.mjs
roda_gate "sem uso (G10)" node scripts/gate-knip.mjs

# Lista consolidada: uma linha por violação, ordenada e sem repetição.
sort -u "$VIOLACOES" > "$VIOLACOES.ord"
mv "$VIOLACOES.ord" "$VIOLACOES"

N=$(grep -c . "$VIOLACOES" 2>/dev/null || echo 0)

echo "================ VIOLACOES ($N) ================"
cat "$VIOLACOES"
echo "==============================================="

if [ "$ERRO_INFRA" -ne 0 ]; then
  echo "Resultado: FALHA (algum gate quebrou; veja o stderr acima)."
  exit 2
fi

if [ "$N" -gt 0 ]; then
  echo "Resultado: FALHA ($N violacao(oes))."
  exit 1
fi

echo "Resultado: OK (tudo passou)."
exit 0
