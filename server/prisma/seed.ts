import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const DEMO_PASSWORD = 'Demo123!'

const demoUsers: { name: string; email: string; role: Role }[] = [
    { name: 'Ramesh Kumar', email: 'child@demo.com', role: 'CHILD' },
    { name: 'Sita Nurse', email: 'nurse@demo.com', role: 'NURSE' },
    { name: 'Dr. Medical Admin', email: 'medadmin@demo.com', role: 'MEDICAL_ADMIN' },
    { name: 'Platform Admin', email: 'admin@demo.com', role: 'ADMIN' },
]

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)

async function main() {
    const password = await bcrypt.hash(DEMO_PASSWORD, 10)

    const users: Record<string, { id: string }> = {}
    for (const u of demoUsers) {
        users[u.role] = await prisma.user.upsert({
            where: { email: u.email },
            update: { name: u.name, role: u.role, password },
            create: { ...u, password },
        })
    }

    const child = users.CHILD
    const nurse = users.NURSE
    const medAdmin = users.MEDICAL_ADMIN

    // Only seed parents/visits once so user-created data isn't duplicated on re-runs
    const existingParents = await prisma.parent.count({
        where: { children: { some: { id: child.id } } },
    })
    if (existingParents > 0) {
        console.log('Demo users refreshed; demo parents/visits already exist.')
        return
    }

    const anita = await prisma.parent.create({
        data: {
            name: 'Anita Sharma',
            age: 78,
            gender: 'Female',
            address: 'Lalitpur, Ward-5, near Sunrise Apartments',
            diseases: 'Hypertension, Type 2 Diabetes',
            medications: 'Metformin 500mg, Amlodipine 5mg',
            emergencyContact: '9800000001',
            children: { connect: { id: child.id } },
        },
    })

    const hari = await prisma.parent.create({
        data: {
            name: 'Hari Sharma',
            age: 82,
            gender: 'Male',
            address: 'Lalitpur, Ward-5, near Sunrise Apartments',
            diseases: 'Arthritis',
            medications: 'Paracetamol as needed',
            emergencyContact: '9800000002',
            children: { connect: { id: child.id } },
        },
    })

    // Visits in every interesting state so each role has something to see
    await prisma.visit.create({
        data: { parentId: anita.id, scheduledFor: daysFromNow(2), visitType: 'FULL', status: 'PENDING' },
    })
    await prisma.visit.create({
        data: { parentId: hari.id, scheduledFor: daysFromNow(1), visitType: 'BASIC', status: 'ASSIGNED', nurseId: nurse.id },
    })
    await prisma.visit.create({
        data: { parentId: anita.id, scheduledFor: daysFromNow(0), visitType: 'FULL', status: 'STARTED', nurseId: nurse.id },
    })
    await prisma.visit.create({
        data: {
            parentId: hari.id,
            scheduledFor: daysFromNow(-1),
            visitType: 'FULL',
            status: 'WAITING_APPROVAL',
            nurseId: nurse.id,
            notes: 'Mild joint pain, otherwise stable.',
            vitals: {
                create: { bp: '135/85', sugar: '110', pulse: '76', oxygen: '97', temperature: '98.4', notes: 'Mild joint pain', medicines: 'Paracetamol' },
            },
        },
    })

    // History: COMPLETED visits feed analytics trends, APPROVED ones show in the child's reports
    const history = [
        { days: -21, status: 'COMPLETED', bp: '128/82', sugar: '140', pulse: '74', oxygen: '97', temperature: '98.6' },
        { days: -14, status: 'COMPLETED', bp: '124/80', sugar: '132', pulse: '72', oxygen: '98', temperature: '98.4' },
        { days: -7, status: 'APPROVED', bp: '120/78', sugar: '125', pulse: '72', oxygen: '98', temperature: '98.2' },
    ] as const
    for (const h of history) {
        const date = daysFromNow(h.days)
        await prisma.visit.create({
            data: {
                parentId: anita.id,
                scheduledFor: date,
                visitType: 'FULL',
                status: h.status,
                nurseId: nurse.id,
                approvedById: medAdmin.id,
                approvalNote: 'Vitals within acceptable range.',
                approvedAt: date,
                completedAt: date,
                vitals: {
                    create: {
                        bp: h.bp, sugar: h.sugar, pulse: h.pulse, oxygen: h.oxygen, temperature: h.temperature,
                        notes: 'Routine check', medicines: 'Metformin, Amlodipine', createdAt: date,
                    },
                },
            },
        })
    }

    console.log('Demo data seeded.')
}

main()
    .then(() => {
        console.log(`Demo logins (password: ${DEMO_PASSWORD}): ${demoUsers.map((u) => u.email).join(', ')}`)
    })
    .catch((e) => {
        console.error(e)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
