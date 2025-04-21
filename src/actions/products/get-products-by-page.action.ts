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
    orden: z.string().optional().default("alfabetico_asc"),
  }),

  handler: async ({
    page,
    limit,
    query,
    orden,
  }: {
    page: number;
    limit: number;
    query: string;
    orden: string;
  }) => {
    page = page <= 0 ? 1 : page;
    let orderBy: Prisma.ProductOrderByWithRelationInput = { title: "asc" };

    switch (orden) {
      case "precio_asc":
        orderBy = { finalPrice: "asc" };
        break;
      case "precio_desc":
        orderBy = { finalPrice: "desc" };
        break;
      case "alfabetico_desc":
        orderBy = { title: "desc" };
        break;
      case "alfabetico_asc":
      default:
        orderBy = { title: "asc" };
        break;
    }

    /* const where = {
      OR: [
        { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { sku: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    }; */

    const where = {
      AND: [
        {
          OR: [
            { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { sku: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        },
        {
          stock: {
            not: "Sin stock",
          },
        },
      ],
    };

    const [totalRecords, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy, // 👈 esta es la que definiste arriba con el switch
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
          stock: true,
          widthAverage: true,
          highAverage: true,
          weightAverage: true,
          lengthAverage: true,
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
