// Private bucket probe, run INSIDE the deployed API container (e.g. Render Shell),
// using the app's own storage adapter and credentials. Never prints secrets.
//
//   node scripts/storage-probe.cjs put            -> writes _probe/<id>.txt, prints the key
//   node scripts/storage-probe.cjs get <key>      -> reads it back (run again after a restart/redeploy)
//   node scripts/storage-probe.cjs delete <key>
//
// `put` also checks the bucket is NOT public: an unauthenticated GET of the object must fail.
const { randomUUID } = require('node:crypto')
const { getStorage } = require('../dist/services/storage')

const PROBE = Buffer.from('otoch storage probe (synthetic, safe to delete)\n')

async function main() {
    const [cmd, key] = process.argv.slice(2)
    const storage = getStorage()
    if (!storage) throw new Error('no storage configured (STORAGE_DRIVER / S3_* env)')
    if (cmd === 'put') {
        const k = `_probe/${randomUUID()}.txt`
        await storage.put(k, PROBE)
        const back = await storage.get(k)
        if (!back || !back.equals(PROBE)) throw new Error('read-after-write mismatch')
        const endpoint = (process.env.S3_ENDPOINT || '').replace(/\/+$/, '')
        let publicStatus = 'skipped (no S3_ENDPOINT)'
        if (endpoint && process.env.S3_BUCKET) {
            const res = await fetch(`${endpoint}/${process.env.S3_BUCKET}/${k}`, { signal: AbortSignal.timeout(10000) })
            publicStatus = res.status
            if (res.ok) throw new Error(`bucket is PUBLIC: unauthenticated GET returned ${res.status}`)
        }
        console.log(JSON.stringify({ ok: true, step: 'put', driver: storage.driver, key: k, unauthenticatedGet: publicStatus }))
        console.log(`After a restart/redeploy: node scripts/storage-probe.cjs get ${k}`)
    } else if (cmd === 'get' && key) {
        const back = await storage.get(key)
        console.log(JSON.stringify({ ok: Boolean(back && back.equals(PROBE)), step: 'get', key }))
        if (!back) process.exitCode = 1
    } else if (cmd === 'delete' && key) {
        await storage.remove(key)
        console.log(JSON.stringify({ ok: true, step: 'delete', key }))
    } else {
        throw new Error('usage: put | get <key> | delete <key>')
    }
}

main().catch((err) => {
    console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }))
    process.exit(1)
})
