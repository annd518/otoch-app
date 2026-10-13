// One-command local dev: embedded PostgreSQL -> prisma db push -> seed -> API (nodemon).
// No Docker or system Postgres required. Data persists in server/.local-pg.
// Pass --external-db to skip the embedded database (e.g. when using docker-compose).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import { stopLeftoverApi, stopProcessTree } from './dev-processes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dbUrl = new URL(process.env.DATABASE_URL)
const dbName = dbUrl.pathname.replace(/^\//, '')

const run = (cmd, args) =>
    new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: true })
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))))
    })

let pg
if (!process.argv.includes('--external-db')) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres')
    const databaseDir = path.join(root, '.local-pg')
    pg = new EmbeddedPostgres({
        databaseDir,
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        port: Number(dbUrl.port || 5432),
        persistent: true,
        // Windows defaults to WIN1252, which cannot store Cyrillic (Mongolian) text
        initdbFlags: ['--encoding=UTF8', '--locale=C'],
    })
    if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
        console.log('Initialising embedded PostgreSQL...')
        await pg.initialise()
    }
    await pg.start()
    try {
        await pg.createDatabase(dbName)
    } catch {
        // database already exists
    }
    console.log(`Embedded PostgreSQL running on port ${dbUrl.port}`)
}

let api
let stopping = false
const shutdown = async () => {
    if (stopping) return
    stopping = true
    // The API chain (npx -> nodemon -> tsx -> node) is not stopped by our exit on
    // Windows; without this a leftover kept port 8000 and served old code.
    if (api) stopProcessTree(api.pid)
    if (pg) await pg.stop().catch(() => {})
    process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

try {
    await run('npx', ['prisma', 'db', 'push'])
    await run('npx', ['tsx', 'prisma/seed.ts'])
} catch (e) {
    console.error(e.message)
    await shutdown()
}

const port = process.env.PORT || 8000
const lanIps = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
console.log(`\nAPI will be reachable at http://localhost:${port}`)
for (const ip of lanIps) console.log(`  from your phone: http://${ip}:${port}`)

// A leftover API of THIS server folder from an earlier run would hold the port
stopLeftoverApi(port, root)

api = spawn('npx', ['nodemon'], { cwd: root, stdio: 'inherit', shell: true })
api.on('exit', shutdown)
