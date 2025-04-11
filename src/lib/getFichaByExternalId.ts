// src/lib/getFichaProducto.ts

import { prisma } from "@/lib/db"; // o desde donde tengas configurado Prisma

export async function getFichaProducto(externalId: number) {
  if (!externalId) {
    throw new Error("externalId es requerido");
  }

  const ficha = await prisma.fichaProducto.findUnique({
    where: {
      productExternalId: externalId,
    },
  });

  return ficha;
}
