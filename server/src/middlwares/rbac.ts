import { Request, Response, NextFunction } from 'express'
import { fail } from '../utils/http'

type Role = 'CHILD' | 'NURSE' | 'MEDICAL_ADMIN' | 'ADMIN'

interface AuthRequest extends Request {
    user?: {
        userId: string
        email: string
        role: Role
    }
}

export const requireRole = (allowedRoles: Role[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return fail(res, 401, 'UNAUTHENTICATED', 'Нэвтрэх шаардлагатай')
        }

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
