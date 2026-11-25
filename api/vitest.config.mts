import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Os testes unitários usam repositórios falsos e nunca tocam o banco, mas, desde que
    // a configuração de ambiente passou a ser centralizada em config/env (invariante G5),
    // importar os serviços carrega o config, que exige DATABASE_URL para validar. Fornecemos
    // um valor aqui só para a validação passar; nenhuma conexão é aberta nos testes unitários.
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://balcao:balcao@localhost:15432/balcao_unit',
    },
  },
})
