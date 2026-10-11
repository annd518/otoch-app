import { Router, Request, Response } from 'express'
import prisma from '../db/db.config'
import { authenticateToken } from '../middlwares/auth'
import { requireAdmin } from '../middlwares/rbac'

const router = Router()

// Apply authentication to all user routes
router.use(authenticateToken)

// GET /api/users - Only admins can view all users
router.get('/', requireAdmin, async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        })
        res.json({
            success: true,
            data: { users }
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Хэрэглэгчдийн жагсаалтыг авч чадсангүй'
        })
    }
})

// GET /api/users/:id - Users can view their own profile, admins can view any
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const requestingUser = (req as any).user
        
        // Check if user is trying to access their own profile or is admin
        if (requestingUser.userId !== id && requestingUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Хандах эрхгүй'
            })
        }
        
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        })
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Хэрэглэгч олдсонгүй'
            })
        }
        
        res.json({
            success: true,
            data: { user }
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Хэрэглэгчийн мэдээллийг авч чадсангүй'
        })
    }
})

export default router