// scripts/seedFichaProducto_Elit.ts
import postgres from "postgres";
import "dotenv/config";
import { load } from "cheerio";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { ssl: "require" });

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function extraerURLReal(nextImageSrc: string): string {
  const match = nextImageSrc.match(/url=([^&]+)/);
  if (!match) return "";
  return decodeURIComponent(match[1]);
}

function normalizeArrayField(field: any): string[] {
  if (Array.isArray(field)) return field;
  try {
    let parsed = JSON.parse(field);
    if (Array.isArray(parsed)) return parsed;
    parsed = JSON.parse(parsed); // por si viene doble string
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignorar errores
  }
  return []; // fallback seguro
}

async function seedFichaProductoBySlug(externalId: number, slug: string) {
  try {
    const res = await fetch(`https://www.elit.com.ar/producto/${slug}`);
    const html = await res.text();
    const $ = load(html);

    // Descripción corta (título)
    const description = $("h1.text-xl").text().trim();

    // Atributos
    const atributos: Record<string, string>[] = [];
    $("ul.list-disc li").each((_, li) => {
      const texto = $(li).text();
      const [clave, valor] = texto.split(/:(?=\s*[^\s])/); // intenta dividir por ":"
      if (clave && valor) {
        atributos.push({ [clave.trim()]: valor.trim() });
      } else {
        const strong = $(li).find("strong").text().trim();
        const key = $(li)
          .clone()
          .children()
          .remove()
          .end()
          .text()
          .trim()
          .replace(/[:\s]*$/, "");
        if (key && strong) atributos.push({ [key]: strong });
      }
    });

    // Imágenes
    const hdSrcs = $(".embla__slide img")
      .map((_, el) => $(el).attr("src"))
      .get()
      .map(extraerURLReal)
      .filter((url) => url.startsWith("https://"));

    const thumbSrcs = $(".flex-none img")
      .map((_, el) => $(el).attr("src"))
      .get()
      .map(extraerURLReal)
      .filter((url) => url.startsWith("https://"));

    // Verificamos si ya existen para evitar volver a subir
    const ficha = await sql`
      SELECT "imageUrlsHD", "imageUrlsThumb"
      FROM "FichaProducto"
      WHERE "productExternalId" = ${externalId}
    `.then((r) => r[0]);

    let hdUrls = ficha?.imageUrlsHD ?? null;
    let thumbUrls = ficha?.imageUrlsThumb ?? null;

    if (!hdUrls || hdUrls.length === 0) {
      hdUrls = await Promise.all(
        hdSrcs.map(async (src) => {
          try {
            return await subirImagenAUploadThing(src);
          } catch (e) {
            console.error(`❌ Error subiendo ${src}`, e);
            return null;
          }
        })
      ).then((r) => r.filter(Boolean));
    }

    if (!thumbUrls || thumbUrls.length === 0) {
      thumbUrls = await Promise.all(
        thumbSrcs.map(async (src) => { 
          try {
            return await subirImagenAUploadThing(src);
          } catch (e) {
            console.error(`❌ Error subiendo ${src}`, e);
            return null;
          }
        })
      ).then((r) => r.filter(Boolean));
    }
    const imageUrlsHD = normalizeArrayField(hdUrls);
    const imageUrlsThumb = normalizeArrayField(thumbUrls);
    const originalImages = normalizeArrayField(hdSrcs);
    await sql`
  INSERT INTO "FichaProducto" (
    id,
    "productExternalId",
    description,
    atributos,
    "imageUrlsHD",
    "imageUrlsThumb",
    "originalImages",
    "createdAt"
  )
  VALUES (
    gen_random_uuid(),
    ${externalId},
    ${description},
    ${sql.json(atributos)},
    ${sql.json(imageUrlsHD)},
    ${sql.json(imageUrlsThumb)}, 
    ${sql.json(originalImages)},
    NOW()
  )
    ON CONFLICT ("productExternalId") DO UPDATE SET
    description = EXCLUDED.description,
    atributos = EXCLUDED.atributos,
    "imageUrlsHD" = EXCLUDED."imageUrlsHD",
    "imageUrlsThumb" = EXCLUDED."imageUrlsThumb",
    "originalImages" = EXCLUDED."originalImages";

`;

    console.log(`✅ FichaProducto actualizada: ${externalId}`);
  } catch (error: any) {
    console.error(`❌ Error con ${externalId}:`, error.message);
  }
}

async function main() {
  console.time("⏱ FichaProducto");

  const productos = await sql`
    SELECT "externalId", "slug"
    FROM "Product"
    WHERE "proveedorIt" = 'elit' AND "externalId" IS NOT NULL;
  `;

  const chunks = chunkArray(productos, 10);

  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map((p) => seedFichaProductoBySlug(p.externalId, p.slug))
    );
  }

  await sql.end();
  console.timeEnd("⏱ FichaProducto");
}

main().catch((e) => {
  console.error("❌ Error general:", e);
  sql.end();
  process.exit(1);
});
