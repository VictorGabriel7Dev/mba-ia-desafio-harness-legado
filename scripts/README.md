# Gates (guardrails mecânicos)

Um único comando roda todas as verificações mecânicas do projeto:

```bash
bash scripts/gates.sh
```

Ele roda todos os gates em sequência, **não para na primeira falha**, imprime uma
linha por violação e sai com código diferente de zero se qualquer regra falhar.
Sai com código 0 só quando tudo passa.

## Formato da saída

Para cada violação sai uma linha com o ID da regra (palavra isolada) e o caminho
do arquivo:

```
G4 api/src/http/routes/stats.ts
```

Para dependência declarada e não usada (G10), a linha traz também o nome da
dependência:

```
G10 api/package.json left-pad
```

É normal uma mesma violação aparecer em duas regras (a própria regra mais a G10,
porque um arquivo novo sem uso também aciona a G10). Isso prova que o comando não
parou na primeira falha.

No fim, o comando imprime a lista consolidada entre as linhas `VIOLACOES` e
`===`, ordenada e sem repetição.

## As 12 invariantes

| ID  | Regra | Gate |
|-----|-------|------|
| G1  | Zero erro de tipo em `api/` e `web/` (`tsc --noEmit`). | `gate-tsc.mjs` |
| G2  | Lint sem erro nem warning em `api/` e `web/` (ESLint: `no-unused-vars`, `no-explicit-any`). | `gate-eslint.mjs` |
| G3  | Testes unitários da API (`api/src/**/*.test.ts`) passam (`vitest run`). | `gate-vitest.mjs` |
| G4  | Nada em `api/src/http/` importa `@prisma/client` nem `api/src/repositories/`. | `gate-arch.mjs` |
| G5  | `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/`. | `gate-arch.mjs` |
| G6  | Nada em `api/src/services/` importa `express`, `multer` ou `api/src/http/` (inclusive `import type`). | `gate-arch.mjs` |
| G7  | `openai` só é importado em `api/src/integrations/`. | `gate-arch.mjs` |
| G8  | Nada em `web/` importa arquivos de `api/` (inclusive só de tipo). | `gate-arch.mjs` |
| G9  | Nenhum import circular em `api/src/` nem em `web/src/`. | `gate-arch.mjs` |
| G10 | Nenhum arquivo, export (inclusive de tipo) ou dependência sem uso em `api/` e `web/`. | `gate-knip.mjs` |
| G11 | Pureza do domínio: nada em `api/src/domain/` importa de outra camada. | `gate-arch.mjs` |
| G12 | Instância única do Prisma: só `api/src/repositories/prisma.ts` usa `new PrismaClient(`. | `gate-arch.mjs` |

## Peças

- `scripts/gates.sh` - orquestrador (ponto de entrada).
- `scripts/gate-arch.mjs` - regras de dependência entre camadas (G4-G9, G11, G12),
  lendo os imports pela AST do TypeScript (pega `import type`, re-export,
  `import x = require()` e import dinâmico).
- `scripts/gate-tsc.mjs` - G1 (via `tsc`).
- `scripts/gate-eslint.mjs` - G2 (via ESLint flat config: `api/eslint.config.mjs`,
  `web/eslint.config.mjs`).
- `scripts/gate-vitest.mjs` - G3 (via `vitest run`).
- `scripts/gate-knip.mjs` - G10 (via `knip`: `api/knip.json`, `web/knip.json`).

Os gates varrem apenas `api/src`, `web/src` e os `package.json`/configs relevantes.
Nunca varrem `kit-gates/`, `blackbox/`, `prisma/` nem os próprios scripts de gate.

## Observação sobre a linha de base

O código de produção de hoje ainda viola várias regras (por exemplo, o worker cria
a própria instância do Prisma, e rotas acessam o banco direto). Então rodar os
gates sobre o código atual já falha, de propósito: a refatoração é uma fase
posterior. O que estes gates garantem é que **qualquer** nova violação dessas
regras é detectada.

## Testes

- `kit-gates/verificar.sh` planta violações de G1 a G10 e confere que cada uma
  vira uma linha barrada:

  ```bash
  bash kit-gates/verificar.sh . "bash scripts/gates.sh"
  ```

- `gates-exemplos/` traz um exemplo versionado de violação para cada regra própria
  (G11 e G12), com um utilitário para plantá-los. Veja `gates-exemplos/README.md`.
