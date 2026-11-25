// Gate G2 - lint sem erro E sem warning em api/ e web/.
//
// Roda o ESLint (flat config) em cada pacote e traduz cada arquivo com qualquer
// problema (erro ou warning) para uma linha canônica "G2 <caminho>".
//
// A configuração de cada pacote (eslint.config.mjs) liga, no mínimo:
//   @typescript-eslint/no-unused-vars  (variável/import sem uso) como erro;
//   @typescript-eslint/no-explicit-any (any explícito) como erro.
// Como qualquer mensagem (erro ou warning) conta, o gate é genérico.

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const repoRoot = process.cwd()

const pacotes = [
  { dir: 'api', alvo: 'src' },
  { dir: 'web', alvo: 'src' },
]

const arquivosComProblema = new Set()
let falhaInfra = false

for (const p of pacotes) {
  const bin = path.join(repoRoot, p.dir, 'node_modules', '.bin', 'eslint')
  const r = spawnSync(
    bin,
    [p.alvo, '--format', 'json'],
    { cwd: path.join(repoRoot, p.dir), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  if (r.error) {
    process.stderr.write(`[G2] falha ao executar eslint em ${p.dir}: ${r.error.message}\n`)
    falhaInfra = true
    continue
  }
  let dados
  try {
    dados = JSON.parse(r.stdout || '[]')
  } catch (e) {
    process.stderr.write(`[G2] saída do eslint em ${p.dir} não é JSON válido: ${e.message}\n`)
    process.stderr.write((r.stdout || '').slice(0, 2000) + '\n')
    process.stderr.write((r.stderr || '').slice(0, 2000) + '\n')
    falhaInfra = true
    continue
  }
  for (const res of dados) {
    if ((res.errorCount || 0) + (res.warningCount || 0) > 0) {
      const abs = res.filePath
      const relRepo = path.relative(repoRoot, abs).split(path.sep).join('/')
      arquivosComProblema.add(relRepo)
    }
  }
}

for (const arq of [...arquivosComProblema].sort()) {
  process.stdout.write(`G2 ${arq}\n`)
}

process.exit(falhaInfra ? 1 : 0)
