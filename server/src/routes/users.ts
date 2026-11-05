import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '../db/db.config'
import { authenticateToken } from '../middlwares/auth'
import { requireAdmin } from '../middlwares/rbac'
import { ApiError, ok, validationError } from '../utils/http'
import { avatarSchema, readAvatar } from '../services/avatar'

const router = Router()

const publicUserSelect = { id: true, name: true, email: true, role: true, avatar: true, createdAt: true } as const

// Apply authentication to all user routes
router.use(authenticateToken)

// GET /api/users/me/avatar - the signed-in user's own avatar (null = none)
router.get('/me/avatar', async (req: Request, res: Response) => {
    const userId = (req as any).user.userId as string
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } })
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Хэрэглэгч олдсонгүй')
    return ok(res, { avatar: readAvatar(user.avatar) }, 'Аватар')
})

// PUT /api/users/me/avatar {avatar} - any role; {avatar: null} removes it (it is optional)
router.put('/me/avatar', async (req: Request, res: Response) => {
    const p = z.object({ avatar: avatarSchema.nullable() }).strict().safeParse(req.body ?? {})
    if (!p.success) throw validationError(p.error)
    const userId = (req as any).user.userId as string
    const user = await prisma.user.update({
        where: { id: userId },
        data: { avatar: p.data.avatar ?? Prisma.DbNull },
        select: { avatar: true },
    })
    return ok(res, { avatar: readAvatar(user.avatar) }, p.data.avatar ? 'Аватар хадгалагдлаа' : 'Аватар хасагдлаа')
})

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
