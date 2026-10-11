import { Request, Response, NextFunction } from 'express'

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
            return res.status(401).json({
                success: false,
                message: 'Нэвтрэх шаардлагатай'
            })
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Хандах эрх хүрэлцэхгүй байна'
            })
        }
        
        next()
    }
}

// Specific role middlewares
export const requireAdmin = requireRole(['ADMIN'])
export const requireNurse = requireRole(['NURSE', 'ADMIN'])
export const requireChild = requireRole(['CHILD', 'ADMIN'])
export const requireMedicalAdmin = requireRole(['MEDICAL_ADMIN', 'ADMIN'])