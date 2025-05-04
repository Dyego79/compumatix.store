import { defineAction } from "astro:actions";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { slugify } from "@/utils/slugify";


const categoriasExcluidas = [
  "hogar",
  "OUTLET",
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
  handler: async ({
    slug,
    page,
    limit,
    orden,
    query,
  }: {
    slug: string;
    page: number;
    limit: number;
    query: string;
    orden: string;
  }) => {
    // Buscar la categoría usando el slug generado dinámicamente desde el nombre
    const categories = await prisma.category.findMany();
    const category = categories.find((c) => slugify(c.name) === slug);

    if (!category) {
      throw new Error("Categoría no encontrada");
    }

    // Construcción del filtro
    const where: Prisma.ProductWhereInput = {
      AND: [
        { categoryId: category.id },
        { stock: { not: "Sin stock" } },
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

    // Construcción del ordenamiento
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

    // Consulta de productos y conteo total
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
          price: true,
          cotizacion: true,
          iva: true,
          proveedorIt: true,
          widthAverage: true,
          highAverage: true,
          weightAverage: true,
          lengthAverage: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Respuesta final
    return {
      products,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page,
      query,
      categoryName: category.name,
      categorySlug: slugify(category.name),
    };
  },
});
