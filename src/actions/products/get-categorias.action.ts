import { defineAction } from "astro:actions";
import { prisma } from "@/lib/db";

const categoriasExcluidas = [
  "hogar",
  "outlet",
  "CONTADORAS Y CLASIFICADORAS DE BILLETES",
];

export const getAllCategories = defineAction({
  accept: "json",
  handler: async () => {
    // Traemos todas las categorías (excluyendo algunas)
    const categories = await prisma.category.findMany({
      where: {
        NOT: categoriasExcluidas.map((name) => ({
          name: {
            equals: name,
            mode: "insensitive",
          },
        })),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    // Contamos productos no eliminados por categoría
    const counts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { deleted: false },
      _count: { _all: true },
    });

    // Creamos un mapa para acceso rápido por categoryId
    const countMap = new Map<number, number>();
    counts.forEach((item) => {
      countMap.set(item.categoryId, item._count._all);
    });

    // Combinamos los datos
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      productCount: countMap.get(cat.id) ?? 0,
    }));
  },
});


/* import { defineAction } from "astro:actions";
import { prisma } from "@/lib/db";

const categoriasExcluidas = [
  "hogar",
  "outlet",
  "CONTADORAS Y CLASIFICADORAS DE BILLETES",
];

export const getAllCategories = defineAction({
  accept: "json",
  handler: async () => {
    const categories = await prisma.category.findMany({
      where: {
        NOT: categoriasExcluidas.map((name) => ({
          name: {
            equals: name,
            mode: "insensitive",
          },
        })),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true, // 👈 ya lo tenés en el select
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    // 👉 tenés que incluir `slug` aquí también
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug, // 👈 agregá esto
      productCount: cat._count.products,
    }));
  },
});
 */