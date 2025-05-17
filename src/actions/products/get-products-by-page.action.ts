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
    const categoriasExcluidas = ["outlet", "hogar"];

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

    const where: Prisma.ProductWhereInput = {
      AND: [
        {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
          ],
        },
        {
          stock: {
            not: "Sin stock",
          },
        },
        {
          deleted: false, // 👈 productos no soft-deleteados
        },
        {
          NOT: [
            {
              category: {
                is: {
                  name: {
                    equals: "outlet",
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              category: {
                is: {
                  name: {
                    equals: "hogar",
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
      ],
    };

    const [totalRecords, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
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
          proveedorIt: true,
          stock: true,
          widthAverage: true,
          highAverage: true,
          weightAverage: true,
          lengthAverage: true,
          iva: true,
          deleted: true,
          brand: {
            select: { id: true, name: true },
          },
          category: {
            select: { id: true, name: true },
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
