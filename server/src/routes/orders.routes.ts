import { Router } from 'express'
import {
    createDraftOrder,
    getOrder,
    getRedFlagQuestions,
    listOrders,
    putRedFlagAnswers,
    requestQuote,
    updateDraftOrder,
} from '../controllers/orderController'
import { authenticateToken } from '../middlwares/auth'
import { requireRole } from '../middlwares/rbac'

// Family (CHILD) order flow — docs/l1-1-api.md §3, §4, §6
const router = Router()

router.use(authenticateToken, requireRole(['CHILD']))

router.post('/', createDraftOrder)
router.get('/', listOrders)
router.get('/:id', getOrder)
router.patch('/:id', updateDraftOrder)
router.get('/:id/red-flag-questions', getRedFlagQuestions)
router.put('/:id/red-flag-answers', putRedFlagAnswers)
router.post('/:id/quote', requestQuote)

export default router
