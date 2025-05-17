import postgres from "postgres";
import "dotenv/config";
import { slugify } from "@/utils/slugify";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { ssl: "require" });

async function updateCategorySlugs() {
  const categories = await sql`
    SELECT id, name FROM "Category" WHERE slug IS NULL
  `;

  for (const cat of categories) {
    const normalized = cat.name.trim().toLowerCase();
    const newSlug = slugify(normalized);

    const existing = await sql`
      SELECT id FROM "Category" WHERE slug = ${newSlug}
    `.then((res) => res[0]);

    if (existing) {
      // 💡 Ya existe otra categoría con ese slug: combinar
      console.log(`🔀 Combinando categoría ${cat.name} (${cat.id}) con existente slug "${newSlug}" (${existing.id})`);

      // 1. Mover los productos a la categoría existente
      await sql`
        UPDATE "Product"
        SET "categoryId" = ${existing.id}
        WHERE "categoryId" = ${cat.id}
      `;

      // 2. Eliminar la categoría duplicada
      await sql`
        DELETE FROM "Category"
        WHERE id = ${cat.id}
      `;
    } else {
      // ✅ Slug único: simplemente actualizar
      await sql`
        UPDATE "Category"
        SET slug = ${newSlug}
        WHERE id = ${cat.id}
      `;
      console.log(`✅ ${cat.name} → ${newSlug}`);
    }
  }

  console.log("🎉 Slugs actualizados y categorías combinadas si era necesario.");
  await sql.end();
}

updateCategorySlugs().catch(console.error);
