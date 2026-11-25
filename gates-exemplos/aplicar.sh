#!/usr/bin/env bash
#
# aplicar.sh - planta (ou remove) um exemplo de violação das regras próprias
# (G11, G12) na árvore do repositório, no mesmo estilo do kit-gates.
#
# Uso:
#   bash gates-exemplos/aplicar.sh G11-dominio-importa-servico        # planta
#   bash gates-exemplos/aplicar.sh G11-dominio-importa-servico --desfazer
#
# Cada exemplo guarda seus arquivos sob "<exemplo>/arquivos/<caminho>.modelo".
# Plantar copia cada um para "<caminho>" (sem o sufixo .modelo). Desfazer remove.
# Serve para demonstrar que o gate detecta a violação (rode depois:
#   bash scripts/gates.sh | grep -E 'G11|G12').

set -u

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$AQUI/.." && pwd)"
EXEMPLO="${1:-}"
MODO="${2:-}"

if [ -z "$EXEMPLO" ] || [ ! -d "$AQUI/$EXEMPLO/arquivos" ]; then
  echo "Uso: bash gates-exemplos/aplicar.sh <exemplo> [--desfazer]" >&2
  echo "Exemplos disponiveis:" >&2
  for d in "$AQUI"/*/; do
    [ -d "${d}arquivos" ] && echo "  - $(basename "$d")" >&2
  done
  exit 2
fi

while IFS= read -r modelo; do
  rel="${modelo#"$AQUI/$EXEMPLO/arquivos/"}"
  destino="$REPO/${rel%.modelo}"
  if [ "$MODO" = "--desfazer" ]; then
    rm -f "$destino"
    echo "removido: ${rel%.modelo}"
  else
    mkdir -p "$(dirname "$destino")"
    cp "$modelo" "$destino"
    echo "plantado: ${rel%.modelo}"
  fi
done < <(find "$AQUI/$EXEMPLO/arquivos" -type f -name '*.modelo' | sort)
