import { PrismaClient } from "@prisma/client";
import slugify from "slugify";
import fs from "fs";
import { obtenerToken } from "@/utils/apiclient";

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

  interface Product {
    id: number;
    title: string;
    sku: string;
    mainImage: string;
    mainImageExp: string;
    warranty: string;
    stock: string;
    amountStock: number;
    highAverage: number;
    widthAverage: number;
    lengthAverage: number;
    weightAverage: number;
    price?: { value: number; finalPrice: number; iva: number };
    cotizacion?: number;
    utility?: number;
    categoryId: number;
    category: string;
    brandId: number;
    brand: string;
  }

  const products = (await fetchJSON(API_URL)) as Product[];
  const chunks = chunkArray(products, CHUNK_SIZE);

  const errores: string[] = [];
  let totalOk = 0;
  let totalFail = 0;

  const existingBrands = new Set(
    (await prisma.brand.findMany({ select: { id: true } })).map((b) => b.id)
  );

  const existingCategories = new Set(
    (await prisma.category.findMany({ select: { id: true } })).map((c) => c.id)
  );

  const existingProductIds = new Set(
    (await prisma.product.findMany({ select: { externalId: true } })).map(
      (p) => p.externalId
    )
  );

  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map(async (item) => {
        const slug = generateSlug(item.title, item.id);

        // Marca
        if (!existingBrands.has(item.brandId)) {
          try {
            await prisma.brand.create({
              data: {
                id: item.brandId,
                name:
                  item.brand || item.title.split(" ")[0] || "Marca desconocida",
                imageUrl: null,
              },
            });
            existingBrands.add(item.brandId);
            console.log(`➕ Marca creada: ${item.brand}`);
          } catch (e) {
            const msg = `❌ No se pudo crear marca ${item.brandId} (${item.brand})`;
            console.warn(msg);
            errores.push(msg);
            totalFail++;
            return;
          }
        }

        // Categoría
        if (!existingCategories.has(item.categoryId)) {
          try {
            await prisma.category.create({
              data: {
                id: item.categoryId,
                name: item.category || "Categoría desconocida",
                initialB: 0,
                initialC: 0,
              },
            });
            existingCategories.add(item.categoryId);
            console.log(`➕ Categoría creada: ${item.category}`);
          } catch (e) {
            const msg = `❌ No se pudo crear categoría ${item.categoryId} (${item.category})`;
            console.warn(msg);
            errores.push(msg);
            totalFail++;
            return;
          }
        }

        // Producto (crear o actualizar)
        try {
          await prisma.product.upsert({
            where: { externalId: item.id },
            update: {
              title: item.title,
              slug,
              sku: item.sku,
              mainImage: item.mainImage,
              mainImageExp: item.mainImageExp,
              warranty: item.warranty,
              stock: item.stock,
              amountStock: item.amountStock,
              highAverage: item.highAverage,
              widthAverage: item.widthAverage,
              lengthAverage: item.lengthAverage,
              weightAverage: item.weightAverage,
              price: item.price?.value ?? 0,
              finalPrice: item.price?.finalPrice ?? 0,
              iva: item.price?.iva ?? 0,
              cotizacion: item.cotizacion ?? null,
              utility: item.utility ?? null,
              attributes: {},
              categoryId: item.categoryId,
              brandId: item.brandId,
            },
            create: {
              externalId: item.id,
              title: item.title,
              slug,
              sku: item.sku,
              mainImage: item.mainImage,
              mainImageExp: item.mainImageExp,
              warranty: item.warranty,
              stock: item.stock,
              amountStock: item.amountStock,
              highAverage: item.highAverage,
              widthAverage: item.widthAverage,
              lengthAverage: item.lengthAverage,
              weightAverage: item.weightAverage,
              price: item.price?.value ?? 0,
              finalPrice: item.price?.finalPrice ?? 0,
              iva: item.price?.iva ?? 0,
              cotizacion: item.cotizacion ?? null,
              utility: item.utility ?? null,
              attributes: {},
              categoryId: item.categoryId,
              brandId: item.brandId,
            },
          });

          console.log(`✔️ Producto procesado: ${item.title}`);
          totalOk++;
        } catch (err) {
          const msg = `❌ Error al guardar producto ${item.title}: ${err}`;
          console.error(msg);
          errores.push(msg);
          totalFail++;
        }
      })
    );
  }

  if (errores.length > 0) {
    fs.writeFileSync("errores-seed.log", errores.join("\n"), "utf-8");
    console.log(`📜 Log de errores guardado en errores-seed.log`);
  }

  console.log(`\n✅ Productos OK: ${totalOk}`);
  console.log(`❌ Fallidos: ${totalFail}`);

  await prisma.$disconnect();
  console.timeEnd("⏱ Productos");
}

