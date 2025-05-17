// scripts/seedFichaProducto_NB_Postgres.ts

import postgres from "postgres";
import { UTApi } from "uploadthing/server";
import { obtenerToken } from "@/utils/apiclient";
import { fetchLiveDataSinToken } from "@/lib/api";
import { generateSlug } from "@/lib/slug";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";
import "dotenv/config";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });
const utapi = new UTApi({ token: process.env.UPLOADTHING_SECRET! });

function generateSlugImage(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function urlDisponible(url: string): Promise<boolean> {
  if (url.includes("static.nb.com.ar")) return true;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function subirImagenesAUploadThing(urls: string[]): Promise<string[]> {
  const results: string[] = [];

  for (const url of urls) {
    const disponible = await urlDisponible(url);
    if (!disponible) {
      console.warn(`🚫 Imagen no disponible: ${url}`);
      continue;
    }

    try {
      const filename = path.basename(new URL(url).pathname);
      const tempPath = path.join(tmpdir(), filename);

      const res = await fetch(url);
      if (!res.ok || !res.body) continue;

      await pipeline(res.body, fs.createWriteStream(tempPath));
      const buffer = await fs.promises.readFile(tempPath);
      const blob = new Blob([buffer]) as Blob & { name: string };
      blob.name = filename;

      const result = await utapi.uploadFiles([blob]);
      fs.unlinkSync(tempPath);

      const archivo = result[0];
      if (archivo?.data?.ufsUrl) results.push(archivo.data.ufsUrl);
    } catch (err) {
      console.error(`❌ Error al subir ${url}:`, err);
    }
  }
  return results;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function seedFichaProducto() {
  let tokenActual = await obtenerToken();
  let contador = 0;

  const productos = await sql`
    SELECT "externalId", "title"
    FROM "Product"
    WHERE "externalId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "FichaProducto"
        WHERE "FichaProducto"."productExternalId" = "Product"."externalId"
      )
  `;
  /* const productos = await sql`
    SELECT "externalId", "title"
    FROM "Product"
    WHERE "externalId" IS NOT NULL
  `;
 */
  const CHUNK_SIZE = 5;
  const chunks = chunkArray(productos, CHUNK_SIZE);

  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map(async ({ externalId, title }) => {
        if (!externalId) return;

        if (contador >= 25) {
          tokenActual = await obtenerToken();
          console.log("🔄 Token renovado");
          contador = 0;
        }

        contador++;

        let data;
        try {
          data = await fetchLiveDataSinToken(externalId, tokenActual);
        } catch (err: any) {
          console.error(`❌ Error al obtener datos para ${title} [ID: ${externalId}]`, err.message);
          return;
        }

        const images = Array.isArray(data?.images) ? data.images : [];
        if (images.length === 0) {
          console.warn(`⛔ Sin imágenes: ${title} [ID: ${externalId}]`);
          return;
        }

        const slug = generateSlugImage(title);

        const originalImages = images.map((img: any) => ({
          checksum: img.checksum,
          order: img.order,
        }));

        const urlsHD = images.map(
          (img: any) => `https://static.nb.com.ar/i/nb__ver_${img.checksum}`
        );
        const urlsThumb = images.map(
          (img: any) => `https://static.nb.com.ar/i/nb_${slug}_size_h120_${img.checksum}`
        );

        const imageUrlsHD = await subirImagenesAUploadThing(urlsHD);
        const imageUrlsThumb = await subirImagenesAUploadThing(urlsThumb);

        const atributos = Array.isArray(data?.attributes)
          ? Object.fromEntries(
              data.attributes
                .filter((a: any) => a?.name && a?.value)
                .map((a: any) => [a.name, a.value])
            )
          : {};

        try {
          await sql`
            INSERT INTO "FichaProducto" (
              id,
              "productExternalId",
              "description",
              "originalImages",
              "imageUrlsHD",
              "imageUrlsThumb",
              "atributos"
            )
            VALUES (
              gen_random_uuid(),
              ${externalId},
              ${data?.description?.value ?? null},
              ${sql.json(originalImages)},
              ${sql.json(imageUrlsHD)},
              ${sql.json(imageUrlsThumb)},
              ${sql.json(atributos)}
            )
            ON CONFLICT ("productExternalId") DO UPDATE SET
              "description" = EXCLUDED."description",
              "originalImages" = EXCLUDED."originalImages",
              "imageUrlsHD" = EXCLUDED."imageUrlsHD",
              "imageUrlsThumb" = EXCLUDED."imageUrlsThumb",
              "atributos" = EXCLUDED."atributos";
          `;

          console.log(`✅ Ficha actualizada: ${title}`);
        } catch (err) {
          console.error(`❌ Error guardando ficha de ${title}:`, err);
        }
      })
    );
  }

  await sql.end();
}

seedFichaProducto().catch((e) => {
  console.error("❌ Error general:", e);
  sql.end();
  process.exit(1);
});

/* // scripts/seedFichaProductos_NB.ts

import postgres from "postgres";
import { obtenerToken } from "@/utils/apiclient";
import "dotenv/config";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });
const API_ITEM_URL = "https://api.nb.com.ar/v1/item/";
const CHUNK_SIZE = 10;

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

    if (!data.images || data.images.length === 0) {
      console.warn(`⚠️ Producto ${externalId} no tiene imágenes, se omite.`);
      return;
    }

    const imageUrlsHD: string[] = [];
    const imageUrlsThumb: string[] = [];

    for (const image of data.images) {
  const url = image?.url?.trim?.();
  if (!url || !url.startsWith("http")) {
    console.warn(`⚠️ Imagen inválida en producto ${externalId}:`, image);
    continue;
  }

  try {
    const uploaded = await subirImagenAUploadThing(url);
    if (uploaded) {
      imageUrlsHD.push(uploaded);
      imageUrlsThumb.push(uploaded);
    }
  } catch (err) {
    console.error(`❌ Error subiendo imagen ${url} de producto ${externalId}`, err);
  }
}


    await sql`
      INSERT INTO "FichaProducto" (
        "productExternalId",
        "description",
        "originalImages",
        "imageUrlsHD",
        "imageUrlsThumb",
        "atributos"
      )
      VALUES (
        ${externalId},
        ${data.description?.value ?? ""},
        ${JSON.stringify(data.images)},
        ${JSON.stringify(imageUrlsHD)},
        ${JSON.stringify(imageUrlsThumb)},
        ${JSON.stringify(data.attributes ?? [])}
      )
      ON CONFLICT ("productExternalId") DO UPDATE SET
        "description" = EXCLUDED."description",
        "originalImages" = EXCLUDED."originalImages",
        "imageUrlsHD" = EXCLUDED."imageUrlsHD",
        "imageUrlsThumb" = EXCLUDED."imageUrlsThumb",
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
    SELECT "externalId"
    FROM "Product"
    WHERE "externalId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "FichaProducto"
      WHERE "FichaProducto"."productExternalId" = "Product"."externalId"
    )
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
 */