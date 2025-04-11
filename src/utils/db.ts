import { PrismaClient } from "@prisma/client";

// Evitás múltiples instancias en desarrollo (por Hot Reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"], // Podés sacar esto si no querés ver logs
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
