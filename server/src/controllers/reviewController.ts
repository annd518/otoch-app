import { Response } from 'express'
import { z } from 'zod'
import prisma from '../db/db.config'
import { AuthenticatedRequest } from '../types/express'

const approveSchema = z.object({
  approvalNote: z.string().optional()
})

const rejectSchema = z.object({
  rejectionNote: z.string().min(1, 'Rejection note is required')
})

// GET /visits/review - list visits waiting approval
export const listVisitsWaitingApproval = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const visits = await prisma.visit.findMany({
      where: { status: 'WAITING_APPROVAL' },
      include: {
        Parent: true,
        Nurse: { select: { id: true, name: true, email: true } },
        vitals: true
      },
      orderBy: { scheduledFor: 'asc' }
    })

    return res.status(200).json({
      success: true,
      message: 'Хянах үзлэгүүд',
      data: { visits }
    })
  } catch (error: any) {
    console.error(error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Үзлэгийн жагсаалтыг авч чадсангүй'
    })
  }
}

// GET /visits/:id/review - get one visit for review
export const getVisitForReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const visitId = req.params.id
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        Parent: true,
        Nurse: { select: { id: true, name: true, email: true } },
        vitals: true
      }
    })

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Үзлэг олдсонгүй'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Үзлэг олдлоо',
      data: { visit }
    })
  } catch (error: any) {
    console.error(error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Үзлэгийн мэдээллийг авч чадсангүй'
    })
  }
}

// POST /visits/:id/approve - approve report
export const approveVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const visitId = req.params.id
    const validatedData = approveSchema.safeParse(req.body)
    
    if (!validatedData.success) {
      return res.status(400).json({
        success: false,
        message: 'Өгөгдөл буруу байна',
        errors: validatedData.error.format()
      })
    }

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { vitals: true, Parent: true }
    })

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Үзлэг олдсонгүй'
      })
    }

    if (visit.status !== 'WAITING_APPROVAL' && visit.status !== 'REVISION_REQUIRED') {
      return res.status(400).json({
        success: false,
        message: `Үзлэгийн төлөв WAITING_APPROVAL эсвэл REVISION_REQUIRED байх ёстой. Одоогийн төлөв: ${visit.status}`
      })
    }

    const approved = await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'APPROVED',
        approvedById: req.user!.userId,
        approvalNote: validatedData.data.approvalNote,
        approvedAt: new Date(),
        completedAt: new Date()
      },
      include: {
        vitals: true,
        Parent: true,
        ApprovedBy: { select: { id: true, name: true, email: true } }
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Үзлэг батлагдлаа',
      data: { visit: approved }
    })
  } catch (error: any) {
    console.error(error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Үзлэгийг баталж чадсангүй'
    })
  }
}

// POST /visits/:id/reject - reject and ask for revision
export const rejectVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const visitId = req.params.id
    const validatedData = rejectSchema.safeParse(req.body)
    
    if (!validatedData.success) {
      return res.status(400).json({
        success: false,
        message: 'Татгалзсан шалтгаанаа бичнэ үү',
        errors: validatedData.error.format()
      })
    }

    const visit = await prisma.visit.findUnique({ where: { id: visitId } })
    
    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Үзлэг олдсонгүй'
      })
    }

    if (visit.status !== 'WAITING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: `Татгалзахын тулд үзлэг WAITING_APPROVAL төлөвтэй байх ёстой. Одоогийн төлөв: ${visit.status}`
      })
    }

    const rejected = await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'REVISION_REQUIRED',
        rejectionNote: validatedData.data.rejectionNote,
        approvedById: req.user!.userId,
        approvedAt: new Date()
      },
      include: {
        Parent: true,
        Nurse: true,
        vitals: true
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Үзлэг татгалзагдаж, засварт буцаагдлаа',
      data: { visit: rejected }
    })
  } catch (error: any) {
    console.error(error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Үзлэгийг татгалзаж чадсангүй'
    })
  }
}