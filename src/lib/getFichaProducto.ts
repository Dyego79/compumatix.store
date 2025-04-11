// src/lib/getFichaProducto.ts

import { prisma } from "@/lib/db";

export async function getFichaProducto(externalId: number) {
  return prisma.fichaProducto.findUnique({
    where: { productExternalId: externalId },
  });
}
