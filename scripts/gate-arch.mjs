// Gate de arquitetura (regras de dependência entre camadas).
//
// Cobre as invariantes que dependem de quem importa o quê:
//   G4  - nada em api/src/http/ importa @prisma/client nem api/src/repositories/.
//   G5  - process.env só em api/src/config/; import.meta.env só em web/src/config/.
//   G6  - nada em api/src/services/ importa express, multer ou api/src/http/ (inclusive type-only).
//   G7  - openai só é importado em api/src/integrations/.
//   G8  - nada em web/ importa arquivos de api/ (inclusive type-only).
//   G9  - nenhum import circular em api/src/ nem em web/src/.
//   G11 - pureza do domínio: nada em api/src/domain/ importa de http, services, repositories, integrations ou jobs.
//   G12 - instância única do Prisma: só api/src/repositories/prisma.ts usa "new PrismaClient(".
//
// A leitura dos imports usa o compilador TypeScript (AST), então pega todas as
// formas de escrever um import: estático, "import type", re-export "export ... from",
// "import x = require(...)" e import dinâmico. Assim o gate é genérico, não casa só
// com os nomes das violações de exemplo.
//
// Saída: uma linha por (regra, arquivo) no formato canônico "<ID> <caminho>".

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const repoRoot = process.cwd()

// O pacote typescript é dependência da api; carregamos de lá.
const req = createRequire(path.join(repoRoot, 'api', 'package.json'))
const ts = req('typescript')

// Pastas que o gate varre. Nunca varremos kit-gates/, blackbox/, prisma/, etc.
const RAIZES = ['api/src', 'web/src']

// Lista recursiva de arquivos .ts/.tsx (ignora .d.ts) sob uma raiz.
function listar(dirRel) {
  const abs = path.join(repoRoot, dirRel)
  const saida = []
  if (!fs.existsSync(abs)) return saida
  const pilha = [abs]
  while (pilha.length) {
    const atual = pilha.pop()
    for (const nome of fs.readdirSync(atual)) {
      const p = path.join(atual, nome)
      const st = fs.statSync(p)
      if (st.isDirectory()) {
        if (nome === 'node_modules') continue
        pilha.push(p)
      } else if (/\.(ts|tsx)$/.test(nome) && !nome.endsWith('.d.ts')) {
        saida.push(p)
      }
    }
  }
  return saida
}

const arquivos = RAIZES.flatMap(listar)
const conjuntoArquivos = new Set(arquivos)

// Relativo à raiz do repositório, com barras normais (bom para substring do kit).
function rel(abs) {
  return path.relative(repoRoot, abs).split(path.sep).join('/')
}

// Resolve um specifier relativo para um caminho absoluto de arquivo real, se existir;
// caso não exista, devolve o caminho base (serve para checar prefixo de pasta).
function resolverRelativo(deArquivo, spec) {
  const base = path.resolve(path.dirname(deArquivo), spec)
  const candidatos = [
    base,
    base + '.ts',
    base + '.tsx',
    base + '.d.ts',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]
  for (const c of candidatos) {
    if (conjuntoArquivos.has(c)) return c
  }
  return base
}

// Specifier é um pacote (bare), e casa com o nome dado (exato ou subcaminho).
function casaPacote(spec, nome) {
  if (spec.startsWith('.')) return false
  return spec === nome || spec.startsWith(nome + '/')
}

// Resolve relativo e diz se cai dentro de uma subpasta do repositório (prefixo).
function resolveDentroDe(deArquivo, spec, subpasta) {
  if (!spec.startsWith('.')) return false
  const alvo = resolverRelativo(deArquivo, spec)
  const prefixo = path.join(repoRoot, subpasta) + path.sep
  return (alvo + path.sep).startsWith(prefixo) || alvo === path.join(repoRoot, subpasta)
}

