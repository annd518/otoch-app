import { Router } from 'express'
import { listCatalogServices } from '../controllers/catalogController'
import { authenticateToken } from '../middlwares/auth'

const router = Router()

/**
 * @swagger
 * /api/catalog/services:
 *   get:
 *     tags: [Catalog]
 *     summary: List active services (prices are integer MNT, display only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Active catalog services
 *       401:
 *         description: Not authenticated
 */
router.get('/services', authenticateToken, listCatalogServices)

export default router
