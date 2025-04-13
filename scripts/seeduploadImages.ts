import { PrismaClient } from "@prisma/client";
import { UTApi } from "uploadthing/server";
import { fetchLiveDataSinToken } from "@/lib/api";
import { obtenerToken } from "@/utils/apiclient";
import { generateSlug } from "@/lib/slug";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";

const prisma = new PrismaClient();

if (!process.env.UPLOADTHING_SECRET) {
  throw new Error("❌ Falta UPLOADTHING_SECRET en el entorno");
}

const utapi = new UTApi({
  token: process.env.UPLOADTHING_SECRET,
});

function generateSlugImage(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function urlDisponible(url: string): Promise<boolean> {
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
      console.warn(`🚫 Imagen no disponible (HEAD falló): ${url}`);
      continue;
    }

    try {
      const filename = path.basename(new URL(url).pathname);
      const tempPath = path.join(tmpdir(), filename);

      const res = await fetch(url);
      if (!res.ok || !res.body) {
        console.warn(`❌ Falló la descarga de: ${url}`);
        continue;
      }

      await pipeline(res.body, fs.createWriteStream(tempPath));
      const buffer = fs.readFileSync(tempPath);
      const blob = new Blob([buffer]) as Blob & { name: string };
      blob.name = filename;

      const result = await utapi.uploadFiles([blob]);
      fs.unlinkSync(tempPath);

      const archivoSubido = result[0];
      if (archivoSubido?.data?.ufsUrl) {
        results.push(archivoSubido.data.ufsUrl);
      } else {
        console.warn(`⚠️ Falló subir archivo: ${url}`);
        if (archivoSubido?.error) {
          console.warn("📄 Error devuelto:", archivoSubido.error);
        }
      }
    } catch (err) {
      console.error(`❌ Error al subir ${url}:`, err);
    }
  }

  return results;
}

async function seedFichaProducto() {
  let tokenActual = await obtenerToken();
  let contador = 0;

  const productos = await prisma.product.findMany({
    where: {
      externalId: { not: null },
    },
    select: {
      externalId: true,
      title: true,
      fichaProducto: {
        select: {
          imageUrlsHD: true,
        },
      },
    },
  });

  const fallidos: string[] = [];

  for (const producto of productos) {
    const { externalId, title, fichaProducto } = producto;

    if (!externalId) continue;

    // ✅ Saltear si ya tiene imágenes subidas
    if (
      Array.isArray(fichaProducto?.imageUrlsHD) &&
      fichaProducto.imageUrlsHD.length > 0
    ) {
      console.log(`🟡 Ya tiene imágenes: ${title}, se omite.`);
      continue;
    }

    // 🔄 Renueva token cada 25
    if (contador >= 25) {
      try {
        tokenActual = await obtenerToken();
        console.log("🔄 Token renovado.");
      } catch (err) {
        console.error("❌ Error al renovar token:", err);
        continue;
      }
      contador = 0;
    }

    let data;
    try {
      data = await fetchLiveDataSinToken(externalId, tokenActual);
    } catch (err: any) {
      console.error(
        `❌ Error al obtener datos para ${title} [ID: ${externalId}]:`,
        err.message
      );
      fallidos.push(`${title} [ID: ${externalId}]`);
      continue;
    }

    contador++;

    const images = Array.isArray(data?.images) ? data.images : [];
    if (images.length === 0) {
      console.warn(`⛔ Sin imágenes → ${title} [ID: ${externalId}]`);
      continue;
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
      (img: any) =>
        `https://static.nb.com.ar/i/nb_${slug}_size_h120_${img.checksum}`
    );

    const imageUrlsHD = await subirImagenesAUploadThing(urlsHD);
    const imageUrlsThumb = await subirImagenesAUploadThing(urlsThumb);

    const atributos: Record<string, string> =
      Array.isArray(data?.attributes) && data.attributes.length
        ? Object.fromEntries(
            data.attributes
              .filter((a: any) => a?.name && a?.value)
              .map((a: any) => [a.name, a.value])
          )
        : {};

    try {
      await prisma.fichaProducto.upsert({
        where: { productExternalId: externalId },
        update: {
          description: data?.description?.value ?? null,
          originalImages,
          imageUrlsHD,
          imageUrlsThumb,
          atributos,
        },
        create: {
          productExternalId: externalId,
          description: data?.description?.value ?? null,
          originalImages,
          imageUrlsHD,
          imageUrlsThumb,
          atributos,
        },
      });

      console.log(`✅ FichaProducto creada: ${title}`);
    } catch (err) {
      console.error(`❌ Error al guardar ficha de ${title}:`, err);
      fallidos.push(`${title} [ID: ${externalId}]`);
    }
  }

  if (fallidos.length > 0) {
    console.warn("\n🚫 Productos fallidos:");
    for (const item of fallidos) {
      console.warn("⛔", item);
    }
  }

  await prisma.$disconnect();
}

seedFichaProducto().catch((e) => {
  console.error("❌ Error general:", e);
  process.exit(1);
});
