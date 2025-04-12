import { defineAction } from "astro:actions";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const getProductsByPage = defineAction({
  accept: "json",
  input: z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(12),
    query: z.string().optional().default(""),
  }),
  handler: async ({
    page,
    limit,
    query,
  }: {
    page: number;
    limit: number;
    query: string;
  }) => {
    page = page <= 0 ? 1 : page;

    const where = {
      OR: [
        { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { sku: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    };

    const [totalRecords, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { title: "asc" },
        select: {
          id: true,
          title: true,
          slug: true,
          sku: true,
          mainImage: true,
          price: true,
          finalPrice: true,
          externalId: true,
          cotizacion: true,
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
      }),
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      products: page > totalPages ? [] : products,
      totalPages,
    };
  },
});
