# Balcão - central de chamados (com harness)

O Balcão é a central de chamados: clientes abrem chamados, uma IA faz a triagem em segundo plano (modo fake por padrão, sem chave), atendentes respondem e o admin acompanha os números. Este repositório instala o **harness**: qualquer agente sobe o ambiente, mexe no código e prova que não quebrou nada, sozinho e em duas cópias ao mesmo tempo. O comportamento da API é o mesmo de sempre - a suíte caixa-preta em `blackbox/` (do repositório base) é o contrato.

A porta de entrada dos agentes é o [AGENTS.md](AGENTS.md).

## Como rodar

Pré-requisitos: Linux ou macOS, **Docker**, **Git** e **Node.js LTS** (testado no Node 20). No Windows, use o WSL.

```bash
bash scripts/up.sh      # sobe API, worker, front e banco; migra; carrega a seed; ativa o hook
bash scripts/down.sh    # derruba só esta cópia
bash scripts/gates.sh   # roda todos os gates (sai != 0 se algo falha)
```

`up.sh`, a partir de um clone limpo, deixa tudo no ar em um passo e **imprime** o endereço da API, o do front, o banco e a pasta de anexos desta cópia. É idempotente (rodar de novo, sem derrubar, não quebra nem duplica a seed). Cada cópia (worktree) escolhe portas, banco e pasta de anexos próprios, derivados do caminho da worktree, então duas sobem ao mesmo tempo sem colidir; `down.sh` encerra só a sua. A IA fica em modo fake, sem chave real.

Duas cópias ao mesmo tempo:

```bash
git worktree add ../copia-b HEAD
cd ../copia-b && bash scripts/up.sh   # portas, banco e anexos diferentes da primeira
```

## Contas da seed

| Papel | E-mail | Senha |
|---|---|---|
| admin | `admin@balcao.dev` | `Admin@123` |
| atendente | `agente@balcao.dev` | `Agente@123` |
| cliente | `cliente@balcao.dev` | `Cliente@123` |

## Gates

Um comando (`bash scripts/gates.sh`) roda todas as verificações, não para na primeira falha, imprime uma linha por violação (`<ID> <arquivo>`, e `<ID> <package.json> <dep>` para dependência sem uso) e sai com código != 0 se qualquer regra falha. As invariantes:

| ID | Regra | Ferramenta |
|---|---|---|
| G1 | zero erro de tipo em `api/` e `web/` | `tsc --noEmit` |
| G2 | lint sem erro/warning, pega import/var sem uso e `any` | ESLint (@typescript-eslint) |
| G3 | testes unitários da API passam | Vitest |
| G4 | `api/src/http/` não importa `@prisma/client` nem `repositories/` | script AST (`scripts/gate-arch.mjs`) |
| G5 | `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/` | script AST |
| G6 | `api/src/services/` não importa `express`/`multer`/`http/` (incl. só-tipo) | script AST |
| G7 | `openai` só em `api/src/integrations/` | script AST |
| G8 | `web/` não importa de `api/` (incl. só-tipo) | script AST |
| G9 | sem import circular em `api/src/` e `web/src/` | script AST (SCC) |
| G10 | sem arquivo/export/dependência sem uso | Knip |
| **G11** | `api/src/domain/` não importa de outras camadas (http, services, repositories, integrations, jobs) | script AST |
| **G12** | só `api/src/repositories/prisma.ts` cria `new PrismaClient` | script AST |

As violações não são escondidas (não há `@ts-ignore`/`eslint-disable` em `api/src/` e `web/src/`); foram corrigidas. O `kit-gates/` (do repositório base) confere que cada gate detecta a violação da sua regra.

### Regras próprias (G11, G12) e seus exemplos de violação

As motivações e os exemplos versionados estão em `gates-exemplos/` (`gates-exemplos/README.md`). Para aplicar um exemplo e ver os gates falharem, e depois desfazer:

```bash
bash gates-exemplos/aplicar.sh G11-dominio-importa-servico   # planta a violação
bash scripts/gates.sh                                        # falha: G11 api/src/domain/resumo-do-chamado.ts
bash gates-exemplos/aplicar.sh G11-dominio-importa-servico --desfazer
bash gates-exemplos/aplicar.sh G12-prisma-no-servico         # planta new PrismaClient fora de repositories/prisma.ts
bash scripts/gates.sh                                        # falha: G12 api/src/services/conexao-extra.ts
bash gates-exemplos/aplicar.sh G12-prisma-no-servico --desfazer
```

- **G11 (pureza do domínio)**: o domínio é o núcleo estável; se depende de infra (http, services, repositories), inverte a direção das dependências e perde reusabilidade.
- **G12 (instância única do Prisma)**: cada `PrismaClient` abre a própria pool de conexões; espalhar instâncias (o worker legado fazia isso) estoura o limite de conexões do Postgres.

## Decisões

- **Isolamento das cópias**: um sufixo determinístico derivado do caminho da worktree (`git rev-parse --show-toplevel`) gera portas (API, front, banco), nome do container Postgres e pasta de anexos próprios, gravados em `.runtime/` para o re-up reencontrar os mesmos endereços. Cada cópia tem **o seu próprio Postgres** (container nomeado), o seu worker e a sua pasta de anexos; o front aponta para a API da sua cópia (`VITE_API_URL`) e a API libera o CORS só para o front da sua cópia (`WEB_ORIGIN`). O `docker-compose.yml` original (porta 5432 fixa) foi removido porque colidiria entre worktrees; o `up.sh` sobe o banco por cópia.
- **Violações que já existiam, corrigidas (não escondidas)**: as rotas deixaram de falar com o banco e passaram a chamar serviços (G4); a classe de erro saiu de `http/` para `domain/errors.ts` para os serviços não importarem `http/` (G6); todo `process.env` foi para `config/env` (G5); o `openai` ficou só em `integrations/` (G7); o ciclo `ticket-service`/`notification-service` foi quebrado movendo `formatTicketRef` para o domínio (G9); o worker passou a usar a instância única de Prisma (G12); o `any` virou tipos reais, com augmentation do `Express.Request` (G1/G2); código e dependências sem uso (`lodash`, `axios`, `legacy-sla.ts`) foram removidos (G10); o front ganhou tipos próprios para não importar da API (G8). A suíte caixa-preta (51 testes) passou em cada passo.
- **Documentação para agentes**: o `CLAUDE.md` mentia (mandava `npm run migrate`, citava `api/src/controllers/` e "use axios", nada disso existia). Foi reduzido a um ponteiro para o `AGENTS.md` (índice de no máximo 60 linhas), que lista os comandos, as contas, as regras de camada e o mapa.

## Registro de incidentes

Os erros reais dos agentes durante este trabalho e as mudanças de harness que impedem a repetição estão em [docs/incidentes.md](docs/incidentes.md).
