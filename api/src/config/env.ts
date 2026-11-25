import { z } from 'zod'

// Única fonte de variáveis de ambiente da api (invariante G5): nenhuma outra
// camada lê process.env diretamente; todas importam estes valores já validados.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Origem permitida no CORS (antes estava fixa em http/app.ts).
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().default('dev-secret'),
  UPLOAD_DIR: z.string().default('/tmp/balcao/uploads'),
  // Modo da IA: "fake" usa a classificação determinística; "openai" chama a API real.
  AI_MODE: z.enum(['fake', 'openai']).default('fake'),
  OPENAI_API_KEY: z.string().optional(),
  TRIAGE_INTERVAL_MS: z.coerce.number().default(2000),
})

export const env = schema.parse(process.env)
