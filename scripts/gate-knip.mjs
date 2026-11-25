// Gate G10 - nenhum arquivo sem uso, export sem uso (inclusive de tipo) ou
// dependência declarada sem uso, em api/ e web/.
//
// Usa o knip (reporter JSON) em cada pacote e traduz cada achado para uma linha
// canônica:
//   arquivo sem uso  -> "G10 <caminho>"
//   export sem uso   -> "G10 <caminho>"   (inclui types, enum members, namespaces)
//   dependência sem uso -> "G10 <pacote>/package.json <nome-da-dependencia>"
//
// O knip sai com código 1 quando encontra problemas; isso é normal e não é falha
// de infraestrutura. Só tratamos como falha se o processo não roda ou não devolve JSON.

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const repoRoot = process.cwd()

const pacotes = ['api', 'web']
const linhas = new Set()
let falhaInfra = false

for (const dir of pacotes) {
  const bin = path.join(repoRoot, dir, 'node_modules', '.bin', 'knip')
  const r = spawnSync(
    bin,
    ['--reporter', 'json', '--no-exit-code'],
    { cwd: path.join(repoRoot, dir), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  if (r.error) {
    process.stderr.write(`[G10] falha ao executar knip em ${dir}: ${r.error.message}\n`)
    falhaInfra = true
    continue
  }
  const bruto = r.stdout || ''
  const ini = bruto.indexOf('{')
  const fim = bruto.lastIndexOf('}')
  let dados
  try {
    dados = JSON.parse(bruto.slice(ini, fim + 1))
  } catch (e) {
    process.stderr.write(`[G10] saída do knip em ${dir} não é JSON válido: ${e.message}\n`)
    process.stderr.write(bruto.slice(0, 2000) + '\n')
    process.stderr.write((r.stderr || '').slice(0, 2000) + '\n')
    falhaInfra = true
    continue
  }

  for (const issue of dados.issues || []) {
    const arqRepo = `${dir}/${issue.file}`.split(path.sep).join('/')

    // Arquivo(s) sem uso.
    for (const f of issue.files || []) {
      const nome = typeof f === 'string' ? f : f.name
      linhas.add(`G10 ${dir}/${nome}`.split(path.sep).join('/'))
    }

    // Exports sem uso, inclusive de tipo.
    for (const chave of ['exports', 'types', 'enumMembers', 'namespaceMembers', 'duplicates']) {
      const lista = issue[chave] || []
      if (lista.length > 0) {
        linhas.add(`G10 ${arqRepo}`)
      }
    }

    // Dependências declaradas e não usadas.
    for (const chave of ['dependencies', 'devDependencies', 'optionalPeerDependencies']) {
      for (const dep of issue[chave] || []) {
        const nome = typeof dep === 'string' ? dep : dep.name
        // issue.file aqui é "package.json" do pacote.
        linhas.add(`G10 ${arqRepo} ${nome}`)
      }
    }
  }
}

for (const linha of [...linhas].sort()) {
  process.stdout.write(linha + '\n')
}

process.exit(falhaInfra ? 1 : 0)
