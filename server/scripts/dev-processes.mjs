// Process helpers for scripts/dev-local.mjs (local development only).
//
// On Windows, stopping dev:local with Ctrl+C stopped PostgreSQL but could leave the
// API chain (npx -> nodemon -> tsx -> node) running: it kept port 8000 and the
// phone kept talking to old code. These helpers stop that chain on exit and clean
// up a leftover from a previous run on start.
import { execFileSync } from 'node:child_process'

const isWin = process.platform === 'win32'

/** Kill a process and all its descendants (Windows: taskkill /T). Best effort. */
export function stopProcessTree(pid) {
    if (!pid) return
    try {
        if (isWin) execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
        else process.kill(pid, 'SIGTERM')
    } catch {
        // already gone
    }
}

/**
 * Who listens on `port`: [{ pid, commandLine }]. Windows only (returns [] elsewhere).
 */
export function listeners(port) {
    if (!isWin) return []
    const ps =
        `Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | ` +
        'Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { ' +
        '$p = Get-CimInstance Win32_Process -Filter "ProcessId=$_"; "$($p.ProcessId)`t$($p.CommandLine)" }'
    try {
        const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' })
        return out
            .split(/\r?\n/)
            .filter((l) => l.trim())
            .map((l) => {
                const [pid, ...rest] = l.split('\t')
                return { pid: Number(pid), commandLine: rest.join('\t') }
            })
            .filter((l) => Number.isInteger(l.pid) && l.pid > 0)
    } catch {
        return []
    }
}

/** True only for this server folder's own API process (tsx running src/index.ts). */
export function isOwnApiProcess(commandLine, serverRoot) {
    const cmd = (commandLine || '').toLowerCase().replace(/\//g, '\\')
    const rootDir = serverRoot.toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '')
    return cmd.includes(rootDir + '\\') && /src\\index\.ts/.test(cmd)
}

/**
 * Before starting the API: stop a leftover API from a previous dev:local of THIS
 * server folder that still holds the port. Anything else on the port is left alone.
 * Returns { stopped: number[], foreign: number[] }.
 */
export function stopLeftoverApi(port, serverRoot, log = console.log) {
    const stopped = []
    const foreign = []
    for (const l of listeners(port)) {
        if (isOwnApiProcess(l.commandLine, serverRoot)) {
            stopProcessTree(l.pid)
            stopped.push(l.pid)
            log(`Stopped a leftover API server from a previous run (pid ${l.pid}) that still held port ${port}.`)
        } else {
            foreign.push(l.pid)
            log(`Port ${port} is used by another program (pid ${l.pid}); not touching it. Free the port or set PORT.`)
        }
    }
    return { stopped, foreign }
}
