// Gate G3 - os testes unitários da API passam.
//
// Roda "vitest run" na api (que inclui api/src/**/*.test.ts, sem banco) e traduz
// cada arquivo de teste que falhou para uma linha canônica "G3 <caminho>".
//
// O reporter JSON do vitest escreve num arquivo (não no stdout), então mandamos a
// saída para um arquivo temporário fora do repositório e o lemos de volta.

import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repoRoot = process.cwd()
const apiDir = path.join(repoRoot, 'api')
const bin = path.join(apiDir, 'node_modules', '.bin', 'vitest')

const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'gate-vitest-'))
const saidaJson = path.join(tmpDir, 'vitest.json')

const r = spawnSync(
  bin,
  ['run', '--reporter=json', `--outputFile=${saidaJson}`],
  { cwd: apiDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)

if (r.error) {
  process.stderr.write(`[G3] falha ao executar vitest: ${r.error.message}\n`)
  rmSync(tmpDir, { recursive: true, force: true })
  process.exit(1)
}

const arquivosComFalha = new Set()
let leuJson = false

try {
  const dados = JSON.parse(readFileSync(saidaJson, 'utf8'))
  leuJson = true
  for (const t of dados.testResults || []) {
    if (t.status === 'failed') {
      const relRepo = path.relative(repoRoot, t.name).split(path.sep).join('/')
      arquivosComFalha.add(relRepo)
    }
  }
} catch (e) {
  // Sem JSON utilizável: cai para o texto do stdout/stderr, procurando "FAIL ... .test.ts".
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
  if (!leuJson && r.status !== 0 && arquivosComFalha.size === 0) {
    process.stderr.write(`[G3] vitest falhou (codigo ${r.status}) mas nenhum arquivo foi identificado: ${e.message}\n`)
  }
}

rmSync(tmpDir, { recursive: true, force: true })

for (const arq of [...arquivosComFalha].sort()) {
  process.stdout.write(`G3 ${arq}\n`)
}

process.exit(0)
