import { defineAction } from "astro:actions";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const categoriasExcluidas = [
  "hogar",
  "outlet",
  "CONTADORAS Y CLASIFICADORAS DE BILLETES",
];

export const getProductsByCategorySlug = defineAction({
  accept: "json",
  input: z.object({
    slug: z.string(),
    page: z.number().default(1),
    limit: z.number().default(24),
    orden: z.string().default("alfabetico_asc"),
    query: z.string().optional().default(""),
  }),

  handler: async ({ slug, page, limit, orden, query }) => {
    console.log("🪵 Slug recibido en action:", slug);

    try {
      const category = await prisma.category.findFirst({
        where: {
          slug: slug || "", // fallback defensivo
        },
      });

      if (!category) {
        console.error("❌ No se encontró la categoría con slug:", slug);
        throw new Error("Categoría no encontrada");
      }

      const where: Prisma.ProductWhereInput = {
        AND: [
          { categoryId: category.id },
          { deleted: false },
          {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
            ],
          },
          {
            NOT: categoriasExcluidas.map((cat) => ({
              category: {
                is: {
                  name: {
                    equals: cat,
                    mode: "insensitive",
                  },
                },
              },
            })),
          },
        ],
      };

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
      }

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
            mainImage: true,
            finalPrice: true,
            stock: true,
            amountStock: true,
            price: true,
            cotizacion: true,
            iva: true,
            proveedorIt: true,
            widthAverage: true,
            highAverage: true,
            weightAverage: true,
            lengthAverage: true,
            externalId: true,
            deleted: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
      ]);

      return {
        products,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        query,
        categoryName: category.name,
        categorySlug: category.slug,
      };
    } catch (err) {
      console.error("❌ Error en getProductsByCategorySlug:", err);
      throw new Error("Error al cargar productos de la categoría");
    }
  },
});

