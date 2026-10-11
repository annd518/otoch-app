import express, { Request, Response } from "express"
import cors from "cors"
import fileupload from "express-fileupload"
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/users'
import parentRoutes from './routes/parents.routes'
import visitRoutes from './routes/visits.routes'
import nursesRoutes from './routes/nurses.routes'
import analyticsRoutes from './routes/analytics.routes'
import reviewRoutes from './routes/review.routes'

import swaggerUi from 'swagger-ui-express'
import { specs } from './config/swagger'

// Load environment variables
dotenv.config()



// Add after other middleware

const app = express()
const PORT = process.env.PORT || 8000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(fileupload())
app.use(cors({
    // In development reflect any origin (web client, Expo web, LAN devices)
    origin: process.env.NODE_ENV === 'production' ? 'your-frontend-url' : true,
    credentials: true
}))

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


// Bind to all interfaces so devices on the LAN (Expo Go) can reach the API
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(` Server running on http://localhost:${PORT}`)
})
