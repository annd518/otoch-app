import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../db/db.config'
import { ApiError, ok, validationError } from '../utils/http'
import { logError } from '../utils/logger'

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string
        email: string
        role: string
    }
}

const visitSchema = z.object({
    parentId: z.string().trim().min(1, 'Эцэг/эхийг сонгоно уу'),
    // ISO-8601; both "…Z" (current mobile) and "+08:00" offsets are accepted
    scheduledFor: z.string().datetime({ offset: true, message: 'Огноо ISO-8601 хэлбэртэй байна' })
        .refine((value) => new Date(value).getTime() > Date.now(), 'Ирээдүйн огноо сонгоно уу'),
    visitType: z.enum(['BASIC', 'FULL'], { message: 'visitType нь BASIC эсвэл FULL байна' })
})

const assignNurseSchema = z.object({
    nurseId: z.string().trim().min(1, 'Сувилагчийг сонгоно уу')
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

const VISIT_NOT_FOUND = () => new ApiError(404, 'VISIT_NOT_FOUND', 'Үзлэг олдсонгүй')

// POST /visits - Schedule appointment
export const scheduleVisit = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = visitSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const { parentId, scheduledFor, visitType } = parsed.data

    // Parent must belong to the logged-in child. Unknown and foreign parents
    // get the same 404 so other users' parent IDs cannot be probed.
    const parent = await prisma.parent.findFirst({
        where: {
            id: parentId,
            children: {
                some: { id: req.user!.userId }
            }
        }
    })

    if (!parent) {
        throw new ApiError(404, 'PARENT_NOT_FOUND', 'Эцэг/эх олдсонгүй эсвэл хандах эрхгүй', { parentId: 'Олдсонгүй' })
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

    return ok(res, { visit }, 'Үзлэг амжилттай товлогдлоо', 201)
}

// GET /visits/child - Get child's visits
export const getChildVisits = async (req: AuthenticatedRequest, res: Response) => {
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

    return ok(res, { visits }, 'Үзлэгүүдийг амжилттай авлаа')
}

// GET /nurses - Get list of nurses
export const getNurses = async (req: Request, res: Response) => {
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

    return ok(res, { nurses }, 'Сувилагчдын жагсаалтыг амжилттай авлаа')
}

// POST /visits/:id/assign - Assign nurse to visit
export const assignNurseToVisit = async (req: Request, res: Response) => {
    const visitId = req.params.id
    const parsed = assignNurseSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const { nurseId } = parsed.data

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
        where: { id: visitId }
    })

    if (!visit) throw VISIT_NOT_FOUND()

    // Check if nurse exists and has NURSE role
    const nurse = await prisma.user.findFirst({
        where: {
            id: nurseId,
            role: 'NURSE'
        }
    })

    if (!nurse) {
        throw new ApiError(404, 'NURSE_NOT_FOUND', 'Сувилагч олдсонгүй', { nurseId: 'Олдсонгүй' })
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

    return ok(res, { visit: updatedVisit }, 'Сувилагч амжилттай томилогдлоо')
}

// GET /visits/nurse - Get nurse's assigned visits
export const getNurseVisits = async (req: AuthenticatedRequest, res: Response) => {
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

    return ok(res, { visits }, 'Сувилагчийн үзлэгүүдийг амжилттай авлаа')
}

// Loads a visit assigned to the current nurse and checks its status
async function findNurseVisitWithStatus(visitId: string, nurseId: string, expected: string[]) {
    const visit = await prisma.visit.findFirst({
        where: { id: visitId, nurseId },
        include: { Parent: true }
    })
    if (!visit) throw new ApiError(404, 'VISIT_NOT_FOUND', 'Үзлэг олдсонгүй эсвэл танд томилогдоогүй байна')
    if (!expected.includes(visit.status)) {
        throw new ApiError(409, 'INVALID_STATUS', `Үзлэгийн одоогийн төлөв (${visit.status}) энэ үйлдлийг зөвшөөрөхгүй`)
    }
    return visit
}

// POST /visits/:id/start - Start visit
export const startVisit = async (req: AuthenticatedRequest, res: Response) => {
    const visitId = req.params.id
    await findNurseVisitWithStatus(visitId, req.user!.userId, ['ASSIGNED'])

    const updatedVisit = await prisma.visit.update({
        where: { id: visitId },
        data: { status: 'STARTED' }
    })

    return ok(res, { visit: updatedVisit }, 'Үзлэг амжилттай эхэллээ')
}

// POST /visits/:id/vitals - Submit vitals
export const submitVitals = async (req: AuthenticatedRequest, res: Response) => {
    const visitId = req.params.id
    const parsed = vitalsSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const visit = await findNurseVisitWithStatus(visitId, req.user!.userId, ['STARTED', 'ASSIGNED'])

    const vitals = await prisma.vitals.upsert({
        where: { visitId },
        create: {
            visitId,
            ...parsed.data
        },
        update: {
            ...parsed.data
        }
    })

    const updatedVisit = await prisma.visit.update({
        where: { id: visitId },
        data: {
            status: 'WAITING_APPROVAL',
            notes: parsed.data.notes ?? visit.notes
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

    return ok(res, { visit: updatedVisit, vitals }, 'Амин үзүүлэлт илгээгдэж, эмнэлгийн хяналтад шилжлээ')
}

// POST /visits/:id/complete - Complete visit
export const completeVisit = async (req: AuthenticatedRequest, res: Response) => {
    const visitId = req.params.id
    await findNurseVisitWithStatus(visitId, req.user!.userId, ['STARTED'])

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
    sendVisitCompletionEmail(visitId).catch((err) => logError('sendVisitCompletionEmail', err))

    return ok(res, { visit: updatedVisit }, 'Үзлэг амжилттай дууслаа')
}
