import { Router } from 'express'
import { asyncHandler } from '../errors'
import { requireAuth, requireRole } from '../middlewares/auth'
import { statsService } from '../../services/stats-service'

const router = Router()

router.get(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    res.json(await statsService.overview())
  }),
)

export default router
