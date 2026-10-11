import { Prisma, PrismaClient } from "@prisma/client";

// Query logging can expose patient data in query parameters, so it is never
// enabled in production and is opt-in (PRISMA_LOG_QUERIES=true) elsewhere.
function logLevels(): Prisma.LogLevel[] {
    if (process.env.NODE_ENV === 'production') return ["warn", "error"];
    return process.env.PRISMA_LOG_QUERIES === 'true'
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"];
}

const prisma = new PrismaClient({
    log: logLevels()
});

export default prisma;
