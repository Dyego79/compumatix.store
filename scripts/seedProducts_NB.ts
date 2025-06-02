import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";
import { obtenerToken } from "@/utils/apiclient";
import slugify from "slugify";
import pLimit from "p-limit";

const prisma = new PrismaClient();
const API_URL = "https://api.nb.com.ar/v1/";
const CHUNK_SIZE = 100; // Aumentamos el tamaño del chunk
const limit = pLimit(20); // Aumentamos la concurrencia

function generateSlug(title: string, id: number) {
  return `${slugify(title, { lower: true, strict: true })}-${id}`;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i + 0, i + size));
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

async function subirConTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // reducimos timeout
  try {
    return await subirImagenAUploadThing(url);
  } finally {
    clearTimeout(timeout);
  }
}

async function seedProducts() {
  console.time("⏱ Productos NB");
  try {
    const products = await fetchJSON(API_URL);
    const allExternalIds: number[] = [];
    const chunks = chunkArray(products, CHUNK_SIZE);
    let updatedCount = 0;
    let createdCount = 0;

    await Promise.all(
      chunks.flatMap((chunk) =>
        chunk.map((item: any) =>
          limit(async () => {
            try {
              const slug = generateSlug(item.title, item.id);
              allExternalIds.push(item.id);

              await prisma.brand.upsert({
                where: { id: item.brandId },
                update: {},
                create: {
                  id: item.brandId,
                  name: item.brand,
                },
              });

              try {
                await prisma.category.upsert({
                  where: { id: item.categoryId },
                  update: {},
                  create: {
                    id: item.categoryId,
                    name: item.category,
                    slug: slugify(item.category, { lower: true }),
                    initialB: 0,
                    initialC: 0,
                  },
                });
              } catch (err: any) {
                console.error(
                  `❌ Error al insertar/actualizar categoría ${item.categoryId} (${item.category})`,
                  err
                );
                if (err.code !== "P2002") throw err;
              }


              const existing = await prisma.product.findUnique({
                where: { externalId: item.id },
              });

              let mainImage = item.mainImage ?? "";
              let mainImageExp = item.mainImageExp ?? "";

              const shouldUpload = (url: string | null | undefined) => {
                if (!url) return false;
                const isUploadThing =
                  url.includes("uploadthing") || url.includes("utfs.io");
                return !isUploadThing && url.includes("static.nb.com.ar");
              };

              if (!existing?.mainImage && shouldUpload(mainImage)) {
                try {
                  mainImage = await subirConTimeout(mainImage);
                } catch (e) {
                  console.error("❌ Error subiendo mainImage:", e);
                }
              } else if (existing?.mainImage) {
                mainImage = existing.mainImage;
              }

              if (!existing?.mainImageExp && shouldUpload(mainImageExp)) {
                try {
                  mainImageExp = await subirConTimeout(mainImageExp);
                } catch (e) {
                  console.error("❌ Error subiendo mainImageExp:", e);
                }
              } else if (existing?.mainImageExp) {
                mainImageExp = existing.mainImageExp;
              }

              const deleted = !(item.amountStock && item.amountStock > 0);

              if (existing) {
                await prisma.product.update({
                  where: { externalId: item.id },
                  data: {
                    price: item.price?.value ?? 0,
                    finalPrice: item.price?.finalPrice ?? 0,
                    iva: item.price?.iva ?? 0,
                    cotizacion: item.cotizacion ?? null,
                    mainImage,
                    mainImageExp,
                    updatedAt: new Date(),
                    deleted,
                  },
                });
                updatedCount++;
              } else {
                const categoryExists = await prisma.category.findUnique({
                  where: { id: item.categoryId },
                });
                if (!categoryExists)
                  throw new Error(
                    `Categoría con ID ${item.categoryId} no existe.`
                  );

                await prisma.product.create({
                  data: {
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
                    deleted,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
                createdCount++;
              }
              console.log(`✅ Procesado producto: ${item.id} - ${item.title}`);
            } catch (e) {
              console.error(`❌ Error procesando producto ID ${item.id}:`, e);
            }
          })
        )
      )
    );

    const deleted = await prisma.product.updateMany({
      where: {
        proveedorIt: "nb",
        externalId: { notIn: allExternalIds },
      },
      data: { deleted: true },
    });

    console.log(
      `✅ Soft-delete completado. Productos marcados como deleted: ${deleted.count}`
    );
    console.log(`🆕 Productos creados: ${createdCount}`);
    console.log(`♻️ Productos actualizados: ${updatedCount}`);
  } catch (error) {
    console.error("❌ Error general en seedProducts:", error);
  } finally {
    await prisma.$disconnect();
    console.timeEnd("⏱ Productos NB");
  }
}

seedProducts();
