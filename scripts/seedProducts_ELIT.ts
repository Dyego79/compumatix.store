import postgres from "postgres";
import "dotenv/config";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";
import { slugify } from "@/utils/slugify";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { ssl: "require" });

let nextBrandId = 5000;
let nextCategoryId = 5000;

async function getOrCreateBrand(marca: string) {
  const existing = await sql`
    SELECT id FROM "Brand" WHERE name = ${marca}
  `.then((res) => res[0]);

  if (existing) return existing.id;

  const max = await sql`
    SELECT MAX(id) AS max_id FROM "Brand"
  `.then((res) => res[0]?.max_id ?? 0);

  nextBrandId = Math.max(nextBrandId, max + 1);

  const inserted = await sql`
    INSERT INTO "Brand" (id, name)
    VALUES (${nextBrandId}, ${marca})
    RETURNING id
  `.then((res) => res[0]);

  nextBrandId++;
  return inserted.id;
}


async function getOrCreateCategory(name: string) {
  const normalized = name.trim().toLowerCase();
  const slug = slugify(normalized);

  const existing = await sql`
    SELECT id FROM "Category" WHERE name_normalized = ${normalized}
  `.then((res) => res[0]);

  if (existing) return existing.id;

  const inserted = await sql`
    INSERT INTO "Category" (name, name_normalized, slug)
    VALUES (${name.trim()}, ${normalized}, ${slug})
    RETURNING id
  `.then((res) => res[0]);

  return inserted.id;
}

