import nodemailer from 'nodemailer'
import prisma from '../db/db.config'
import { logError } from './logger'

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})

export const sendVisitCompletionEmail = async (visitId: string) => {
    try {
        const visit = await prisma.visit.findUnique({
            where: { id: visitId },
            include: {
                Parent: {
                    include: {
                        children: true
                    }
                },
                vitals: true
            }
        })

        if (!visit) return

        const emailContent = `
            <h2>Health Visit Update for Your Parent</h2>
            <p>Hello,</p>
            <p>The nurse has completed the scheduled medical visit for <strong>${visit.Parent.name}</strong> on ${new Date(visit.completedAt!).toLocaleDateString()}.</p>
            
            ${visit.vitals ? `
            <h3>Vitals:</h3>
            <ul>
                ${visit.vitals.bp ? `<li>BP: ${visit.vitals.bp}</li>` : ''}
                ${visit.vitals.sugar ? `<li>Sugar: ${visit.vitals.sugar}</li>` : ''}
                ${visit.vitals.pulse ? `<li>Pulse: ${visit.vitals.pulse}</li>` : ''}
                ${visit.vitals.oxygen ? `<li>Oxygen Level: ${visit.vitals.oxygen}</li>` : ''}
                ${visit.vitals.temperature ? `<li>Temperature: ${visit.vitals.temperature}</li>` : ''}
            </ul>
            ` : ''}
            
            ${visit.vitals?.notes ? `<p><strong>Notes:</strong> "${visit.vitals.notes}"</p>` : ''}
            
            <p>You can log in to the app to view the full report.</p>
            <p>Regards,<br>Your Healthcare Team</p>
        `

        for (const child of visit.Parent.children) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: child.email,
                subject: `Health Visit Update for Your Parent`,
                html: emailContent
            })
        }
    } catch (error) {
        logError('sendVisitCompletionEmail', error)
    }
}