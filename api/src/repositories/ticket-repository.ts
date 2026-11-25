import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { Ticket, TicketCategory, TicketDetails, TicketPriority, TicketStatus } from '../domain/ticket'

export type TicketFilter = {
  customerId?: string
  status?: TicketStatus
}

export type TicketUpdate = Partial<Pick<Ticket, 'status' | 'assigneeId' | 'category' | 'priority' | 'triageStatus'>>

export interface TicketRepository {
  create(data: { title: string; description: string; customerId: string }): Promise<Ticket>
  findById(id: string): Promise<Ticket | null>
  findByIdWithDetails(id: string): Promise<TicketDetails | null>
  list(filter: TicketFilter, page: number, pageSize: number): Promise<{ items: Ticket[]; total: number }>
  update(id: string, data: TicketUpdate): Promise<Ticket>
  countByStatus(): Promise<{ status: TicketStatus; count: number }[]>
  countByCategory(): Promise<{ category: TicketCategory | null; count: number }[]>
  countByPriority(): Promise<{ priority: TicketPriority | null; count: number }[]>
}

class PrismaTicketRepository implements TicketRepository {
  create(data: { title: string; description: string; customerId: string }) {
    return prisma.ticket.create({ data })
  }

  findById(id: string) {
    return prisma.ticket.findUnique({ where: { id } })
  }

  findByIdWithDetails(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    })
  }

  async list(filter: TicketFilter, page: number, pageSize: number) {
    const where: Prisma.TicketWhereInput = {}
    if (filter.customerId) where.customerId = filter.customerId
    if (filter.status) where.status = filter.status
    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ])
    return { items, total }
  }

  update(id: string, data: TicketUpdate) {
    return prisma.ticket.update({ where: { id }, data })
  }

  async countByStatus() {
    const rows = await prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } })
    return rows.map((row) => ({ status: row.status, count: row._count._all }))
  }

  async countByCategory() {
    const rows = await prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } })
    return rows.map((row) => ({ category: row.category, count: row._count._all }))
  }

  async countByPriority() {
    const rows = await prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } })
    return rows.map((row) => ({ priority: row.priority, count: row._count._all }))
  }
}

export const ticketRepository = new PrismaTicketRepository()
