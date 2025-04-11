// src/lib/getProductBySlug.ts

import { prisma } from "@/lib/db";

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      category: true,
    },
  });
}
