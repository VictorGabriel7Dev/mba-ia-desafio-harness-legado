# Exemplos de violação das regras próprias (G11 e G12)

Além das 10 invariantes fixas (G1-G10, testadas por `kit-gates/`), os gates
incluem duas regras próprias. Aqui fica um exemplo versionado de violação de cada
uma, no mesmo estilo do `kit-gates/violacoes`: os arquivos ficam como `.modelo`
(inertes, nenhuma ferramenta os analisa) e são plantados na árvore na hora do teste.

## Como usar

```bash
# planta o exemplo na árvore do repositório
bash gates-exemplos/aplicar.sh G11-dominio-importa-servico

# roda os gates e confirma que a regra foi detectada
bash scripts/gates.sh | grep -E 'G11|G12'

# desfaz
bash gates-exemplos/aplicar.sh G11-dominio-importa-servico --desfazer
```

## G11 - Pureza do domínio

**Regra:** nada em `api/src/domain/` pode importar de outra camada (`http`,
`services`, `repositories`, `integrations`, `jobs`).

**Motivação:** o domínio é o núcleo estável do sistema (tipos e regras do negócio).
Se ele passa a depender de infraestrutura, inverte-se a direção saudável das
dependências: o núcleo fica acoplado a detalhes (banco, framework web, IA), perde
a reusabilidade e vira quase impossível de testar isolado. Mantendo o domínio puro,
toda dependência aponta para dentro, em direção a ele.

**Exemplo:** `G11-dominio-importa-servico/` planta
`api/src/domain/resumo-do-chamado.ts`, que importa `PAGE_SIZE` de
`api/src/services/ticket-service`. O gate emite `G11 api/src/domain/resumo-do-chamado.ts`.

## G12 - Instância única do Prisma

**Regra:** só `api/src/repositories/prisma.ts` pode chamar `new PrismaClient(`.

**Motivação:** cada `PrismaClient` abre a sua própria pool de conexões com o banco.
Espalhar instâncias pelo código (hoje o worker de triagem cria a sua) multiplica
pools, estoura o limite de conexões do Postgres e dificulta configurar log,
datasource e desligamento num só lugar. Centralizar numa instância única exportada
por `repositories/prisma.ts` resolve isso.

**Exemplo:** `G12-prisma-no-servico/` planta
`api/src/services/conexao-extra.ts`, que faz `new PrismaClient()` fora do
repositório único. O gate emite `G12 api/src/services/conexao-extra.ts`.
