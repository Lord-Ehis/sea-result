import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Every serverless instance keeps its own pool, and Supabase's pooler allows
// only ~15 clients in total ("EMAXCONNSESSION: max clients reached"). node-pg's
// default of 10 per instance let two warm instances starve everyone else, so
// each instance is capped small: work simply queues briefly inside the
// instance instead of opening more connections. Idle connections are released
// quickly for the same reason, and a request that can't get one fails after
// 15 s rather than hanging.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
