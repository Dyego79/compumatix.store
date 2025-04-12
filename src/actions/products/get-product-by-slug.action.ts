import { defineAction } from "astro:actions";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const getProductBySlug = defineAction({
  accept: "json",
  input: z.string(),
  handler: async (slug: string) => {
    const product = await prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        sku: true,
        mainImage: true,
        finalPrice: true,
        externalId: true,
        cotizacion: true,
        warranty: true,
        stock: true,
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error(`Product with slug "${slug}" not found`);
    }

    return {
      product,
    };
  },
});
