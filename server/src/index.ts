// Load environment variables before any other module reads process.env
import 'dotenv/config'
import { createApp } from './app'

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Refusing to start.')
    process.exit(1)
}

const PORT = process.env.PORT || 8000
const app = createApp()

// Bind to all interfaces so devices on the LAN (Expo Go) can reach the API
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(` Server running on http://localhost:${PORT}`)
})
