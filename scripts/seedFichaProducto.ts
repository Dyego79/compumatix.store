// scripts/seedFichaProductos_NB.ts

import postgres from "postgres";
import { obtenerToken } from "@/utils/apiclient";
import "dotenv/config";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

const API_ITEM_URL = "https://api.nb.com.ar/v1/item/";
const CHUNK_SIZE = 10; // Número de fichas en paralelo

async function fetchJSON(url: string) {
  const token = await obtenerToken();

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Error al obtener: ${url}`);
  return res.json();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function seedFichaProductoById(externalId: number) {
  try {
    const data = await fetchJSON(`${API_ITEM_URL}${externalId}`);

    // Si no trae imágenes, no hacemos nada
    if (!data.images || data.images.length === 0) {
      console.warn(`⚠️ Producto ${externalId} no tiene imágenes, se omite.`);
      return;
    }

    await sql`
      INSERT INTO "FichaProducto" (
        "productExternalId",
        "description",
        "originalImages",
        "atributos"
      )
      VALUES (
        ${externalId},
        ${data.description?.value ?? ""},
        ${JSON.stringify(data.images)},
        ${JSON.stringify(data.attributes ?? [])}
      )
      ON CONFLICT ("productExternalId") DO UPDATE SET
        "description" = EXCLUDED."description",
        "originalImages" = EXCLUDED."originalImages",
        "atributos" = EXCLUDED."atributos";
    `;

    console.log(`✅ FichaProducto actualizada para ${externalId}`);
  } catch (error: any) {
    console.error(`❌ Error con ${externalId}:`, error.message);
  }
}

async function main() {
  console.time("⏱ FichaProducto");

  const products = await sql`
    SELECT "externalId" FROM "Product" WHERE "externalId" IS NOT NULL
  `;

  const ids = products.map((p: any) => p.externalId);
  const chunks = chunkArray(ids, CHUNK_SIZE);

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map((id) => seedFichaProductoById(id)));
  }

  await sql.end();
  console.timeEnd("⏱ FichaProducto");
}

main().catch((err) => {
  console.error("❌ Error general:", err);
  sql.end();
  process.exit(1);
});

/* import { PrismaClient } from "@prisma/client";
import { obtenerToken } from "@/utils/apiclient";
import fs from "fs";

const prisma = new PrismaClient();
const API_ITEM_URL = "https://api.nb.com.ar/v1/item/";
const CHUNK_SIZE = 10; // Número de fichas en paralelo

async function fetchJSON(url: string) {
  const token = await obtenerToken();

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error(`Error al obtener: ${url}`);
  return res.json();
}

async function seedFichaProductoById(externalId: number) {
  try {
    const data = await fetchJSON(`${API_ITEM_URL}${externalId}`);

    await prisma.fichaProducto.upsert({
      where: {
        productExternalId: externalId,
      },
      update: {
        description: data.description?.value ?? "",
        originalImages: data.images ?? [],
        atributos: data.attributes ?? [],
      },
      create: {
        productExternalId: externalId,
        description: data.description?.value ?? "",
        originalImages: data.images ?? [],
        atributos: data.attributes ?? [],
      },
    });

    console.log(`✅ FichaProducto actualizada para ${externalId}`);
  } catch (error: any) {
    console.error(`❌ Error con ${externalId}:`, error.message);
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function main() {
  console.time("⏱ FichaProducto");

  const products = await prisma.product.findMany({
    where: {
      externalId: { not: null },
    },
    select: { externalId: true },
  });

  const ids = products.map((p) => p.externalId!).filter(Boolean);
  const chunks = chunkArray(ids, CHUNK_SIZE);

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map((id) => seedFichaProductoById(id)));
  }

  await prisma.$disconnect();
  console.timeEnd("⏱ FichaProducto");
}

main().catch((err) => {
  console.error("❌ Error general:", err);
  prisma.$disconnect();
  process.exit(1);
});
 */
