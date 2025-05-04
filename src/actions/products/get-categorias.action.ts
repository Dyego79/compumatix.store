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
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      productCount: cat._count.products,
    }));
  },
});
