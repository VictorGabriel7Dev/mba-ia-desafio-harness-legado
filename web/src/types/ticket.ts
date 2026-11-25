// Tipos de domínio do chamado usados pelo web. São uma cópia própria do front para
// que a camada web não importe nada de api/ (invariante G8).
export type TicketStatus = 'open' | 'in_progress' | 'resolved'

export type TicketCategory = 'billing' | 'technical' | 'account' | 'other'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TriageStatus = 'pending' | 'done' | 'failed'
