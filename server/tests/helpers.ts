import './guard'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createApp } from '../src/app'
import prisma from '../src/db/db.config'

export { prisma }

export interface TestServer {
    baseUrl: string
    close: () => Promise<void>
}

export async function startServer(): Promise<TestServer> {
    const server: Server = await new Promise((resolve) => {
        const s = createApp().listen(0, '127.0.0.1', () => resolve(s))
    })
    const { port } = server.address() as AddressInfo
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((resolve) => server.close(() => resolve())),
    }
}

export interface ApiResult {
    status: number
    json: any
}

export async function api(
    baseUrl: string,
    method: string,
    path: string,
    opts: { body?: unknown; rawBody?: string; token?: string } = {}
): Promise<ApiResult> {
    const headers: Record<string, string> = {}
    if (opts.body !== undefined || opts.rawBody !== undefined) headers['Content-Type'] = 'application/json'
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`
    const res = await fetch(baseUrl + path, {
        method,
        headers,
        body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    })
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
}

/** Fictional, unique, non-routable email (.invalid TLD) */
export const uniqueEmail = (tag: string) => `${tag}-${randomBytes(4).toString('hex')}@example.invalid`

export const TEST_PASSWORD = 'Test-Only-123'

/** Creates a user directly in the isolated DB (used for privileged roles). An ADMIN is a super-admin unless told otherwise. */
export async function createUser(
    role: 'CHILD' | 'NURSE' | 'MEDICAL_ADMIN' | 'ADMIN',
    tag = role.toLowerCase(),
    adminRole: 'SUPER_ADMIN' | 'OPS' | 'FINANCE' | 'SUPPORT' = 'SUPER_ADMIN',
) {
    return prisma.user.create({
        data: {
            name: `Туршилтын ${tag}`,
            email: uniqueEmail(tag),
            password: await bcrypt.hash(TEST_PASSWORD, 4),
            role,
            adminRole: role === 'ADMIN' ? adminRole : null,
        },
    })
}

export async function loginAs(baseUrl: string, email: string, password = TEST_PASSWORD): Promise<string> {
    const res = await api(baseUrl, 'POST', '/api/auth/login', { body: { email, password } })
    if (res.status !== 200) throw new Error(`login failed: ${res.status}`)
    return res.json.data.token
}

/** Asserts the unified error contract and returns error.code */
export function errorCode(res: ApiResult): string {
    if (res.json?.success !== false || typeof res.json?.message !== 'string' || typeof res.json?.error?.code !== 'string') {
        throw new Error(`not an error-contract response: ${res.status} ${JSON.stringify(res.json)}`)
    }
    return res.json.error.code
}

export const decodeJwtPayload = (token: string) =>
    JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
