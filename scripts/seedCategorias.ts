//seedCategories.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CATEGORY_URL = "https://api.nb.com.ar/v1/categories";

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error al obtener: ${url}`);
  return res.json();
}

async function seedCategories() {
  console.time("⏱ Categorías");

  const categories = await fetchJSON(CATEGORY_URL);

  // 🧹 Primero borrar productos (porque dependen de las categorías)
  await prisma.product.deleteMany();

  // 🧹 Borrar categorías existentes
  await prisma.category.deleteMany();

  for (const cat of categories) {
    const id = parseInt(cat.id);
    await prisma.category.upsert({
      where: { id },
      update: {
        name: cat.description,
        initialB: parseInt(cat.initialB),
        initialC: parseInt(cat.initialC),
      },
      create: {
        id,
        name: cat.description,
        initialB: parseInt(cat.initialB),
        initialC: parseInt(cat.initialC),
      },
    });
  }

  await prisma.$disconnect();
  console.timeEnd("⏱ Categorías");
}

seedCategories().catch((e) => {
  console.error("❌ Error en seed de categorías:", e);
  prisma.$disconnect();
  process.exit(1);
});
