import { Router } from 'express'
import { devMockPay, qpayCallback } from '../controllers/paymentController'
import { authenticateToken } from '../middlwares/auth'
import { requireRole } from '../middlwares/rbac'

const router = Router()

// Provider -> backend. Public (no JWT); protected by the secret path segment.
// It only triggers a provider payment check; it never marks anything paid by itself.
router.get('/payments/qpay/callback/:secret', qpayCallback)
router.post('/payments/qpay/callback/:secret', qpayCallback)

// Dev/test only, QPAY_MODE=mock only (404 otherwise): simulates the customer paying a MOCK invoice
router.post('/dev/qpay-mock/orders/:id/payments/:paymentId/pay', authenticateToken, requireRole(['CHILD']), devMockPay)

export default router
