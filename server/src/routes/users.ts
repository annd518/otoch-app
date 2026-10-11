import { Router, Request, Response } from 'express'
import prisma from '../db/db.config'
import { authenticateToken } from '../middlwares/auth'
import { requireAdmin } from '../middlwares/rbac'
import { ApiError, ok } from '../utils/http'

const router = Router()

const publicUserSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const

// Apply authentication to all user routes
router.use(authenticateToken)

// GET /api/users - Only admins can view all users
router.get('/', requireAdmin, async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({ select: publicUserSelect })
    return ok(res, { users }, 'Хэрэглэгчдийн жагсаалт')
})

// GET /api/users/:id - Users can view their own profile, admins can view any
router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params
    const requestingUser = (req as any).user

    // Check if user is trying to access their own profile or is admin
    if (requestingUser.userId !== id && requestingUser.role !== 'ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'Хандах эрхгүй')
    }

    const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect })
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Хэрэглэгч олдсонгүй')

    return ok(res, { user }, 'Хэрэглэгчийн мэдээлэл')
})

export default router
