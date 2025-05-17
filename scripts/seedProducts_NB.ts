// src/scripts/seedProductsNB.ts
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
            SELECT id, "mainImage", "mainImageExp" FROM "Product" WHERE "externalId" = ${item.id}
          `.then((res) => res[0]);

          const normalizedBrand = slugify(item.brand, {
            lower: true,
            strict: true,
          });
          const brand = await sql`SELECT id, name FROM "Brand"`.then((res) =>
            res.find(
              (b: any) =>
                slugify(b.name, { lower: true, strict: true }) ===
                normalizedBrand
            )
          );
          if (!brand) {
            await sql`INSERT INTO "Brand" (id, name) VALUES (${item.brandId}, ${item.brand})`.catch(
              () => {}
            );
          }

          const normalizedCategory = slugify(item.category, {
            lower: true,
            strict: true,
          });
          const category = await sql`SELECT id, name FROM "Category"`.then(
            (res) =>
              res.find(
                (c: any) =>
                  slugify(c.name, { lower: true, strict: true }) ===
                  normalizedCategory
              )
          );
          if (!category) {
            await sql`INSERT INTO "Category" (id, name, "initialB", "initialC") VALUES (${item.categoryId}, ${item.category}, 0, 0)`.catch(
              () => {}
            );
          }

          let mainImage = item.mainImage ?? "";
          let mainImageExp = item.mainImageExp ?? "";

          // Si ya existe el producto, actualizar precios y tal vez imágenes si corresponde
          if (existingProduct) {
            if (
              mainImage &&
              !mainImage.includes("uploadthing.com") &&
              mainImage.includes("static.nb.com.ar")
            ) {
              try {
                mainImage = await subirImagenAUploadThing(mainImage);
              } catch (error) {
                console.error(
                  `❌ Error subiendo mainImage: ${mainImage}`,
                  error
                );
              }
            } else {
              mainImage = existingProduct.mainImage;
            }

            if (
              mainImageExp &&
              !mainImageExp.includes("uploadthing.com") &&
              mainImageExp.includes("static.nb.com.ar")
            ) {
              try {
                mainImageExp = await subirImagenAUploadThing(mainImageExp);
              } catch (error) {
                console.error(
                  `❌ Error subiendo mainImageExp: ${mainImageExp}`,
                  error
                );
              }
            } else {
              mainImageExp = existingProduct.mainImageExp;
            }

            await sql`
              UPDATE "Product"
              SET
                "price" = ${item.price?.value ?? 0},
                "finalPrice" = ${item.price?.finalPrice ?? 0},
                "iva" = ${item.price?.iva ?? 0},
                "cotizacion" = ${item.cotizacion ?? null},
                "mainImage" = ${mainImage},
                "mainImageExp" = ${mainImageExp},
                "updatedAt" = NOW()
              WHERE "externalId" = ${item.id}
            `;
          } else {
            if (mainImage && mainImage.includes("static.nb.com.ar")) {
              try {
                mainImage = await subirImagenAUploadThing(mainImage);
              } catch (error) {
                console.error(
                  `❌ Error subiendo mainImage: ${mainImage}`,
                  error
                );
              }
            }

            if (mainImageExp && mainImageExp.includes("static.nb.com.ar")) {
              try {
                mainImageExp = await subirImagenAUploadThing(mainImageExp);
              } catch (error) {
                console.error(
                  `❌ Error subiendo mainImageExp: ${mainImageExp}`,
                  error
                );
              }
            }

            insertBatch.push({
              id: sql`gen_random_uuid()`,
              title: item.title,
              slug,
              sku: item.sku,
              categoryId: item.categoryId,
              brandId: item.brandId,
              mainImage:
                mainImage || "https://static.nb.com.ar/img/no-image.png",
              mainImageExp: mainImageExp || null,
              warranty: item.warranty ?? null,
              stock: item.stock ?? null,
              amountStock: item.amountStock ?? null,
              highAverage: item.highAverage
                ? Math.round(item.highAverage)
                : null,
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
          }
        } catch (error) {
          console.error(`❌ Error procesando producto ${item.title}:`, error);
        }
      })
    );

    if (insertBatch.length > 0) {
      try {
        await sql`INSERT INTO "Product" ${sql(insertBatch)}`;
        console.log(`✅ Insertados ${insertBatch.length} productos nuevos.`);
      } catch (error) {
        console.error(`❌ Error insertando nuevos productos:`, error);
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

seedProducts().catch((err) => {
  console.error("❌ Error general en seedProducts:", err);
  sql.end();
});
