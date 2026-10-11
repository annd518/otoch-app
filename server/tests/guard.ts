// Must be imported before anything that creates a Prisma client.
// Refuses to run unless started by scripts/test-isolated.mjs (throwaway DB).
if (process.env.OTOCH_TEST_ISOLATED !== '1' || !/\/otoch_test\?/.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run tests outside the isolated test database. Use `npm test`.')
}

export {}
