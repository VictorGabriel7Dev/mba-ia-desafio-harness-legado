import { prisma } from './prisma'

// Repositório mínimo para a verificação de saúde: encapsula o ping ao banco,
// para a rota /health não falar direto com o Prisma (invariante G4).
export interface HealthRepository {
  ping(): Promise<void>
}

class PrismaHealthRepository implements HealthRepository {
  async ping() {
    await prisma.$queryRaw`SELECT 1`
  }
}

export const healthRepository = new PrismaHealthRepository()
