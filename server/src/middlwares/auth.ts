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
        if (err) {
            return fail(res, 401, 'UNAUTHENTICATED', 'Нэвтрэх хугацаа дууссан эсвэл токен хүчингүй байна. Дахин нэвтэрнэ үү')
        }
        req.user = user
        next()
    })
}
