import { TicketRepository, ticketRepository } from '../repositories/ticket-repository'

// Monta os agregados de chamados para o painel de estatísticas, a partir dos
// repositórios (a rota /stats não fala mais direto com o Prisma, invariante G4).
class StatsService {
  constructor(private tickets: TicketRepository) {}

  async overview() {
    const [statusRows, categoryRows, priorityRows] = await Promise.all([
      this.tickets.countByStatus(),
      this.tickets.countByCategory(),
      this.tickets.countByPriority(),
    ])

    const byStatus: Record<string, number> = { open: 0, in_progress: 0, resolved: 0 }
    for (const row of statusRows) {
      byStatus[row.status] = row.count
    }

    const byCategory: Record<string, number> = { billing: 0, technical: 0, account: 0, other: 0, untriaged: 0 }
    for (const row of categoryRows) {
      byCategory[row.category || 'untriaged'] = row.count
    }

    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0, untriaged: 0 }
    for (const row of priorityRows) {
      byPriority[row.priority || 'untriaged'] = row.count
    }

    return { byStatus, byCategory, byPriority }
  }
}

export const statsService = new StatsService(ticketRepository)
