import { defineAction } from "astro:actions";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const getProductsByPage = defineAction({
  accept: "json",
  input: z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(12),
    query: z.string().optional().default(""), // <- agregamos esto
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

    const totalRecords = await prisma.product.count({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
        ],
      },
    });
    const totalPages = Math.ceil(totalRecords / limit);

    if (page > totalPages) {
      return {
        products: [],
        totalPages,
      };
    }

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
        ],
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { title: "asc" },
      include: {
        brand: true,
        category: true,
      },
    });

    return {
      products,
      totalPages,
    };
  },
});
