import postgres from "postgres";
import "dotenv/config";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";
import { obtenerToken } from "@/utils/apiclient";
import slugify from "slugify";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { ssl: "require" });

const API_URL = "https://api.nb.com.ar/v1/";
const CHUNK_SIZE = 50;

function generateSlug(title: string, id: number) {
  return `${slugify(title, { lower: true, strict: true })}-${id}`;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function fetchJSON(url: string) {
  const token = await obtenerToken();
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Error al obtener: ${url}`);
  return res.json();
}

async function seedProducts() {
  console.time("⏱ Productos NB");

  const products = await fetchJSON(API_URL);
  const allExternalIds: number[] = [];

  const chunks = chunkArray(products, CHUNK_SIZE);

  for (const chunk of chunks) {
    const insertBatch: any[] = [];

    await Promise.allSettled(
      chunk.map(async (item: any) => {
        const slug = generateSlug(item.title, item.id);
        allExternalIds.push(item.id);

        try {
          const existingProduct = await sql`
            SELECT id FROM "Product" WHERE "externalId" = ${item.id}
          `.then((res) => res[0]);

          const normalizedBrandName = slugify(item.brand, { lower: true, strict: true });
          const existingBrand = await sql`
            SELECT id, name FROM "Brand"
          `.then(res =>
            res.find((brand: any) => slugify(brand.name, { lower: true, strict: true }) === normalizedBrandName)
          );

          if (!existingBrand) {
            try {
              await sql`
                INSERT INTO "Brand" (id, name)
                VALUES (${item.brandId}, ${item.brand})
              `;
            } catch (error) {
              console.error(`❌ Error insertando marca "${item.brand}":, error`);
            }
          }

          const normalizedCategoryName = slugify(item.category, { lower: true, strict: true });
          const existingCategory = await sql`
            SELECT id, name FROM "Category"
          `.then(res =>
            res.find((cat: any) => slugify(cat.name, { lower: true, strict: true }) === normalizedCategoryName)
          );

          if (!existingCategory) {
            try {
              await sql`
                INSERT INTO "Category" (id, name, "initialB", "initialC")
                VALUES (${item.categoryId}, ${item.category}, 0, 0)
              `;
            } catch (error) {
              console.error(`❌ Error insertando categoría "${item.category}":, error`);
            }
          }

          if (existingProduct) {
            await sql`
              UPDATE "Product"
              SET
                "price" = ${item.price?.value ?? 0},
                "finalPrice" = ${item.price?.finalPrice ?? 0},
                "iva" = ${item.price?.iva ?? 0},
                "cotizacion" = ${item.cotizacion ?? null},
                "updatedAt" = NOW()
              WHERE "externalId" = ${item.id}
            `;
          } else {
            let mainImage = item.mainImage ?? "";
            let mainImageExp = item.mainImageExp ?? "";

            if (!mainImage.includes("static.nb.com.ar") && mainImage.length > 0) {
              try {
                mainImage = await subirImagenAUploadThing(mainImage);
              } catch (error) {
                console.error(`❌ Error subiendo ${item.mainImage}, error`);
              }
            }

            if (!mainImageExp.includes("static.nb.com.ar") && mainImageExp.length > 0) {
              try {
                mainImageExp = await subirImagenAUploadThing(mainImageExp);
              } catch (error) {
                console.error(`❌ Error subiendo ${item.mainImageExp}, error`);
              }
            }

            const safeMainImage =
              mainImage.length > 0
                ? mainImage
                : "https://static.nb.com.ar/img/no-image.png";

            const safeMainImageExp = mainImageExp.length > 0 ? mainImageExp : null;

            insertBatch.push({
              id: sql`gen_random_uuid()`,
              title: item.title,
              slug,
              sku: item.sku,
              categoryId: item.categoryId,
              brandId: item.brandId,
              mainImage: safeMainImage,
              mainImageExp: safeMainImageExp,
              warranty: item.warranty ?? null,
              stock: item.stock ?? null,
              amountStock: item.amountStock ?? null,
              highAverage: item.highAverage ? Math.round(item.highAverage) : null,
              widthAverage: item.widthAverage ? Math.round(item.widthAverage) : null,
              lengthAverage: item.lengthAverage ? Math.round(item.lengthAverage) : null,
              weightAverage: item.weightAverage ? Math.round(item.weightAverage) : null,
              price: item.price?.value ?? 0,
              finalPrice: item.price?.finalPrice ?? 0,
              iva: item.price?.iva ?? 0,
              cotizacion: item.cotizacion ?? null,
              utility: item.utility ?? null,
              proveedorIt: "nb",
              externalId: item.id,
              deleted: false,
              createdAt: sql`NOW()`,
              updatedAt: sql`NOW()`
            });
          }
        } catch (error) {
          console.error(`❌ Error procesando producto ${item.title}:, error`);
        }
      })
    );

    if (insertBatch.length > 0) {
      try {
        await sql`
          INSERT INTO "Product" ${sql(insertBatch)}
        `;
        console.log(`✅ Insertados ${insertBatch.length} productos nuevos.`);
      } catch (error) {
        console.error(`❌ Error insertando nuevos productos:, error`);
      }
    }
  }

  console.log("🧹 Realizando soft-delete de productos no encontrados en NB...");
  const { count } = await sql`
    UPDATE "Product"
    SET "deleted" = true
    WHERE "proveedorIt" = 'nb'
      AND NOT ("externalId" = ANY(${Array.from(allExternalIds)}))
      RETURNING id;
  `.then((res) => ({ count: res.length }));

  console.log(`✅ Soft-delete completado. Productos marcados como deleted: ${count}`);

  await sql.end();
  console.timeEnd("⏱ Productos NB");
}

seedProducts().catch((error) => {
  console.error("❌ Error general en seedProducts:", error);
  sql.end();
});


/* import postgres from "postgres";
import "dotenv/config";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";
import { obtenerToken } from "@/utils/apiclient";
import slugify from "slugify";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { ssl: "require" });

const API_URL = "https://api.nb.com.ar/v1/";
const CHUNK_SIZE = 50;

function generateSlug(title: string, id: number) {
  return `${slugify(title, { lower: true, strict: true })}-${id}`;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function fetchJSON(url: string) {
  const token = await obtenerToken();
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Error al obtener: ${url}`);
  return res.json();
}

