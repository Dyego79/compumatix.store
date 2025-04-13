// scripts/seedFichaProductos.ts

import { PrismaClient } from "@prisma/client";
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

/* 
import { PrismaClient } from "@prisma/client";
import { obtenerToken } from "@/utils/apiclient";
import fs from "fs";
import path from "path";
import fetch from "node-fetch"; // en caso de entorno Node
import FormData from "form-data";
import { slugify } from "@/utils/slugify";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi({
  token:
    process.env
      .sk_live_662af241f939b29e7255c394d998e4ce206da277c1268ebf3a07e8deefd3573d!,
});

const prisma = new PrismaClient();
const API_ITEM_URL = "https://api.nb.com.ar/v1/item/";
const BASE_IMAGE_URL = "https://static.nb.com.ar/i/nb_";
const CHUNK_SIZE = 5; // más bajo si tenés muchas imágenes

const args = process.argv.slice(2);
const limit = args[0] ? parseInt(args[0], 10) : undefined;

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

async function uploadImageToUploadThing(
  imageUrl: string
): Promise<string | null> {
  try {
    const result = await utapi.uploadFilesFromUrl(imageUrl);
    if (result.error) {
      console.error("❌ Error al subir imagen:", imageUrl, result.error);
      return null;
    }
    return result.data?.url || null;
  } catch (error) {
    console.error("❌ Excepción al subir imagen:", imageUrl, error);
    return null;
  }
}

async function seedFichaProductoById(externalId: number) {
  try {
    const data = await fetchJSON(`${API_ITEM_URL}${externalId}`);
    const titleSlug = slugify(data.title ?? "producto");

    const originalImages = data.images ?? [];

    const urlsHD: string[] = [];
    const urlsThumb: string[] = [];

    for (const img of originalImages) {
      const checksum = img.checksum;
      const hdUrl = `${BASE_IMAGE_URL}_ver_${checksum}`;
      const thumbUrl = `${BASE_IMAGE_URL}${titleSlug}_size_h120_${checksum}`;

      const [uploadedHD, uploadedThumb] = await Promise.all([
        uploadImageToUploadThing(hdUrl),
        uploadImageToUploadThing(thumbUrl),
      ]);

      if (uploadedHD) urlsHD.push(uploadedHD);
      if (uploadedThumb) urlsThumb.push(uploadedThumb);
    }

    await prisma.fichaProducto.upsert({
      where: {
        productExternalId: externalId,
      },
      update: {
        description: data.description?.value ?? "",
        originalImages,
        atributos: data.attributes ?? [],
        imageUrlsHD: urlsHD,
        imageUrlsThumb: urlsThumb,
      },
      create: {
        productExternalId: externalId,
        description: data.description?.value ?? "",
        originalImages,
        atributos: data.attributes ?? [],
        imageUrlsHD: urlsHD,
        imageUrlsThumb: urlsThumb,
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
    take: limit,
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
