import { Router } from 'express'
import { authenticateToken } from '../middlwares/auth'
import { requireRole } from '../middlwares/rbac'
import {
  listVisitsWaitingApproval,
  getVisitForReview,
  approveVisit,
  rejectVisit
} from '../controllers/reviewController'

const router = Router()

/**
 * @swagger
 * /api/review/visits/review:
 *   get:
 *     tags: [Medical Review]
 *     summary: Get visits waiting for approval
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of visits waiting for medical approval
 */
router.get('/visits/review', authenticateToken, requireRole(['ADMIN']), listVisitsWaitingApproval)

/**
 * @swagger
 * /api/review/visits/{id}/review:
 *   get:
 *     tags: [Medical Review]
 *     summary: Get visit details for review
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visit details for review
 */
router.get('/visits/:id/review', authenticateToken, requireRole(['ADMIN']), getVisitForReview)

/**
 * @swagger
 * /api/review/visits/{id}/approve:
 *   post:
 *     tags: [Medical Review]
 *     summary: Approve visit report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approvalNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Visit approved successfully
 */
router.post('/visits/:id/approve', authenticateToken, requireRole(['ADMIN']), approveVisit)

/**
 * @swagger
 * /api/review/visits/{id}/reject:
 *   post:
 *     tags: [Medical Review]
 *     summary: Reject visit and request revision
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionNote
 *             properties:
 *               rejectionNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Visit rejected and sent for revision
 */
router.post('/visits/:id/reject', authenticateToken, requireRole(['ADMIN']), rejectVisit)

export default router