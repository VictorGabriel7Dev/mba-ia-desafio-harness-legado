import { Router } from 'express'
import multer from 'multer'
import { asyncHandler } from '../errors'
import { requireAuth } from '../middlewares/auth'
import { ReplyWithAuthor, Ticket } from '../../domain/ticket'
import { ticketService } from '../../services/ticket-service'
import { attachmentService } from '../../services/attachment-service'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

function toTicketJson(t: Ticket) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    category: t.category,
    priority: t.priority,
    triageStatus: t.triageStatus,
    customerId: t.customerId,
    assigneeId: t.assigneeId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

function toReplyJson(r: ReplyWithAuthor) {
  return {
    id: r.id,
    ticketId: r.ticketId,
    authorId: r.authorId,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: r.author,
  }
}

router.use(requireAuth)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const page = typeof req.query.page === 'string' ? req.query.page : undefined
    const result = await ticketService.list(req.user!, { status, page })
    res.json({ ...result, items: result.items.map(toTicketJson) })
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.create(req.user!, req.body)
    res.status(201).json(toTicketJson(ticket))
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.getDetails(req.user!, req.params.id)
    res.json({
      ...toTicketJson(ticket),
      replies: ticket.replies.map(toReplyJson),
      attachments: ticket.attachments,
    })
  }),
)

router.post(
  '/:id/assign',
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.assign(req.user!, req.params.id)
    res.json(toTicketJson(ticket))
  }),
)

router.post(
  '/:id/resolve',
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.resolve(req.user!, req.params.id)
    res.json(toTicketJson(ticket))
  }),
)

router.post(
  '/:id/replies',
  asyncHandler(async (req, res) => {
    const reply = await ticketService.addReply(req.user!, req.params.id, req.body)
    res.status(201).json(toReplyJson(reply))
  }),
)

router.post(
  '/:id/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const attachment = await attachmentService.upload(req.user!, req.params.id, req.file)
    res.status(201).json(attachment)
  }),
)

router.post(
  '/:id/suggest-reply',
  asyncHandler(async (req, res) => {
    const suggestion = await ticketService.suggestReply(req.user!, req.params.id)
    res.json({ suggestion })
  }),
)

export default router
