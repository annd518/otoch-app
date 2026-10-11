import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { fail } from '../utils/http'

interface AuthRequest extends Request {
    user?: any
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return fail(res, 401, 'UNAUTHENTICATED', 'Нэвтрэх шаардлагатай')
    }

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
        // 401 = who are you? (missing/invalid/expired). 403 FORBIDDEN = known user, wrong role.
        if (err?.name === 'TokenExpiredError') {
            return fail(res, 401, 'TOKEN_EXPIRED', 'Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү')
        }
        if (err) {
            return fail(res, 401, 'UNAUTHENTICATED', 'Токен хүчингүй байна. Дахин нэвтэрнэ үү')
        }
        req.user = user
        next()
    })
}
