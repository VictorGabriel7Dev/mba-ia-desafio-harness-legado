# Registro de incidentes

Erros reais dos agentes de IA durante a instalação do harness. Cada entrada diz o que aconteceu, qual mudança no harness (gate, hook, script ou documento) impede a repetição, e o hash do commit dessa mudança. A ideia do módulo: a cada erro do agente, uma mudança no harness para que ele não se repita.

## 1. A seed sumiu e o banco estava poluído, e ninguém barrou

**O que aconteceu.** Ao refatorar a API, o agente rodou a suíte caixa-preta e ela falhou em 27 dos 51 testes. A causa não era o código: o Postgres de desenvolvimento estava sem as contas da seed (admin/agente/cliente@balcao.dev) e com ~184 chamados de poluição de execuções anteriores. O agente perdeu tempo investigando o código antes de perceber que o estado do banco é que estava errado. A subida manual, em seis passos e três terminais, deixava o estado do banco por conta de quem subia.

**Mudança no harness.** O `scripts/up.sh` passou a, a partir de um clone limpo, criar um Postgres próprio por cópia, migrar e carregar a seed em um único comando, e a seed virou **idempotente** (`create` -> `upsert` em `api/prisma/seed.ts`), para rodar de novo sem erro nem duplicação. Agora "o banco tem a seed" é garantido pela subida, não pela memória de quem subiu.

**Commit.** `1db275e`

## 2. Centralizar o `process.env` quebrou os testes unitários

**O que aconteceu.** Para cumprir a regra G5 (ler `process.env` só em `config/`), o agente centralizou a leitura de ambiente em `config/env`, validado com zod. Isso teve um efeito colateral: ao importar qualquer serviço, os testes unitários passaram a carregar `config/env`, que exige `DATABASE_URL`, e falharam no parse - mesmo sem abrir conexão nenhuma. Um teste puro de regra de negócio quebrou por causa de uma variável de ambiente de infraestrutura.

**Mudança no harness.** A configuração de teste (`api/vitest.config.mts`) passou a injetar um `DATABASE_URL` mínimo para o parse do env passar, e o `AGENTS.md` deixa explícito que o teste unitário não abre banco mas carrega a config. Assim o gate G3 (testes) continua verde e o próximo agente não repete o susto.

**Commit.** `197b751`

## 3. O front importava o interno da API, e limpar um lado quebrou o outro

**O que aconteceu.** O front (`web/`) importava tipos direto de `api/src/domain/ticket` (já era uma violação da regra G8: web não depende de api). Quando o agente removeu um export morto do domínio da API para cumprir a regra G10, o `tsc` do front quebrou, porque ele dependia justamente daquele nome interno. Dois lados acoplados: mexer num quebrou o outro.

**Mudança no harness.** A prevenção está no gate: a regra **G8** (web não importa de `api/`, inclusive só de tipo) e a **G10** (export/arquivo sem uso) passam a travar mecanicamente tanto o acoplamento quanto a tentativa de limpar um lado quebrando o outro - o `gates.sh` roda nos dois pacotes e acende os dois ao mesmo tempo. A correção do código veio depois (o front ganhou tipos próprios em `web/src/types/ticket.ts`, commit `4878bd9`), guiada pela saída desses gates.

**Commit (a mudança de harness).** `6c57108` (infraestrutura de guardrails, G1-G12, que inclui as regras G8 e G10)
