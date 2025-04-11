//seedBrands.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BRAND_URL = "https://api.nb.com.ar/v1/brands";

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error al obtener: ${url}`);
  return res.json();
}

async function seedBrands() {
  console.time("⏱ Marcas");

  const brands = await fetchJSON(BRAND_URL);

  for (const brand of brands) {
    const id = parseInt(brand.id);
    await prisma.brand.upsert({
      where: { id },
      update: {
        name: brand.description,
        imageUrl: brand.imagen,
      },
      create: {
        id,
        name: brand.description,
        imageUrl: brand.imagen,
      },
    });
  }

  await prisma.$disconnect();
  console.timeEnd("⏱ Marcas");
}

seedBrands().catch((e) => {
  console.error("❌ Error en seed de marcas:", e);
  prisma.$disconnect();
  process.exit(1);
});
