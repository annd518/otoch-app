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
import { deleteAttachment, listAttachments, readAttachment, uploadAttachment } from '../controllers/attachmentController'
import { createQPayPayment, getPayment } from '../controllers/paymentController'
import { cancelClientOrder, getCancelTerms } from '../controllers/cancelController'
import { rateOrder } from '../controllers/ratingController'
import { rescheduleOrder } from '../controllers/rescheduleController'
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

// Cancellation (spec slide 25): terms first, then confirm them
router.get('/:id/cancellation', getCancelTerms)
router.post('/:id/cancel', cancelClientOrder)

// Rating a finished visit (spec SCR-C16)
router.post('/:id/rating', rateOrder)

// Another time for a paid order (spec slide 25)
router.post('/:id/reschedule', rescheduleOrder)

// Private referral images (docs/l1-1-api.md §5)
router.post('/:id/attachments', uploadAttachment)
router.get('/:id/attachments', listAttachments)
router.get('/:id/attachments/:attachmentId/content', readAttachment)
router.delete('/:id/attachments/:attachmentId', deleteAttachment)

// QPay (docs/l1-1-api.md §7) — mock or sandbox, never production
router.post('/:id/payments/qpay', createQPayPayment)
router.get('/:id/payments/:paymentId', getPayment)

export default router