seedProducts().catch((e) => {
  console.error("❌ Error en seed de productos:", e);
  prisma.$disconnect();
  process.exit(1);
});

/* import { PrismaClient } from "@prisma/client";
import slugify from "slugify";
import fs from "fs";
import { obtenerToken } from "@/utils/apiclient";

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

  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    redirect: "follow",
  };

  const res = await fetch(url, requestOptions);
  if (!res.ok) throw new Error(`Error al obtener: ${url}`);
  return res.json();
}

async function seedProducts() {
  console.time("⏱ Productos");

  interface Product {
    id: number;
    title: string;
    sku: string;
    mainImage: string;
    mainImageExp: string;
    warranty: string;
    stock: string;
    amountStock: number;
    highAverage: number;
    widthAverage: number;
    lengthAverage: number;
    weightAverage: number;
    price?: { value: number; finalPrice: number; iva: number };
    cotizacion?: number;
    utility?: number;
    categoryId: number;
    category: string;
    brandId: number;
    brand: string;
  }

  const products = (await fetchJSON(API_URL)) as Product[];
  const chunks = chunkArray(products, CHUNK_SIZE);

  let totalOk = 0;
  let totalFail = 0;
  const errores: string[] = [];

  // Borrar solo productos (dejamos marcas y categorías para evitar errores de duplicados)
  await prisma.product.deleteMany();

  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map(async (item) => {
        const slug = generateSlug(item.title, item.id);

        try {
          await prisma.brand.create({
            data: {
              id: item.brandId,
              name:
                item.brand || item.title.split(" ")[0] || "Marca desconocida",
              imageUrl: null,
            },
          });
          console.log(
            `➕ Marca creada automáticamente: ${item.brand} (id: ${item.brandId})`
          );
        } catch (e: any) {
          if (e.code === "P2002") {
            console.warn(
              `⚠️ Marca ya existente: ${item.brand} (id: ${item.brandId})`
            );
          } else {
            const msg = `❌ No se pudo crear la marca ${item.brandId} para producto ${item.title}`;
            console.warn(msg);
            errores.push(msg);
            totalFail++;
            return;
          }
        }

        try {
          await prisma.category.create({
            data: {
              id: item.categoryId,
              name: item.category || "Categoría desconocida",
              initialB: 0,
              initialC: 0,
            },
          });
          console.log(
            `➕ Categoría creada automáticamente: ${item.category} (id: ${item.categoryId})`
          );
        } catch (e: any) {
          if (e.code === "P2002") {
            console.warn(
              `⚠️ Categoría ya existente: ${item.category} (id: ${item.categoryId})`
            );
          } else {
            const msg = `❌ No se pudo crear la categoría ${item.categoryId} para producto ${item.title}`;
            console.warn(msg);
            errores.push(msg);
            totalFail++;
            return;
          }
        }

        try {
          await withRetry(() =>
            prisma.product.create({
              data: {
                externalId: item.id,
                title: item.title,
                slug,
                sku: item.sku,
                mainImage: item.mainImage,
                mainImageExp: item.mainImageExp,
                warranty: item.warranty,
                stock: item.stock,
                amountStock: item.amountStock,
                highAverage: item.highAverage,
                widthAverage: item.widthAverage,
                lengthAverage: item.lengthAverage,
                weightAverage: item.weightAverage,
                price: item.price?.value ?? 0,
                finalPrice: item.price?.finalPrice ?? 0,
                iva: item.price?.iva ?? 0,
                cotizacion: item.cotizacion ?? null,
                utility: item.utility ?? null,
                attributes: {},
                categoryId: item.categoryId,
                brandId: item.brandId,
              },
            })
          );

          console.log(`✔️ Producto guardado: ${item.title}`);
          totalOk++;
        } catch (err) {
          const msg = `❌ Error al guardar producto ${item.title}: ${err}`;
          console.error(msg);
          errores.push(msg);
          totalFail++;
        }
      })
    );

    await new Promise((r) => setTimeout(r, 50));
  }

  if (errores.length > 0) {
    fs.writeFileSync("errores-seed.log", errores.join("\n"), "utf-8");
    console.log(`📜 Log de errores guardado en errores-seed.log`);
  }

  console.log(`\n✅ Productos guardados: ${totalOk}`);
  console.log(`❌ Productos fallidos: ${totalFail}`);

  await prisma.$disconnect();
  console.timeEnd("⏱ Productos");
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 200
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isConnectionError = err?.code === "P1001";
      const isLastAttempt = i === retries;

      if (!isConnectionError || isLastAttempt) {
        throw err;
      }

      console.warn(
        `🔁 Reintentando (${i + 1}/${retries}) tras error de conexión...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("Unreachable (should not happen)");
}

seedProducts().catch((e) => {
  console.error("❌ Error en seed de productos:", e);
  prisma.$disconnect();
  process.exit(1);
});
 */
