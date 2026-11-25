# AGENTS.md - Balcão (porta de entrada dos agentes)

Índice do harness. Leia antes de mexer. O detalhe fica no README.md, em scripts/README.md (gates) e em docs/incidentes.md.

## Comandos (a partir de um clone/worktree limpo)

- Subir tudo (API, worker, front, banco, seed): `bash scripts/up.sh`
  - idempotente (pode rodar de novo sem derrubar); imprime os endereços da API, do front, o banco e a pasta de anexos DESTA cópia; ativa o hook de pre-commit.
- Derrubar só esta cópia: `bash scripts/down.sh`
- Rodar os gates (tipo, lint, testes, arquitetura): `bash scripts/gates.sh` (sai != 0 se qualquer regra falha)

Duas cópias (worktrees) sobem ao mesmo tempo, isoladas: cada `up.sh` escolhe portas, banco e pasta de anexos próprios (derivados do caminho da worktree). A IA roda em modo fake por padrão, sem chave.

## Contas da seed

- admin: `admin@balcao.dev` / `Admin@123`
- atendente: `agente@balcao.dev` / `Agente@123`
- cliente: `cliente@balcao.dev` / `Cliente@123`

## Regras de camada (os gates barram; G1-G12, detalhe em scripts/README.md)

- http (api/src/http) nunca importa `@prisma/client` nem `api/src/repositories/` (G4). Rotas chamam serviços.
- serviços (api/src/services) nunca importam `express`, `multer` nem `api/src/http/`, nem só de tipo (G6). Serviços usam repositórios.
- `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/` (G5).
- `openai` só em `api/src/integrations/` (G7). `web/` nunca importa de `api/` (G8).
- `api/src/domain/` não importa de outras camadas (G11). Só `api/src/repositories/prisma.ts` cria `new PrismaClient` (G12).
- sem erro de tipo (G1), sem lint/`any`/sem-uso (G2), testes passam (G3), sem import circular (G9), sem arquivo/export/dep sem uso (G10).

O hook de pre-commit (ativado pelo up.sh) roda tipo e lint e bloqueia o commit se falharem. Violação não se esconde (sem `@ts-ignore`/`eslint-disable`): corrige-se.

## Pastas fixas (não renomear nem mover)

`api/src/{config,domain,http,services,repositories,integrations}`, `api/src/main.ts`, `api/src/jobs/triage-worker.ts`, `web/src`, `web/src/main.tsx`, e o padrão `api/src/**/*.test.ts`. Pode criar outras.

## Mapa

- `api/` API Express + Prisma + worker de triagem. `web/` front React + Vite. `blackbox/` contrato de comportamento da API (não editar). `kit-gates/` testa os gates (não editar). `scripts/` harness (up/down/gates/hook). `gates-exemplos/` violações das regras próprias (G11/G12). `docs/incidentes.md` erros de agente e as correções do harness.