async function fetchProductosElit(limit = 100, offset = 1) {
  const headers = new Headers();
  headers.append("Content-Type", "application/json");

  const body = JSON.stringify({
    user_id: process.env.ELIT_USER_ID,
    token: process.env.ELIT_TOKEN,
  });

  const response = await fetch(
    `https://clientes.elit.com.ar/v1/api/productos?limit=${limit}&offset=${offset}`,
    {
      method: "POST",
      headers,
      body,
      redirect: "follow",
    }
  );

  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data;
  } catch (error) {
    console.error("\u274C Error parseando respuesta:", text);
    throw error;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedProducts() {
  const limit = 100;
  let offset = 1;
  let totalInserted = 0;
  let allExternalIds: number[] = [];

  while (true) {
    const data = await fetchProductosElit(limit, offset);

    if (!data.resultado || data.resultado.length === 0) {
      console.log("\u2705 No hay m\u00e1s productos para importar.");
      break;
    }

    console.log(`\uD83D\uDE80 Importando productos: offset ${offset}`);

    const insertBatch: any[] = [];

    await Promise.all(
      data.resultado.map(async (item: any) => {
        const {
          id,
          codigo_producto,
          nombre,
          marca,
          precio,
          cotizacion,
          pvp_ars,
          iva,
          uri,
          imagenes,
          nivel_stock,
          stock_total,
          garantia,
          atributos,
          dimensiones,
          markup,
          sub_categoria,
          categoria,
        } = item;

        try {
          allExternalIds.push(id);

          const existingProduct = await sql`
            SELECT id FROM "Product" WHERE "externalId" = ${id}
          `.then((res) => res[0]);

          const brandId = await getOrCreateBrand(marca);
          const cleanSubCategoria = sub_categoria?.trim();
          const cleanCategoria = categoria?.trim();
          const categoryName = cleanSubCategoria || cleanCategoria;
          const categoryId = await getOrCreateCategory(categoryName);

          const parsedStock = Number(stock_total);
          const isDeleted = isNaN(parsedStock) || parsedStock === 0;

          if (existingProduct) {
            console.log(`🔁 Actualizando producto ${id} | stock_total: ${stock_total} => deleted: ${isDeleted}`);
            await sql`
              UPDATE "Product"
              SET
                "price" = ${precio ? Number(precio.toFixed(2)) : 0},
                "finalPrice" = ${pvp_ars ? Number(pvp_ars.toFixed(2)) : 0},
                "iva" = ${iva ? Number(iva.toFixed(2)) : 0},
                "cotizacion" = ${cotizacion ? Number(cotizacion.toFixed(2)) : null},
                "amountStock" = ${parsedStock},
                "deleted" = ${isDeleted},
                "updatedAt" = NOW()
              WHERE "externalId" = ${id}
            `;
          } else {
            let newImageUrl = imagenes?.[0] ?? "";

            if (newImageUrl && !newImageUrl.includes("images.elit.com.ar")) {
              try {
                const uploaded = await subirImagenAUploadThing(newImageUrl);
                if (uploaded) newImageUrl = uploaded;
              } catch {}
            }

            insertBatch.push({
              id: sql`gen_random_uuid()`,
              title: nombre,
              slug: uri,
              sku: codigo_producto,
              categoryId,
              brandId,
              mainImage: newImageUrl,
              mainImageExp: null,
              warranty: garantia?.toString() ?? null,
              attributes: atributos?.length ? JSON.stringify(atributos) : null,
              amountStock: parsedStock,
              cotizacion: cotizacion ? Number(cotizacion.toFixed(2)) : null,
              finalPrice: pvp_ars ? Number(pvp_ars.toFixed(2)) : null,
              price: precio ? Number(precio.toFixed(2)) : null,
              iva: iva ? Number(iva.toFixed(2)) : null,
              stock: nivel_stock ?? null,
              highAverage: null,
              lengthAverage: dimensiones?.largo ? Math.round(dimensiones.largo) : null,
              widthAverage: dimensiones?.ancho ? Math.round(dimensiones.ancho) : null,
              weightAverage: dimensiones?.alto ? Math.round(dimensiones.alto) : null,
              utility: markup ? Number((markup * 100).toFixed(2)) : null,
              externalId: id,
              proveedorIt: "elit",
              deleted: isDeleted,
              createdAt: sql`NOW()`,
              updatedAt: sql`NOW()`
            });
          }
        } catch (error) {
          console.error(`\u274C Error procesando producto ID ${id}:`, error);
        }
      })
    );

    if (insertBatch.length > 0) {
      try {
        await sql`
          INSERT INTO "Product" ${sql(insertBatch)}
        `;
        console.log(`\u2705 Insertados ${insertBatch.length} productos nuevos.`);
        totalInserted += insertBatch.length;
      } catch (error) {
        console.error("\u274C Error insertando nuevos productos:", error);
      }
    }

    offset += limit;
    await delay(2000); // ⏳ Esperar 1 segundo antes de la próxima página
  }

  console.log(`\uD83C\uDFC1 Seed finalizado. Total insertados o actualizados: ${totalInserted}`);

  console.log("\uD83E\uDDF9 Realizando soft-delete de productos no encontrados en Elit...");

  const { count } = await sql`
    UPDATE "Product"
    SET "deleted" = true
    WHERE "proveedorIt" = 'elit'
      AND NOT ("externalId" = ANY(${Array.from(allExternalIds)}))
    RETURNING id;
  `.then((res) => ({ count: res.length }));

  console.log(`\u2705 Soft-delete completado. Productos marcados como deleted: ${count}`);
}

seedProducts()
  .catch(console.error)
  .finally(() => sql.end());

/* import postgres from "postgres";
import "dotenv/config";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { ssl: "require" });

let nextBrandId = 5000;
let nextCategoryId = 5000;

async function getOrCreateBrand(marca: string) {
  const existing = await sql`
    SELECT id FROM "Brand" WHERE name = ${marca}
  `.then((res) => res[0]);

  if (existing) return existing.id;

  const max = await sql`
    SELECT MAX(id) AS max_id FROM "Brand"
  `.then((res) => res[0]?.max_id ?? 0);

  nextBrandId = Math.max(nextBrandId, max + 1);

  const inserted = await sql`
    INSERT INTO "Brand" (id, name)
    VALUES (${nextBrandId}, ${marca})
    RETURNING id
  `.then((res) => res[0]);

  nextBrandId++;
  return inserted.id;
}

async function getOrCreateCategory(name: string) {
  const normalized = name.trim().toLowerCase();

  const existing = await sql`
    SELECT id FROM "Category" WHERE LOWER(TRIM(name)) = ${normalized}
  `.then((res) => res[0]);

  if (existing) return existing.id;

  const inserted = await sql`
    INSERT INTO "Category" (name)
    VALUES (${name.trim()})
    RETURNING id
  `.then((res) => res[0]);

  return inserted.id;
}

async function fetchProductosElit(limit = 100, offset = 1) {
  const headers = new Headers();
  headers.append("Content-Type", "application/json");

  const body = JSON.stringify({
    user_id: process.env.ELIT_USER_ID,
    token: process.env.ELIT_TOKEN,
  });

  const response = await fetch(
    `https://clientes.elit.com.ar/v1/api/productos?limit=${limit}&offset=${offset}`,
    {
      method: "POST",
      headers,
      body,
      redirect: "follow",
    }
  );

  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data;
  } catch (error) {
    console.error("❌ Error parseando respuesta:", text);
    throw error;
  }
}

async function seedProducts() {
  const limit = 100;
  let offset = 1;
  let totalInserted = 0;
  let allExternalIds: number[] = [];

  while (true) {
    const data = await fetchProductosElit(limit, offset);

    if (
      data.codigo !== 200 ||
      !Array.isArray(data.resultado) ||
      data.resultado.length === 0
    ) {
      console.log("✅ No hay más productos para importar.");
      break;
    }

    console.log(`🚀 Importando productos: offset ${offset}`);

    const insertBatch: any[] = [];

    await Promise.all(
      data.resultado.map(async (item: any) => {
        const {
          id,
          codigo_producto,
          nombre,
          marca,
          precio,
          cotizacion,
          pvp_ars,
          iva,
          uri,
          imagenes,
          nivel_stock,
          stock_total,
          garantia,
          atributos,
          dimensiones,
          markup,
          sub_categoria,
          categoria,
        } = item;

        try {
          const brandId = await getOrCreateBrand(marca);
          const cleanSubCategoria = sub_categoria?.trim();
          const cleanCategoria = categoria?.trim();
          const categoryName =
            cleanSubCategoria && cleanSubCategoria.length > 0
              ? cleanSubCategoria
              : cleanCategoria;
          const categoryId = await getOrCreateCategory(categoryName);

          let newImageUrl = imagenes?.[0] ?? "";

          if (newImageUrl) {
            if (newImageUrl.includes("images.elit.com.ar")) {
              // Imagen ya de Elit
            } else {
              try {
                const uploaded = await subirImagenAUploadThing(newImageUrl);
                if (uploaded) {
                  newImageUrl = uploaded;
                }
              } catch {
                // Si falla, se mantiene la original
              }
            }
          }

          insertBatch.push({
            id: sql`gen_random_uuid()`,
            title: nombre,
            slug: uri,
            sku: codigo_producto,
            categoryId,
            brandId,
            mainImage: newImageUrl,
            mainImageExp: null,
            warranty: garantia?.toString() ?? null,
            attributes: atributos?.length ? JSON.stringify(atributos) : null,
            amountStock: stock_total,
            cotizacion: cotizacion ? Number(cotizacion.toFixed(2)) : null,
            finalPrice: pvp_ars ? Number(pvp_ars.toFixed(2)) : null,
            price: precio ? Number(precio.toFixed(2)) : null,
            iva: iva ? Number(iva.toFixed(2)) : null,
            stock: nivel_stock ?? null,
            highAverage: null,
            lengthAverage: dimensiones?.largo
              ? Math.round(dimensiones.largo)
              : null,
            widthAverage: dimensiones?.ancho
              ? Math.round(dimensiones.ancho)
              : null,
            weightAverage: dimensiones?.alto
              ? Math.round(dimensiones.alto)
              : null,
            utility: markup ? Number((markup * 100).toFixed(2)) : null,
            externalId: id,
            proveedorIt: "elit",
            deleted: false,
            createdAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
          });

          allExternalIds.push(id);
        } catch (error) {
          console.error(`❌ Error procesando producto ID ${id}:`, error);
        }
      })
    );

    if (insertBatch.length > 0) {
      try {
        await sql`
          INSERT INTO "Product" ${sql(insertBatch)}
          ON CONFLICT ("externalId") DO UPDATE SET
            "categoryId" = EXCLUDED."categoryId",
            "brandId" = EXCLUDED."brandId",
            "title" = EXCLUDED."title",
            "slug" = EXCLUDED."slug",
            "sku" = EXCLUDED."sku",
            "mainImage" = EXCLUDED."mainImage",
            "amountStock" = EXCLUDED."amountStock",
            "cotizacion" = EXCLUDED."cotizacion",
            "finalPrice" = EXCLUDED."finalPrice",
            "price" = EXCLUDED."price",
            "stock" = EXCLUDED."stock",
            "iva" = EXCLUDED."iva",
            "utility" = EXCLUDED."utility",
            "attributes" = EXCLUDED."attributes",
            "warranty" = EXCLUDED."warranty",
            "lengthAverage" = EXCLUDED."lengthAverage",
            "widthAverage" = EXCLUDED."widthAverage",
            "weightAverage" = EXCLUDED."weightAverage",
            "updatedAt" = NOW(),
            "deleted" = false;
        `;
        console.log(
          `✅ Insertados o actualizados ${insertBatch.length} productos.`
        );
        totalInserted += insertBatch.length;
      } catch (error) {
        console.error(`❌ Error insertando batch:`, error);
      }
    }

    offset += limit;
  }

  console.log(
    `🏁 Seed finalizado. Total productos insertados o actualizados: ${totalInserted}`
  );

  // 🔥 Soft delete de productos que ya no están
  console.log(
    "🧹 Realizando soft-delete de productos no encontrados en Elit..."
  );

  const { count } = await sql`
    UPDATE "Product"
    SET "deleted" = true
    WHERE "proveedorIt" = 'elit'
      AND NOT ("externalId" = ANY(${Array.from(allExternalIds)}))
      RETURNING id;
  `.then((res) => ({ count: res.length }));

  console.log(
    `✅ Soft-delete completado. Productos marcados como deleted: ${count}`
  );
}

seedProducts()
  .catch(console.error)
  .finally(() => sql.end()); */