import { describe, expect, it } from 'vitest'
import { AttachmentService } from './attachment-service'
import { TicketService } from './ticket-service'
import { HttpError } from '../domain/errors'
import { CurrentUser } from '../domain/ticket'

type FakeTicket = { id: string; customerId: string }

function fakeTicketService(ticket: FakeTicket) {
  return {
    getById: async (user: CurrentUser, id: string) => {
      if (id !== ticket.id || (user.role === 'customer' && user.id !== ticket.customerId)) {
        throw new HttpError(404, 'not_found', 'Chamado não encontrado')
      }
      return ticket
    },
  } as unknown as TicketService
}

const fakeAttachments = {
  create: async (data: {
    ticketId: string
    uploaderId: string
    originalName: string
    storedName: string
    mimeType: string
    sizeBytes: number
  }) => ({ id: 'att1', createdAt: new Date(), ...data }),
  findById: async () => null,
}

const ticket = { id: 't1', customerId: 'c1' }

describe('AttachmentService', () => {
  const service = new AttachmentService(fakeAttachments, fakeTicketService(ticket))

  it('exige arquivo', async () => {
    const user: CurrentUser = { id: 'c1', role: 'customer' }
    await expect(service.upload(user, 't1', undefined)).rejects.toMatchObject({ status: 422 })
  })

  it('recusa arquivo maior que 5 MB', async () => {
    const user: CurrentUser = { id: 'c1', role: 'customer' }
    const file = { size: 5 * 1024 * 1024 + 1, mimetype: 'text/plain', originalname: 'a.txt', buffer: Buffer.from('') }
    await expect(service.upload(user, 't1', file)).rejects.toMatchObject({ status: 413, code: 'file_too_large' })
  })

  it('recusa tipo não suportado', async () => {
    const user: CurrentUser = { id: 'c1', role: 'customer' }
    const file = { size: 10, mimetype: 'image/gif', originalname: 'a.gif', buffer: Buffer.from('') }
    await expect(service.upload(user, 't1', file)).rejects.toMatchObject({ status: 415, code: 'unsupported_type' })
  })

  it('não deixa outro cliente enviar', async () => {
    const user: CurrentUser = { id: 'c2', role: 'customer' }
    await expect(service.upload(user, 't1', undefined)).rejects.toMatchObject({ status: 404 })
  })
})
