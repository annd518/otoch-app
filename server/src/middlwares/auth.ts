import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

interface AuthRequest extends Request {
    user?: any
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies.token || req.header("Authorization")?.replace("Bearer ", "");


    if (!token) {
        return res.status(401).json({ error: 'Нэвтрэх токен шаардлагатай' })
    }

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ error: 'Токен хүчингүй эсвэл хугацаа нь дууссан' })
        }
        req.user = user
        next()
    })
}