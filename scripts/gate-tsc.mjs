// Gate G1 - zero erro de tipo em api/ e web/.
//
// Roda "tsc --noEmit" nos dois pacotes e traduz cada erro de tipo para uma linha
// canônica "G1 <caminho>". O tsc já é genérico: qualquer erro de tipo vira violação.

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const repoRoot = process.cwd()

// Para cada pacote, o tsc imprime "caminho(linha,col): error TSxxxx: ...".
// Capturamos o caminho (relativo ao pacote) e prefixamos com o nome do pacote.
const pacotes = [
  { dir: 'api', tsconfig: 'tsconfig.json' },
  { dir: 'web', tsconfig: 'tsconfig.json' },
]

const arquivosComErro = new Set()
let falhaInfra = false

for (const p of pacotes) {
  const bin = path.join(repoRoot, p.dir, 'node_modules', '.bin', 'tsc')
  const r = spawnSync(
    bin,
    ['--noEmit', '-p', p.tsconfig, '--pretty', 'false'],
    { cwd: path.join(repoRoot, p.dir), encoding: 'utf8' },
  )
  if (r.error) {
    process.stderr.write(`[G1] falha ao executar tsc em ${p.dir}: ${r.error.message}\n`)
    falhaInfra = true
    continue
  }
  const saida = (r.stdout || '') + (r.stderr || '')
  for (const linha of saida.split('\n')) {
    // "src/services/foo.ts(12,3): error TS2322: ..."
    const m = linha.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+TS\d+/)
    if (m) {
      const arq = m[1].split(path.sep).join('/')
      arquivosComErro.add(`${p.dir}/${arq}`)
    }
  }
}

for (const arq of [...arquivosComErro].sort()) {
  process.stdout.write(`G1 ${arq}\n`)
}

process.exit(falhaInfra ? 1 : 0)
