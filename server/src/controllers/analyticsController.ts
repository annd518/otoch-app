import { Request, Response } from 'express'
import prisma from '../db/db.config'
import { ApiError, ok } from '../utils/http'

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string
        email: string
        role: string
    }
}

export const getParentTrends = async (req: AuthenticatedRequest, res: Response) => {
    const parentId = req.params.id
    const period = req.query.period as string || 'weekly'

    const parent = await prisma.parent.findFirst({
        where: {
            id: parentId,
            children: {
                some: { id: req.user!.userId }
            }
        }
    })

    if (!parent) throw new ApiError(404, 'PARENT_NOT_FOUND', 'Эцэг/эх олдсонгүй эсвэл хандах эрхгүй')

    const visits = await prisma.visit.findMany({
        where: {
            parentId,
            status: 'COMPLETED',
            vitals: { isNot: null }
        },
        include: { vitals: true },
        orderBy: { completedAt: 'asc' }
    })

    const trends = aggregateVitals(visits, period)

    return ok(res, { parentId, period, vitalsTrend: trends }, 'Эрүүл мэндийн хандлагыг амжилттай авлаа')
}

function aggregateVitals(visits: any[], period: string) {
    const groups = new Map()

    visits.forEach(visit => {
        if (!visit.completedAt || !visit.vitals) return

        const date = new Date(visit.completedAt)
        let key: string

        if (period === 'monthly') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
        } else {
            const startOfWeek = new Date(date)
            const day = startOfWeek.getDay()
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
            startOfWeek.setDate(diff)
            key = startOfWeek.toISOString().split('T')[0]
        }

        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(visit.vitals)
    })

    return Array.from(groups.entries()).map(([key, vitals]) => {
        const result: any = { [period === 'monthly' ? 'monthStart' : 'weekStart']: key }

        const bps = vitals.filter((v: any) => v.bp).map((v: any) => v.bp)
        if (bps.length > 0) result.bp = bps[bps.length - 1]

        const fields = ['sugar', 'pulse', 'oxygen', 'temperature']
        fields.forEach((field: string) => {
            const filteredVitals = vitals.filter((v: any) => v[field])
            const parsedValues = filteredVitals.map((v: any) => parseFloat(v[field]))
            const values = parsedValues.filter((v: number) => !isNaN(v))
            if (values.length > 0) {
                const sum = values.reduce((acc: number, val: number) => acc + val, 0)
                const average = sum / values.length
                result[field] = Math.round(average * 10) / 10
            }
        })

        return result
    }).sort((a, b) => {
        const dateA = period === 'monthly' ? a.monthStart : a.weekStart
        const dateB = period === 'monthly' ? b.monthStart : b.weekStart
        return dateA.localeCompare(dateB)
    })
}