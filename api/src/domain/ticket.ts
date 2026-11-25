type Role = 'customer' | 'agent' | 'admin'

export type TicketStatus = 'open' | 'in_progress' | 'resolved'

export type TicketCategory = 'billing' | 'technical' | 'account' | 'other'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

type TriageStatus = 'pending' | 'done' | 'failed'

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved']
export const TICKET_CATEGORIES: TicketCategory[] = ['billing', 'technical', 'account', 'other']
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']

export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  category: TicketCategory | null
  priority: TicketPriority | null
  triageStatus: TriageStatus
  customerId: string
  assigneeId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CurrentUser {
  id: string
  role: Role
}

// Resposta de um chamado já com o autor embutido (formato devolvido pelos repositórios
// e serializado nas rotas). Fica no domínio para a camada http descrever o retorno sem
// precisar importar a camada de repositórios (invariante G4).
export interface ReplyWithAuthor {
  id: string
  ticketId: string
  authorId: string
  body: string
  createdAt: Date
  author: { id: string; name: string; role: Role }
}

// Chamado com todos os detalhes (respostas e anexos) usado na tela de detalhe.
export interface TicketDetails extends Ticket {
  replies: ReplyWithAuthor[]
  attachments: {
    id: string
    ticketId: string
    uploaderId: string
    originalName: string
    storedName: string
    mimeType: string
    sizeBytes: number
    createdAt: Date
  }[]
}

// Referência curta do chamado para logs e notificações (ex.: "#abcdef12 (Título)").
// Mora no domínio para que o notification-service a use sem depender do ticket-service,
// evitando o ciclo de imports entre os dois (invariante G9).
export function formatTicketRef(ticket: { id: string; title: string }) {
  return `#${ticket.id.slice(0, 8)} (${ticket.title})`
}
