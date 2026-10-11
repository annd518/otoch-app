import { Response } from 'express'
import { z } from 'zod'
import prisma from '../db/db.config'
import { AuthenticatedRequest } from '../types/express'
import { ApiError, ok, validationError } from '../utils/http'

const approveSchema = z.object({
  approvalNote: z.string().optional()
})

const rejectSchema = z.object({
  rejectionNote: z.string().trim().min(1, 'Татгалзсан шалтгаанаа бичнэ үү')
})

// Never return password hashes when including related users
const nurseSelect = { select: { id: true, name: true, email: true } } as const

const VISIT_NOT_FOUND = () => new ApiError(404, 'VISIT_NOT_FOUND', 'Үзлэг олдсонгүй')

// GET /visits/review - list visits waiting approval
export const listVisitsWaitingApproval = async (req: AuthenticatedRequest, res: Response) => {
  const visits = await prisma.visit.findMany({
    where: { status: 'WAITING_APPROVAL' },
    include: {
      Parent: true,
      Nurse: nurseSelect,
      vitals: true
    },
    orderBy: { scheduledFor: 'asc' }
  })

  return ok(res, { visits }, 'Хянах үзлэгүүд')
}

// GET /visits/:id/review - get one visit for review
export const getVisitForReview = async (req: AuthenticatedRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({
    where: { id: req.params.id },
    include: {
      Parent: true,
      Nurse: nurseSelect,
      vitals: true
    }
  })

  if (!visit) throw VISIT_NOT_FOUND()

  return ok(res, { visit }, 'Үзлэг олдлоо')
}

// POST /visits/:id/approve - approve report
export const approveVisit = async (req: AuthenticatedRequest, res: Response) => {
  const visitId = req.params.id
  const parsed = approveSchema.safeParse(req.body ?? {})
  if (!parsed.success) throw validationError(parsed.error)

  const visit = await prisma.visit.findUnique({ where: { id: visitId } })
  if (!visit) throw VISIT_NOT_FOUND()

  if (visit.status !== 'WAITING_APPROVAL' && visit.status !== 'REVISION_REQUIRED') {
    throw new ApiError(409, 'INVALID_STATUS', `Үзлэгийн төлөв WAITING_APPROVAL эсвэл REVISION_REQUIRED байх ёстой. Одоогийн төлөв: ${visit.status}`)
  }

  const approved = await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: 'APPROVED',
      approvedById: req.user!.userId,
      approvalNote: parsed.data.approvalNote,
      approvedAt: new Date(),
      completedAt: new Date()
    },
    include: {
      vitals: true,
      Parent: true,
      ApprovedBy: { select: { id: true, name: true, email: true } }
    }
  })

  return ok(res, { visit: approved }, 'Үзлэг батлагдлаа')
}

// POST /visits/:id/reject - reject and ask for revision
export const rejectVisit = async (req: AuthenticatedRequest, res: Response) => {
  const visitId = req.params.id
  const parsed = rejectSchema.safeParse(req.body ?? {})
  if (!parsed.success) throw validationError(parsed.error)

  const visit = await prisma.visit.findUnique({ where: { id: visitId } })
  if (!visit) throw VISIT_NOT_FOUND()

  if (visit.status !== 'WAITING_APPROVAL') {
    throw new ApiError(409, 'INVALID_STATUS', `Татгалзахын тулд үзлэг WAITING_APPROVAL төлөвтэй байх ёстой. Одоогийн төлөв: ${visit.status}`)
  }

  const rejected = await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: 'REVISION_REQUIRED',
      rejectionNote: parsed.data.rejectionNote,
      approvedById: req.user!.userId,
      approvedAt: new Date()
    },
    include: {
      Parent: true,
      Nurse: nurseSelect,
      vitals: true
    }
  })

  return ok(res, { visit: rejected }, 'Үзлэг татгалзагдаж, засварт буцаагдлаа')
}
