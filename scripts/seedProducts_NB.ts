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

/* import { PrismaClient } from "@prisma/client";
import slugify from "slugify";
import fs from "fs";
import { obtenerToken } from "@/utils/apiclient";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";

const prisma = new PrismaClient();
const API_URL = "https://api.nb.com.ar/v1/";
const CHUNK_SIZE = 25;

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
  console.time("⏱ Productos");

  // Asegúrate de haber agregado al modelo Prisma:
  // model Product { ... deleted Boolean @default(false) ... }

  interface ProductAPI {
    id: number;
    title: string;
    sku: string;
    mainImage: string;
    mainImageExp?: string;
    warranty?: string;
    stock?: string;
    amountStock?: number;
    highAverage?: number;
    widthAverage?: number;
    lengthAverage?: number;
    weightAverage?: number;
    price?: { value: number; finalPrice: number; iva: number };
    cotizacion?: number;
    utility?: number;
    categoryId: number;
    category: string;
    brandId: number;
    brand: string;
  }

  const products = (await fetchJSON(API_URL)) as ProductAPI[];
  const fetchedIds = products.map((p) => p.id);
  const chunks = chunkArray(products, CHUNK_SIZE);

  const existingBrands = new Set(
    (await prisma.brand.findMany({ select: { id: true } })).map((b) => b.id)
  );
  const existingCategories = new Set(
    (await prisma.category.findMany({ select: { id: true } })).map((c) => c.id)
  );

  const errores: string[] = [];
  let totalOk = 0;
  let totalFail = 0;

  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map(async (item) => {
        const slug = generateSlug(item.title, item.id);

        if (!existingBrands.has(item.brandId)) {
          try {
            await prisma.brand.create({
              data: { id: item.brandId, name: item.brand, imageUrl: null },
            });
            existingBrands.add(item.brandId);
          } catch {
            errores.push(`No se pudo crear marca ${item.brandId}`);
            totalFail++;
            return;
          }
        }

        if (!existingCategories.has(item.categoryId)) {
          try {
            await prisma.category.create({
              data: {
                id: item.categoryId,
                name: item.category,
                initialB: 0,
                initialC: 0,
              },
            });
            existingCategories.add(item.categoryId);
          } catch {
            errores.push(`No se pudo crear categoría ${item.categoryId}`);
            totalFail++;
            return;
          }
        }

        // Verifico si existe para no volver a subir imágenes
        const existing = await prisma.product.findUnique({
          where: { externalId: item.id },
          select: { mainImage: true, mainImageExp: true },
        });

        const mainImageUrl = existing
          ? existing.mainImage
          : await subirImagenAUploadThing(item.mainImage);

        const mainImageExpUrl = existing
          ? (existing.mainImageExp ?? undefined)
          : item.mainImageExp
            ? await subirImagenAUploadThing(item.mainImageExp)
            : undefined;

        try {
          await prisma.product.upsert({
            where: { externalId: item.id },
            update: {
              title: item.title,
              slug,
              sku: item.sku,
              mainImage: mainImageUrl ?? undefined,
              mainImageExp: mainImageExpUrl,
              warranty: item.warranty ?? undefined,
              stock: item.stock ?? undefined,
              amountStock: item.amountStock ?? undefined,
              highAverage: item.highAverage ?? undefined,
              widthAverage: item.widthAverage ?? undefined,
              lengthAverage: item.lengthAverage ?? undefined,
              weightAverage: item.weightAverage ?? undefined,
              price: item.price?.value ?? 0,
              finalPrice: item.price?.finalPrice ?? 0,
              iva: item.price?.iva ?? 0,
              cotizacion: item.cotizacion ?? undefined,
              utility: item.utility ?? undefined,
              categoryId: item.categoryId,
              brandId: item.brandId,
              proveedorIt: "NB",
              deleted: false,
            },
            create: {
              externalId: item.id,
              title: item.title,
              slug,
              sku: item.sku,
              mainImage: mainImageUrl ?? "",
              mainImageExp: mainImageExpUrl,
              warranty: item.warranty ?? undefined,
              stock: item.stock ?? undefined,
              amountStock: item.amountStock ?? undefined,
              highAverage: item.highAverage ?? undefined,
              widthAverage: item.widthAverage ?? undefined,
              lengthAverage: item.lengthAverage ?? undefined,
              weightAverage: item.weightAverage ?? undefined,
              price: item.price?.value ?? 0,
              finalPrice: item.price?.finalPrice ?? 0,
              iva: item.price?.iva ?? 0,
              cotizacion: item.cotizacion ?? undefined,
              utility: item.utility ?? undefined,
              categoryId: item.categoryId,
              brandId: item.brandId,
              proveedorIt: "NB",
              deleted: false,
            },
          });
          totalOk++;
        } catch (err) {
          errores.push(`Error al guardar producto ${item.title}: ${err}`);
          totalFail++;
        }
      })
    );
  }

  // Soft-delete de productos huérfanos
  await prisma.product.updateMany({
    where: { externalId: { notIn: fetchedIds } },
    data: { deleted: true },
  });

  if (errores.length) {
    fs.writeFileSync("errores-seed.log", errores.join("\n"), "utf-8");
    console.log(`📜 Log de errores en errores-seed.log`);
  }
  console.log(`✅ OK: ${totalOk} | ❌ Fallidos: ${totalFail}`);

  await prisma.$disconnect();
  console.timeEnd("⏱ Productos");
}

seedProducts().catch((e) => {
  console.error("❌ Error en seed de productos:", e);
  prisma.$disconnect();
  process.exit(1);
});
 */
