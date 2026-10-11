import express, { Request, Response } from "express"
import cors from "cors"
import fileupload from "express-fileupload"
import cookieParser from 'cookie-parser'
import swaggerUi from 'swagger-ui-express'
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/users'
import parentRoutes from './routes/parents.routes'
import visitRoutes from './routes/visits.routes'
import nursesRoutes from './routes/nurses.routes'
import analyticsRoutes from './routes/analytics.routes'
import reviewRoutes from './routes/review.routes'
import catalogRoutes from './routes/catalog.routes'
import orderRoutes from './routes/orders.routes'
import paymentRoutes from './routes/payments.routes'
import { specs } from './config/swagger'
import { errorHandler, notFoundHandler } from './middlwares/error'

// Comma-separated allowlist for production, e.g. "https://admin.example.mn"
function corsOrigin(): cors.CorsOptions['origin'] {
    if (process.env.NODE_ENV !== 'production') return true // web client, Expo web, LAN devices
    const allowed = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
    return allowed.length ? allowed : false
}

export function createApp() {
    const app = express()

    if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY)

    // Middleware
    app.use(express.json({ limit: '1mb' }))
    app.use(express.urlencoded({ extended: true, limit: '1mb' }))
    app.use(cookieParser())
    // Over-limit files are flagged `truncated` (handled as 413 FILE_TOO_LARGE in the controller);
    // abortOnLimit is off because it answers with plain text outside the error contract.
    app.use(fileupload({ limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
    app.use(cors({ origin: corsOrigin(), credentials: true }))

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))

    // Static files
    app.use("/uploads/images", express.static("src/uploads/images"))
    app.use("/uploads/coverimgs", express.static("src/uploads/coverimgs"))

    // Basic routes
    app.get("/", (req: Request, res: Response) => {
        res.json({
            message: "Team-ALPHA Backend API",
            status: "running",
            timestamp: new Date().toISOString()
        })
    })

    app.get("/api/health", (req: Request, res: Response) => {
        res.status(200).json({
            message: "API is healthy",
            status: "success"
        })
    })

    // API Routes
    app.use('/api/auth', authRoutes)
    app.use('/api/users', userRoutes)
    app.use('/api/parents', parentRoutes)
    app.use('/api/visits', visitRoutes)
    app.use('/api/nurses', nursesRoutes)
    app.use('/api/analytics', analyticsRoutes)
    app.use('/api/review', reviewRoutes)
    app.use('/api/catalog', catalogRoutes)
    app.use('/api/orders', orderRoutes)
    app.use('/api', paymentRoutes)

    app.use('/api', notFoundHandler)
    app.use(errorHandler)

    return app
}
