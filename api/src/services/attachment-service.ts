import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { HttpError } from '../domain/errors'
import { CurrentUser } from '../domain/ticket'
import { env } from '../config/env'
import { AttachmentRepository, attachmentRepository } from '../repositories/attachment-repository'
import { TicketService, ticketService } from './ticket-service'

const uploadDir = env.UPLOAD_DIR

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain']

// Formato mínimo de arquivo recebido do upload. Descrito aqui, de forma estrutural,
// para o serviço não importar o multer nem o express (invariante G6): a rota passa req.file.
type UploadedFile = {
  size: number
  mimetype: string
  originalname: string
  buffer: Buffer
}

export class AttachmentService {
  constructor(
    private attachments: AttachmentRepository,
    private tickets: TicketService,
  ) {}

  async upload(user: CurrentUser, ticketId: string, file: UploadedFile | undefined) {
    await this.tickets.getById(user, ticketId)

    if (!file) {
      throw new HttpError(422, 'validation_error', 'Envie o arquivo no campo file')
    }
    if (file.size > MAX_SIZE) {
      throw new HttpError(413, 'file_too_large', 'O arquivo pode ter no máximo 5 MB')
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new HttpError(415, 'unsupported_type', 'Tipo de arquivo não suportado')
    }

    fs.mkdirSync(uploadDir, { recursive: true })
    const storedName = crypto.randomUUID() + path.extname(file.originalname)
    fs.writeFileSync(path.join(uploadDir, storedName), file.buffer)

    return this.attachments.create({
      ticketId,
      uploaderId: user.id,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    })
  }

  async getForDownload(user: CurrentUser, attachmentId: string) {
    const attachment = await this.attachments.findById(attachmentId)
    if (!attachment) {
      throw new HttpError(404, 'not_found', 'Anexo não encontrado')
    }
    try {
      await this.tickets.getById(user, attachment.ticketId)
    } catch {
      throw new HttpError(404, 'not_found', 'Anexo não encontrado')
    }
    return { attachment, filePath: path.join(uploadDir, attachment.storedName) }
  }
}

export const attachmentService = new AttachmentService(attachmentRepository, ticketService)