async function seedProducts() {
  console.time("⏱ Productos NB");

  const products = await fetchJSON(API_URL);
  const allExternalIds: number[] = [];

  const chunks = chunkArray(products, CHUNK_SIZE);

  for (const chunk of chunks) {
    const insertBatch: any[] = [];

    await Promise.allSettled(
      chunk.map(async (item: any) => {
        const slug = generateSlug(item.title, item.id);

        try {
          const brandExisting = await sql`
            SELECT id FROM "Brand" WHERE id = ${item.brandId}
          `.then((res) => res[0]);

          if (!brandExisting) {
            await sql`
              INSERT INTO "Brand" (id, name)
              VALUES (${item.brandId}, ${item.brand})
            `;
          }

          const categoryExisting = await sql`
            SELECT id FROM "Category" WHERE id = ${item.categoryId}
          `.then((res) => res[0]);

          if (!categoryExisting) {
            await sql`
              INSERT INTO "Category" (id, name, "initialB", "initialC")
              VALUES (${item.categoryId}, ${item.category}, 0, 0)
            `;
          }

          // Manejo de imagen principal
          let mainImage = item.mainImage ?? "";
          let mainImageExp = item.mainImageExp ?? "";

          if (mainImage.includes("static.nb.com.ar")) {
            // Imagen buena, no subimos
          } else if (mainImage.length > 0) {
            try {
              mainImage = await subirImagenAUploadThing(mainImage);
            } catch (error) {
              console.error(`❌ Error subiendo ${item.mainImage}`, error);
            }
          }

          if (mainImageExp.includes("static.nb.com.ar")) {
            // Imagen buena, no subimos
          } else if (mainImageExp.length > 0) {
            try {
              mainImageExp = await subirImagenAUploadThing(mainImageExp);
            } catch (error) {
              console.error(`❌ Error subiendo ${item.mainImageExp}`, error);
            }
          }

          // ✅ Imagen segura
          const safeMainImage =
            mainImage.length > 0
              ? mainImage
              : "https://static.nb.com.ar/img/no-image.png";

          const safeMainImageExp =
            mainImageExp.length > 0 ? mainImageExp : null;

          insertBatch.push({
            id: sql`gen_random_uuid()`,
            title: item.title,
            slug,
            sku: item.sku,
            categoryId: item.categoryId,
            brandId: item.brandId,
            mainImage: safeMainImage,
            mainImageExp: safeMainImageExp,
            warranty: item.warranty ?? null,
            stock: item.stock ?? null,
            amountStock: item.amountStock ?? null,
            highAverage: item.highAverage ? Math.round(item.highAverage) : null,
            widthAverage: item.widthAverage
              ? Math.round(item.widthAverage)
              : null,
            lengthAverage: item.lengthAverage
              ? Math.round(item.lengthAverage)
              : null,
            weightAverage: item.weightAverage
              ? Math.round(item.weightAverage)
              : null,

            price: item.price?.value ?? 0,
            finalPrice: item.price?.finalPrice ?? 0,
            iva: item.price?.iva ?? 0,
            cotizacion: item.cotizacion ?? null,
            utility: item.utility ?? null,
            proveedorIt: "nb",
            externalId: item.id,
            deleted: false,
            createdAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
          });

          allExternalIds.push(item.id);
        } catch (error) {
          console.error(`❌ Error procesando producto ${item.title}:`, error);
        }
      })
    );

    if (insertBatch.length > 0) {
      try {
        await sql`
          INSERT INTO "Product" ${sql(insertBatch)}
          ON CONFLICT ("externalId") DO UPDATE SET
            "title" = EXCLUDED."title",
            "slug" = EXCLUDED."slug",
            "sku" = EXCLUDED."sku",
            "categoryId" = EXCLUDED."categoryId",
            "brandId" = EXCLUDED."brandId",
            "mainImage" = EXCLUDED."mainImage",
            "mainImageExp" = EXCLUDED."mainImageExp",
            "warranty" = EXCLUDED."warranty",
            "stock" = EXCLUDED."stock",
            "amountStock" = EXCLUDED."amountStock",
            "highAverage" = EXCLUDED."highAverage",
            "widthAverage" = EXCLUDED."widthAverage",
            "lengthAverage" = EXCLUDED."lengthAverage",
            "weightAverage" = EXCLUDED."weightAverage",
            "price" = EXCLUDED."price",
            "finalPrice" = EXCLUDED."finalPrice",
            "iva" = EXCLUDED."iva",
            "cotizacion" = EXCLUDED."cotizacion",
            "utility" = EXCLUDED."utility",
            "proveedorIt" = 'nb',
            "deleted" = false,
            "updatedAt" = NOW()
        `;
        console.log(
          `✅ Insertados o actualizados ${insertBatch.length} productos.`
        );
      } catch (error) {
        console.error(`❌ Error insertando batch:`, error);
      }
    }
  }

  console.log("🧹 Realizando soft-delete de productos no encontrados en NB...");
  const { count } = await sql`
    UPDATE "Product"
    SET "deleted" = true
    WHERE "proveedorIt" = 'nb'
      AND NOT ("externalId" = ANY(${Array.from(allExternalIds)}))
      RETURNING id;
  `.then((res) => ({ count: res.length }));

  console.log(
    `✅ Soft-delete completado. Productos marcados como deleted: ${count}`
  );

  await sql.end();
  console.timeEnd("⏱ Productos NB");
}

seedProducts().catch((error) => {
  console.error("❌ Error general en seedProducts:", error);
  sql.end();
});
 */
