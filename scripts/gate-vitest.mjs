// Gate G3 - os testes unitários da API passam.
//
// Roda "vitest run" na api (que inclui api/src/**/*.test.ts, sem banco) e traduz
// cada arquivo de teste que falhou para uma linha canônica "G3 <caminho>".
// Usa o reporter JSON para não depender do texto do relatório.

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const repoRoot = process.cwd()
const apiDir = path.join(repoRoot, 'api')
const bin = path.join(apiDir, 'node_modules', '.bin', 'vitest')

const r = spawnSync(
  bin,
  ['run', '--reporter=json'],
  { cwd: apiDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)

if (r.error) {
  process.stderr.write(`[G3] falha ao executar vitest: ${r.error.message}\n`)
  process.exit(1)
}

// O reporter JSON imprime um objeto; pode vir cercado por outras linhas.
// Pegamos o maior trecho entre a primeira "{" e a última "}".
const bruto = r.stdout || ''
let dados = null
const ini = bruto.indexOf('{')
const fim = bruto.lastIndexOf('}')
if (ini >= 0 && fim > ini) {
  try {
    dados = JSON.parse(bruto.slice(ini, fim + 1))
  } catch {
    dados = null
  }
}

const arquivosComFalha = new Set()

if (dados && Array.isArray(dados.testResults)) {
  for (const t of dados.testResults) {
    if (t.status === 'failed') {
      const relRepo = path.relative(repoRoot, t.name).split(path.sep).join('/')
      arquivosComFalha.add(relRepo)
    }
  }
} else {
  // Sem JSON utilizável: cai para o texto, procurando linhas "FAIL ... .test.ts".
  const texto = (r.stdout || '') + (r.stderr || '')
  for (const linha of texto.split('\n')) {
    if (/\bFAIL\b/.test(linha)) {
      const m = linha.match(/(\S+\.test\.tsx?)/)
      if (m) {
        let arq = m[1]
        if (!arq.startsWith('api/')) arq = `api/${arq}`
        arquivosComFalha.add(arq.split(path.sep).join('/'))
      }
    }
  }
  if (r.status !== 0 && arquivosComFalha.size === 0) {
    process.stderr.write('[G3] vitest falhou mas nenhum arquivo de teste foi identificado.\n')
    process.stderr.write(texto.slice(0, 2000) + '\n')
  }
}

for (const arq of [...arquivosComFalha].sort()) {
  process.stdout.write(`G3 ${arq}\n`)
}

process.exit(0)
