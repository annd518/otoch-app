import { Request, Response, NextFunction } from 'express'
import prisma from '../db/db.config'
import { fail } from '../utils/http'

type Role = 'CHILD' | 'NURSE' | 'MEDICAL_ADMIN' | 'ADMIN'

interface AuthRequest extends Request {
    user?: {
        userId: string
        email: string
        role: Role
    }
}

// The role and the account state come from the database, not from the token:
// a changed role or a deactivated account (admin web) takes effect at once
// instead of when the token (up to 24 h) expires.
export const requireRole = (allowedRoles: Role[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return fail(res, 401, 'UNAUTHENTICATED', 'Нэвтрэх шаардлагатай')
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { role: true, deletedAt: true },
        })
        if (!user || user.deletedAt) {
            return fail(res, 401, 'ACCOUNT_DISABLED', 'Бүртгэл идэвхгүй байна. Админд хандана уу')
        }
        req.user.role = user.role

        if (!allowedRoles.includes(req.user.role)) {
            return fail(res, 403, 'FORBIDDEN', 'Хандах эрх хүрэлцэхгүй байна')
        }

        next()
    }
}

// Specific role middlewares
export const requireAdmin = requireRole(['ADMIN'])
export const requireNurse = requireRole(['NURSE', 'ADMIN'])
export const requireChild = requireRole(['CHILD', 'ADMIN'])
export const requireMedicalAdmin = requireRole(['MEDICAL_ADMIN', 'ADMIN'])
