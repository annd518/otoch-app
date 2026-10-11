import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../db/db.config'

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string
        email: string
        role: string
    }
}

const parentSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    age: z.number().min(1, 'Age must be positive'),
    gender: z.string().min(1, 'Gender is required'),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    diseases: z.string().optional(),
    medications: z.string().optional(),
    emergencyContact: z.string().min(10, 'Emergency contact is required of length 10')
})


export const addParent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validatedData = parentSchema.safeParse(req.body)
        if (!validatedData.success) {
            res.json({
                message: "Буруу өгөгдөл",
                error: validatedData.error.format()
            })
            return
        }
        const { name, age, gender, address, diseases, emergencyContact, medications } = validatedData.data

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

        res.status(201).json({
            success: true,
            message: 'Эцэг/эх амжилттай нэмэгдлээ',
            data: { parent }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Эцэг/эх нэмж чадсангүй'
        })
    }
}

// GET /parents - Get all parents for logged-in child
export const getParents = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parents = await prisma.parent.findMany({
            where: {
                children: {
                    some: { id: req.user!.userId }
                }
            }
        })

        res.status(200).json({
            success: true,
            message: 'Эцэг эхийн мэдээллийг амжилттай авлаа',
            data: { parents }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Эцэг эхийн мэдээллийг авч чадсангүй'
        })
    }
}

// GET /parents/:id - Get single parent profile
export const getParent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parent = await prisma.parent.findFirst({
            where: {
                id: req.params.id,
                children: {
                    some: { id: req.user!.userId }
                }
            }
        })

        if (!parent) {
            res.json({
                message: "Эцэг/эх олдсонгүй"
            })
            return
        }

        res.status(200).json({
            success: true,
            message: 'Эцэг/эхийн мэдээллийг амжилттай авлаа',
            data: { parent }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Эцэг/эхийн мэдээллийг авч чадсангүй'
        })
    }
}

// PUT /parents/:id - Update parent profile
export const updateParent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validatedData = parentSchema.partial().safeParse(req.body)
        if (!validatedData.success) {
            res.json({
                message: "Буруу өгөгдөл"
            })
            return
        }

        const parent = await prisma.parent.updateMany({
            where: {
                id: req.params.id,
                children: {
                    some: { id: req.user!.userId }
                }
            },
            data: validatedData.data
        })

        if (parent.count === 0) {
            res.json({
                message: "Эцэг/эх олдсонгүй"
            })
            return
        }

        res.status(200).json({
            success: true,
            message: 'Эцэг/эхийн мэдээлэл амжилттай шинэчлэгдлээ'
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Эцэг/эхийн мэдээллийг шинэчилж чадсангүй'
        })
    }
}

// DELETE /parents/:id - Remove parent profile
export const deleteParent = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parent = await prisma.parent.deleteMany({
            where: {
                id: req.params.id,
                children: {
                    some: { id: req.user!.userId }
                }
            }
        })

        if (parent.count === 0) {
            res.json({
                message: "Эцэг/эх олдсонгүй"
            })
            return
        }

        res.status(200).json({
            success: true,
            message: 'Эцэг/эх амжилттай устгагдлаа'
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Эцэг/эхийг устгаж чадсангүй'
        })
    }
}