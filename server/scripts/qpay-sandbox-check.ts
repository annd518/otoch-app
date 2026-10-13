// QPay SANDBOX connectivity check through the app's own adapter (src/services/qpay.ts).
// Never prints credentials. Refuses anything but QPAY_MODE=sandbox and a sandbox host.
//
//   npx tsx scripts/qpay-sandbox-check.ts               # auth + create a 100 MNT test invoice + check
//   npx tsx scripts/qpay-sandbox-check.ts --check <id>  # re-check an invoice later (e.g. after a sandbox payment)
//
// Needs QPAY_MODE=sandbox, QPAY_BASE_URL, QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE
// (from server/.env or the shell). The callback URL points to PUBLIC_BASE_URL when it is an
// https URL; otherwise a non-routable placeholder is used and no callback can arrive.
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { QPayConfigError, QPayProviderError, getQPayAdapter } from '../src/services/qpay'

async function main() {
    if (process.env.QPAY_MODE !== 'sandbox') throw new Error('Set QPAY_MODE=sandbox (this script never talks to production)')
    const base = process.env.QPAY_BASE_URL ?? ''
    if (!/^https:\/\/merchant-sandbox\.qpay\.mn\/?$/.test(base)) {
        throw new Error('QPAY_BASE_URL must be https://merchant-sandbox.qpay.mn for this check')
    }
    const adapter = getQPayAdapter()

    const checkIdx = process.argv.indexOf('--check')
    if (checkIdx > 0) {
        const id = process.argv[checkIdx + 1]
        if (!id) throw new Error('--check needs an invoice id')
        const check = await adapter.checkInvoice(id)
        console.log(JSON.stringify({ step: 'check', invoiceId: id, ...check }))
        return
    }

    const amountMnt = 100
    const senderInvoiceNo = `SANDBOX-CHECK-${randomUUID().slice(0, 8)}`
    const publicBase = process.env.PUBLIC_BASE_URL?.startsWith('https://') ? process.env.PUBLIC_BASE_URL : 'https://callback.invalid'
    const invoice = await adapter.createInvoice({
        senderInvoiceNo,
        amountMnt,
        description: 'OTOCH sandbox connectivity check (not a real payment)',
        // the secret path segment is replaced so it never appears in output or QPay dashboards
        callbackUrl: `${publicBase}/api/payments/qpay/callback/sandbox-check?paymentId=${senderInvoiceNo}`,
    })
    console.log(JSON.stringify({
        step: 'createInvoice',
        ok: true,
        senderInvoiceNo,
        invoiceId: invoice.invoiceId,
        amountMnt,
        hasQrText: invoice.qrText.length > 0,
        hasQrImage: Boolean(invoice.qrImage),
        deeplinks: invoice.deeplinks.map((d) => d.name),
    }))
    const check = await adapter.checkInvoice(invoice.invoiceId)
    console.log(JSON.stringify({ step: 'check', invoiceId: invoice.invoiceId, ...check }))
    console.log(`Re-check later: npx tsx scripts/qpay-sandbox-check.ts --check ${invoice.invoiceId}`)
}

main().catch((err) => {
    const kind = err instanceof QPayConfigError ? 'config' : err instanceof QPayProviderError ? (err.definite ? 'provider-rejected' : 'provider-unconfirmed') : 'error'
    console.error(JSON.stringify({ ok: false, kind, message: err instanceof Error ? err.message : String(err) }))
    process.exit(1)
})
