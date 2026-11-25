import { HealthRepository, healthRepository } from '../repositories/health-repository'

// Verifica a saúde da aplicação pingando o banco através do repositório.
class HealthService {
  constructor(private health: HealthRepository) {}

  async check() {
    await this.health.ping()
    return { status: 'ok', db: 'ok' }
  }
}

export const healthService = new HealthService(healthRepository)
