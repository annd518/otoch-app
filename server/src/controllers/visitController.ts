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

const visitSchema = z.object({
    parentId: z.string().min(1, 'Parent ID is required'),
    scheduledFor: z.string().datetime('Invalid date format'),
    visitType: z.enum(['BASIC', 'FULL'])
})

const assignNurseSchema = z.object({
    nurseId: z.string().min(1, 'Nurse ID is required')
})

const vitalsSchema = z.object({
    bp: z.string().optional(),
    sugar: z.string().optional(),
    pulse: z.string().optional(),
    oxygen: z.string().optional(),
    temperature: z.string().optional(),
    notes: z.string().optional(),
    medicines: z.string().optional()
})

// POST /visits - Schedule appointment
export const scheduleVisit = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validatedData = visitSchema.safeParse(req.body)
        if (!validatedData.success) {
            res.json({
                message: "Буруу өгөгдөл"
            })
            return
        }

        const { parentId, scheduledFor, visitType } = validatedData.data

        // Check if parent belongs to the logged-in child
        const parent = await prisma.parent.findFirst({
            where: {
                id: parentId,
                children: {
                    some: { id: req.user!.userId }
                }
            }
        })

        if (!parent) {
            res.json({
                message: "Эцэг/эх олдсонгүй эсвэл хандах эрхгүй"
            })
            return
        }

        const visit = await prisma.visit.create({
            data: {
                parentId,
                scheduledFor: new Date(scheduledFor),
                visitType,
                status: 'PENDING'
            },
            include: {
                Parent: {
                    select: {
                        name: true,
                        address: true
                    }
                }
            }
        })

        res.status(201).json({
            success: true,
            message: 'Үзлэг амжилттай товлогдлоо',
            data: { visit }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Үзлэг товлож чадсангүй'
        })
    }
}

// GET /visits/child - Get child's visits
export const getChildVisits = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const visits = await prisma.visit.findMany({
            where: {
                Parent: {
                    children: {
                        some: { id: req.user!.userId }
                    }
                },
                // Hide WAITING_APPROVAL and REVISION_REQUIRED from children
                status: {
                    notIn: ['WAITING_APPROVAL', 'REVISION_REQUIRED']
                }
            },
            include: {
                Parent: {
                    select: {
                        name: true,
                        address: true
                    }
                },
                Nurse: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                // Only include vitals for APPROVED visits
                vitals: {
                    where: {
                        Visit: {
                            status: 'APPROVED'
                        }
                    }
                }
            },
            orderBy: {
                scheduledFor: 'desc'
            }
        })

        res.status(200).json({
            success: true,
            message: 'Үзлэгүүдийг амжилттай авлаа',
            data: { visits }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Үзлэгүүдийг авч чадсангүй'
        })
    }
}

// GET /nurses - Get list of nurses
export const getNurses = async (req: Request, res: Response) => {
    try {
        const nurses = await prisma.user.findMany({
            where: {
                role: 'NURSE'
            },
            select: {
                id: true,
                name: true,
                email: true
            }
        })

        res.status(200).json({
            success: true,
            message: 'Сувилагчдын жагсаалтыг амжилттай авлаа',
            data: { nurses }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Сувилагчдын жагсаалтыг авч чадсангүй'
        })
    }
}

// POST /visits/:id/assign - Assign nurse to visit
export const assignNurseToVisit = async (req: Request, res: Response) => {
    try {
        const visitId = req.params.id
        const validatedData = assignNurseSchema.safeParse(req.body)
        
        if (!validatedData.success) {
            res.json({
                message: "Буруу өгөгдөл"
            })
            return
        }

        const { nurseId } = validatedData.data

        // Check if visit exists
        const visit = await prisma.visit.findUnique({
            where: { id: visitId }
        })

        if (!visit) {
            res.json({
                message: "Үзлэг олдсонгүй"
            })
            return
        }

        // Check if nurse exists and has NURSE role
        const nurse = await prisma.user.findFirst({
            where: {
                id: nurseId,
                role: 'NURSE'
            }
        })

        if (!nurse) {
            res.json({
                message: "Сувилагч олдсонгүй"
            })
            return
        }

        // Assign nurse to visit
        const updatedVisit = await prisma.visit.update({
            where: { id: visitId },
            data: {
                nurseId,
                status: 'ASSIGNED'
            },
            include: {
                Parent: {
                    select: {
                        name: true,
                        address: true
                    }
                },
                Nurse: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        })

        res.status(200).json({
            success: true,
            message: 'Сувилагч амжилттай томилогдлоо',
            data: { visit: updatedVisit }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Сувилагч томилж чадсангүй'
        })
    }
}

// GET /visits/nurse - Get nurse's assigned visits
export const getNurseVisits = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const visits = await prisma.visit.findMany({
            where: {
                nurseId: req.user!.userId
            },
            include: {
                Parent: {
                    select: {
                        name: true,
                        age: true,
                        address: true,
                        diseases: true,
                        medications: true,
                        emergencyContact: true
                    }
                }
            },
            orderBy: {
                scheduledFor: 'asc'
            }
        })

        res.status(200).json({
            success: true,
            message: 'Сувилагчийн үзлэгүүдийг амжилттай авлаа',
            data: { visits }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Сувилагчийн үзлэгүүдийг авч чадсангүй'
        })
    }
}

