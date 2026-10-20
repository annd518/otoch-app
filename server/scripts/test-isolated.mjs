// Runs the API test suite against a throwaway PostgreSQL instance:
//   temp dir + random port -> prisma migrate deploy -> node:test -> stop + delete.
// It never connects to the dev database (.local-pg / port 5544) or any DATABASE_URL from .env.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const freePort = () =>
    new Promise((resolve, reject) => {
        const srv = net.createServer()
        srv.on('error', reject)
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address()
            srv.close(() => resolve(port))
        })
    })

const dataDir = mkdtempSync(path.join(tmpdir(), 'otoch-test-pg-'))
const port = await freePort()
const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'otoch_test',
    password: 'otoch_test',
    port,
    persistent: false,
    // Windows defaults to WIN1252, which cannot store Cyrillic (Mongolian) text
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
})

const env = {
    ...process.env,
    NODE_ENV: 'test',
    OTOCH_TEST_ISOLATED: '1',
    DATABASE_URL: `postgresql://otoch_test:otoch_test@127.0.0.1:${port}/otoch_test?schema=public`,
    JWT_SECRET: randomBytes(32).toString('hex'),
    JWT_EXPIRES_IN: '1h',
    EMAIL_USER: '',
    STORAGE_DRIVER: 'memory',
    QPAY_MODE: 'mock',
    QPAY_CALLBACK_SECRET: randomBytes(16).toString('hex'),
    EMAIL_PASS: '',
}

const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: true }).status ?? 1

let exitCode = 1
try {
    console.log(`[test] isolated PostgreSQL on 127.0.0.1:${port} (temp dir, deleted afterwards)`)
    await pg.initialise()
    await pg.start()
    await pg.createDatabase('otoch_test')

    // Applies the committed migrations — this also verifies the migration SQL
    if (run('npx', ['prisma', 'migrate', 'deploy']) !== 0) throw new Error('prisma migrate deploy failed')

    // Optional: `npm test -- <file.test.ts> ...` runs only the given files
    const requested = process.argv.slice(2)
    const testFiles = requested.length
        ? requested
        : readdirSync(path.join(root, 'tests'))
            // Cross-app journey has its own complete fixture catalog and must use a fresh DB.
            .filter((f) => f.endsWith('.test.ts') && f !== 'app-link.test.ts')
            .map((f) => path.join('tests', f))
    exitCode = run('node', ['--import', 'tsx', '--test', '--test-concurrency=1', ...testFiles])
} catch (err) {
    console.error('[test] setup failed:', err instanceof Error ? err.message : err)
} finally {
    await pg.stop().catch(() => {})
    rmSync(dataDir, { recursive: true, force: true })
}
process.exit(exitCode)
