import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../db/db.config'
import { ApiError, ok, validationError } from '../utils/http'

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string
        email: string
        role: string
    }
}

const parentSchema = z.object({
    name: z.string().trim().min(2, 'Нэр хамгийн багадаа 2 тэмдэгт байна'),
    age: z.number().int('Нас бүхэл тоо байна').min(1, 'Нас эерэг тоо байна').max(130, 'Нас буруу байна'),
    gender: z.string().trim().min(1, 'Хүйсийг сонгоно уу'),
    address: z.string().trim().min(5, 'Хаяг хамгийн багадаа 5 тэмдэгт байна'),
    diseases: z.string().optional(),
    medications: z.string().optional(),
    // Mongolian numbers are 8 digits; previously min 10 rejected them
    emergencyContact: z.string().trim().min(8, 'Утасны дугаар хамгийн багадаа 8 оронтой байна').max(20)
})

const PARENT_NOT_FOUND = () => new ApiError(404, 'PARENT_NOT_FOUND', 'Эцэг/эх олдсонгүй')

export const addParent = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = parentSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const { name, age, gender, address, diseases, emergencyContact, medications } = parsed.data

    const parent = await prisma.parent.create({
        data: {
            name,
            age,
            gender,
            address,
            diseases,
            medications,
            emergencyContact,
            children: {
                connect: { id: req.user!.userId }
            }
        }
    })

    return ok(res, { parent }, 'Эцэг/эх амжилттай нэмэгдлээ', 201)
}

// GET /parents - Get all parents for logged-in child
export const getParents = async (req: AuthenticatedRequest, res: Response) => {
    const parents = await prisma.parent.findMany({
        where: {
            children: {
                some: { id: req.user!.userId }
            }
        }
    })

    return ok(res, { parents }, 'Эцэг эхийн мэдээллийг амжилттай авлаа')
}

// GET /parents/:id - Get single parent profile
export const getParent = async (req: AuthenticatedRequest, res: Response) => {
    const parent = await prisma.parent.findFirst({
        where: {
            id: req.params.id,
            children: {
                some: { id: req.user!.userId }
            }
        }
    })

    if (!parent) throw PARENT_NOT_FOUND()

    return ok(res, { parent }, 'Эцэг/эхийн мэдээллийг амжилттай авлаа')
}

// PUT /parents/:id - Update parent profile
export const updateParent = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = parentSchema.partial().safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const result = await prisma.parent.updateMany({
        where: {
            id: req.params.id,
            children: {
                some: { id: req.user!.userId }
            }
        },
        data: parsed.data
    })

    if (result.count === 0) throw PARENT_NOT_FOUND()

    return ok(res, null, 'Эцэг/эхийн мэдээлэл амжилттай шинэчлэгдлээ')
}

// DELETE /parents/:id - Remove parent profile
export const deleteParent = async (req: AuthenticatedRequest, res: Response) => {
    const result = await prisma.parent.deleteMany({
        where: {
            id: req.params.id,
            children: {
                some: { id: req.user!.userId }
            }
        }
    })

    if (result.count === 0) throw PARENT_NOT_FOUND()

    return ok(res, null, 'Эцэг/эх амжилттай устгагдлаа')
}