// Extrai todos os module specifiers de um arquivo, cobrindo todas as formas de import.
function lerImports(abs, texto) {
  const sf = ts.createSourceFile(abs, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const specs = []
  function visitar(no) {
    // import ... from '...'  /  export ... from '...'
    if (
      (ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) &&
      no.moduleSpecifier &&
      ts.isStringLiteral(no.moduleSpecifier)
    ) {
      specs.push(no.moduleSpecifier.text)
    }
    // import x = require('...')
    if (
      ts.isImportEqualsDeclaration(no) &&
      ts.isExternalModuleReference(no.moduleReference) &&
      no.moduleReference.expression &&
      ts.isStringLiteral(no.moduleReference.expression)
    ) {
      specs.push(no.moduleReference.expression.text)
    }
    // import('...') dinâmico ou require('...')
    if (ts.isCallExpression(no)) {
      const ehImportDinamico = no.expression.kind === ts.SyntaxKind.ImportKeyword
      const ehRequire = ts.isIdentifier(no.expression) && no.expression.text === 'require'
      if ((ehImportDinamico || ehRequire) && no.arguments.length && ts.isStringLiteral(no.arguments[0])) {
        specs.push(no.arguments[0].text)
      }
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
  return specs
}

const violacoes = new Set() // "ID caminho"
function marcar(id, caminho) {
  violacoes.add(`${id} ${caminho}`)
}

// Grafo de imports internos para detectar ciclos (G9).
const grafo = new Map() // absFrom -> Set(absTo)
for (const abs of arquivos) grafo.set(abs, new Set())

for (const abs of arquivos) {
  const r = rel(abs)
  const texto = fs.readFileSync(abs, 'utf8')

  const ehApi = r.startsWith('api/src/')
  const ehWeb = r.startsWith('web/src/')

  // G5 - uso de variáveis de ambiente fora da camada de configuração.
  if (ehApi && !r.startsWith('api/src/config/') && /\bprocess\.env\b/.test(texto)) {
    marcar('G5', r)
  }
  if (ehWeb && !r.startsWith('web/src/config/') && /\bimport\.meta\.env\b/.test(texto)) {
    marcar('G5', r)
  }

  // G12 - criação de PrismaClient fora do repositório único.
  if (ehApi && r !== 'api/src/repositories/prisma.ts' && /new\s+PrismaClient\s*\(/.test(texto)) {
    marcar('G12', r)
  }

  const specs = lerImports(abs, texto)
  for (const spec of specs) {
    // G4 - rota (http) não acessa banco direto.
    if (r.startsWith('api/src/http/')) {
      if (casaPacote(spec, '@prisma/client') || resolveDentroDe(abs, spec, 'api/src/repositories')) {
        marcar('G4', r)
      }
    }
    // G6 - serviço não conhece a camada http nem frameworks web.
    if (r.startsWith('api/src/services/')) {
      if (
        casaPacote(spec, 'express') ||
        casaPacote(spec, 'multer') ||
        resolveDentroDe(abs, spec, 'api/src/http')
      ) {
        marcar('G6', r)
      }
    }
    // G7 - openai só na camada de integrações.
    if ((ehApi || ehWeb) && !r.startsWith('api/src/integrations/')) {
      if (casaPacote(spec, 'openai')) {
        marcar('G7', r)
      }
    }
    // G8 - front não importa nada da api.
    if (ehWeb && resolveDentroDe(abs, spec, 'api')) {
      marcar('G8', r)
    }
    // G11 - domínio não depende de nenhuma outra camada.
    if (r.startsWith('api/src/domain/')) {
      for (const camada of ['http', 'services', 'repositories', 'integrations', 'jobs']) {
        if (resolveDentroDe(abs, spec, `api/src/${camada}`)) {
          marcar('G11', r)
        }
      }
    }
    // Arestas do grafo (só imports internos resolvidos para arquivo real).
    if (spec.startsWith('.')) {
      const alvo = resolverRelativo(abs, spec)
      if (conjuntoArquivos.has(alvo) && alvo !== abs) {
        grafo.get(abs).add(alvo)
      }
    }
  }
}

// G9 - ciclos: componentes fortemente conexos (Tarjan) com mais de um nó,
// ou um nó com aresta para si mesmo.
function ciclos() {
  let idx = 0
  const num = new Map()
  const low = new Map()
  const naPilha = new Set()
  const pilha = []
  const dentroDeCiclo = new Set()

  function forte(v) {
    num.set(v, idx)
    low.set(v, idx)
    idx++
    pilha.push(v)
    naPilha.add(v)
    for (const w of grafo.get(v)) {
      if (!num.has(w)) {
        forte(w)
        low.set(v, Math.min(low.get(v), low.get(w)))
      } else if (naPilha.has(w)) {
        low.set(v, Math.min(low.get(v), num.get(w)))
      }
    }
    if (low.get(v) === num.get(v)) {
      const comp = []
      let w
      do {
        w = pilha.pop()
        naPilha.delete(w)
        comp.push(w)
      } while (w !== v)
      const temAuto = grafo.get(v).has(v)
      if (comp.length > 1 || temAuto) {
        for (const n of comp) dentroDeCiclo.add(n)
      }
    }
  }

  for (const v of grafo.keys()) {
    if (!num.has(v)) forte(v)
  }
  return dentroDeCiclo
}

for (const abs of ciclos()) {
  marcar('G9', rel(abs))
}

for (const linha of [...violacoes].sort()) {
  process.stdout.write(linha + '\n')
}
