import { Request, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../db/db.config'
import { ApiError, ok, validationError } from '../utils/http'

export interface SignupData {
    name: string
    email: string
    password: string
    role?: 'CHILD'
}

export interface LoginData {
    email: string
    password: string
}

// Public signup can only ever create CHILD accounts. Privileged roles
// (NURSE, MEDICAL_ADMIN, ADMIN) must be provisioned by an admin, never here.
const PUBLIC_SIGNUP_ROLE = 'CHILD' as const

const signupSchema = z.object({
    name: z.string().trim().min(2, 'Нэр хамгийн багадаа 2 тэмдэгт байна'),
    email: z.string().trim().email('Имэйл хаяг буруу байна'),
    password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт байна').max(128),
    // Accepted for backward compatibility; anything other than CHILD is rejected below
    role: z.string().optional()
})

const loginSchema = z.object({
    email: z.string().trim().email('Имэйл хаяг буруу байна'),
    password: z.string().min(1, 'Нууц үгээ оруулна уу')
})

const publicUserSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const

// Used when the email is unknown so both failure paths take similar time
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', 10)

const INVALID_CREDENTIALS = new ApiError(401, 'INVALID_CREDENTIALS', 'Имэйл эсвэл нууц үг буруу байна')

function issueToken(user: { id: string; email: string; role: string }) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn']
    return jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn })
}

function setAuthCookie(res: Response, token: string) {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    })
}

const findUserByEmail = (email: string) =>
    prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })

export const signupController = async (req: Request, res: Response) => {
    const parsed = signupSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const { name, email, password, role } = parsed.data

    if (role !== undefined && role !== PUBLIC_SIGNUP_ROLE) {
        throw new ApiError(403, 'ROLE_NOT_ALLOWED', 'Нийтийн бүртгэлээр зөвхөн энгийн хэрэглэгчийн эрх үүсгэх боломжтой', {
            role: `Зөвхөн "${PUBLIC_SIGNUP_ROLE}" зөвшөөрөгдөнө`
        })
    }

    if (await findUserByEmail(email)) {
        throw new ApiError(409, 'EMAIL_TAKEN', 'Энэ имэйлээр бүртгэл аль хэдийн үүссэн байна', {
            email: 'Бүртгэлтэй имэйл'
        })
    }

    const user = await prisma.user.create({
        data: {
            name,
            email: email.toLowerCase(),
            password: await bcrypt.hash(password, 10),
            role: PUBLIC_SIGNUP_ROLE
        },
        select: publicUserSelect
    })

    const token = issueToken(user)
    setAuthCookie(res, token)

    return ok(res, { token, user }, 'Хэрэглэгч амжилттай бүртгэгдлээ', 201)
}

export const loginController = async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const { email, password } = parsed.data
    const user = await findUserByEmail(email)

    // Same response for unknown email and wrong password (no account enumeration)
    const passwordOk = await bcrypt.compare(password, user?.password ?? DUMMY_HASH)
    if (!user || !passwordOk) throw INVALID_CREDENTIALS

    const token = issueToken(user)
    setAuthCookie(res, token)

    const { id, name, email: userEmail, role, createdAt } = user
    return ok(res, { token, user: { id, name, email: userEmail, role, createdAt } }, 'Амжилттай нэвтэрлээ')
}