// POST /visits/:id/start - Start visit
export const startVisit = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const visitId = req.params.id

        const visit = await prisma.visit.findFirst({
            where: {
                id: visitId,
                nurseId: req.user!.userId,
                status: 'ASSIGNED'
            }
        })

        if (!visit) {
            res.json({
                message: "Үзлэг олдсонгүй эсвэл танд томилогдоогүй байна"
            })
            return
        }

        const updatedVisit = await prisma.visit.update({
            where: { id: visitId },
            data: { status: 'STARTED' }
        })

        res.status(200).json({
            success: true,
            message: 'Үзлэг амжилттай эхэллээ',
            data: { visit: updatedVisit }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Үзлэг эхлүүлж чадсангүй'
        })
    }
}

// POST /visits/:id/vitals - Submit vitals
export const submitVitals = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const visitId = req.params.id
        const validatedData = vitalsSchema.safeParse(req.body)
        
        if (!validatedData.success) {
            return res.status(400).json({
                success: false,
                message: 'Амин үзүүлэлтийн өгөгдөл буруу байна',
                errors: validatedData.error.format()
            })
        }

        const visit = await prisma.visit.findFirst({
            where: {
                id: visitId,
                nurseId: req.user!.userId
            },
            include: { Parent: true }
        })

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Үзлэг олдсонгүй эсвэл танд томилогдоогүй байна'
            })
        }

        if (visit.status !== 'STARTED' && visit.status !== 'ASSIGNED') {
            return res.status(400).json({
                success: false,
                message: `Амин үзүүлэлт илгээхийн тулд үзлэг STARTED төлөвтэй байх ёстой. Одоогийн төлөв: ${visit.status}`
            })
        }

        const vitals = await prisma.vitals.upsert({
            where: { visitId },
            create: {
                visitId,
                ...validatedData.data
            },
            update: {
                ...validatedData.data
            }
        })

        const updatedVisit = await prisma.visit.update({
            where: { id: visitId },
            data: {
                status: 'WAITING_APPROVAL',
                notes: validatedData.data.notes ?? visit.notes
            },
            include: {
                Parent: {
                    select: { name: true, address: true, emergencyContact: true }
                },
                Nurse: {
                    select: { id: true, name: true, email: true }
                },
                vitals: true
            }
        })

        return res.status(200).json({
            success: true,
            message: 'Амин үзүүлэлт илгээгдэж, эмнэлгийн хяналтад шилжлээ',
            data: { visit: updatedVisit, vitals }
        })
    } catch (error: any) {
        console.error(error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Амин үзүүлэлт илгээж чадсангүй'
        })
    }
}

// POST /visits/:id/complete - Complete visit
export const completeVisit = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const visitId = req.params.id

        const visit = await prisma.visit.findFirst({
            where: {
                id: visitId,
                nurseId: req.user!.userId,
                status: 'STARTED'
            }
        })

        if (!visit) {
            res.json({
                message: "Үзлэг олдсонгүй эсвэл эхлээгүй байна"
            })
            return
        }

        const updatedVisit = await prisma.visit.update({
            where: { id: visitId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date()
            },
            include: {
                vitals: true,
                Parent: {
                    select: {
                        name: true,
                        address: true
                    }
                }
            }
        })

        // Send email notification to children
        const { sendVisitCompletionEmail } = await import('../utils/sendEmail')
        sendVisitCompletionEmail(visitId).catch(console.error)

        res.status(200).json({
            success: true,
            message: 'Үзлэг амжилттай дууслаа',
            data: { visit: updatedVisit }
        })
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Үзлэгийг дуусгаж чадсангүй'
        })
    }
}