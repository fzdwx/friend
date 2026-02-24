import { PrismaClient } from "./generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

// Lazy proxy: create client on first access
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createClient();
    }
    return Reflect.get(globalForPrisma.prisma, prop, receiver);
  },
});

export { Prisma } from "./generated/prisma/client";
export type * from "./generated/prisma/client";
