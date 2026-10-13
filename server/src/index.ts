// Load environment variables before any other module reads process.env
import 'dotenv/config'
import { createApp } from './app'

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Refusing to start.')
    process.exit(1)
}

const PORT = process.env.PORT || 8000
const app = createApp()

// Bind to all interfaces so devices on the LAN (Expo Go) can reach the API.
// Express 5 passes a listen failure to this callback; without the check a busy
// port printed "Server running" and the process quietly exited (nodemon "clean exit").
app.listen(Number(PORT), '0.0.0.0', (err?: NodeJS.ErrnoException) => {
    if (err) {
        console.error(
            err.code === 'EADDRINUSE'
                ? `Port ${PORT} is already in use: an older API server is probably still running. ` +
                      'Stop it (Ctrl+C in its window, or end the old node process) and start again.'
                : `API server failed to start: ${err.message}`,
        )
        process.exit(1)
    }
    console.log(` Server running on http://localhost:${PORT}`)
})
