import postgres from "postgres";
import "dotenv/config";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";
import { slugify } from "@/utils/slugify";

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { ssl: "require" });

// Normaliza nombre de categoría
function normalizeCategoryName(name: string) {
  return name.trim().toLowerCase();
}

async function getOrCreateBrand(marca: string) {
  const existing = await sql`
    SELECT id FROM "Brand" WHERE name = ${marca}
  `.then((res) => res[0]);

  if (existing) return existing.id;

  const inserted = await sql`
    INSERT INTO "Brand" (name)
    VALUES (${marca})
    RETURNING id
  `.then((res) => res[0]);

  return inserted.id;
}

async function getOrCreateCategory(name: string) {
  const trimmedName = name.trim();
  const normalized = normalizeCategoryName(trimmedName);

  const existing = await sql`
    SELECT id FROM "Category"
    WHERE LOWER(TRIM(name)) = ${normalized}
  `.then((res) => res[0]);

  if (existing) return existing.id;

  const slug = slugify(trimmedName);

  const inserted = await sql`
    INSERT INTO "Category" (name, slug)
    VALUES (${trimmedName}, ${slug})
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
    }
  );

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("❌ Error parseando respuesta:", text);
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
          allExternalIds.push(id);

          const existingProduct = await sql`
            SELECT id, "mainImage" FROM "Product" WHERE "externalId" = ${id}
          `.then((res) => res[0]);

          const brandId = await getOrCreateBrand(marca);
          const categoryName = sub_categoria?.trim() || categoria?.trim();
          const categoryId = await getOrCreateCategory(categoryName);

          const parsedStock = Number(stock_total);
          const isDeleted = isNaN(parsedStock) || parsedStock === 0;

          let newImageUrl = imagenes?.[0] ?? "";

          // Si el producto ya tiene mainImage, no volver a subir imagen
          if (existingProduct?.mainImage) {
            newImageUrl = existingProduct.mainImage;
          } else if (newImageUrl.includes("images.elit.com.ar")) {
            try {
              const uploaded = await subirImagenAUploadThing(newImageUrl);
              if (uploaded) newImageUrl = uploaded;
            } catch (err: any) {
              if (err.message?.includes("File already exists")) {
                console.warn("⚠️ Imagen ya subida previamente a UploadThing.");
              } else {
                console.error("❌ Error subiendo imagen a UploadThing:", err);
              }
            }
          }


          if (existingProduct) {
            console.log(`🔁 Actualizando producto ${id}`);
            await sql`
              UPDATE "Product"
              SET
                "price" = ${precio ? Number(precio.toFixed(2)) : 0},
                "finalPrice" = ${pvp_ars ? Number(pvp_ars.toFixed(2)) : 0},
                "iva" = ${iva ? Number(iva.toFixed(2)) : 0},
                "cotizacion" = ${cotizacion ? Number(cotizacion.toFixed(2)) : null},
                "amountStock" = ${parsedStock},
                "mainImage" = ${newImageUrl},
                "deleted" = ${isDeleted},
                "updatedAt" = NOW()
              WHERE "externalId" = ${id}
            `;
          } else {
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
              updatedAt: sql`NOW()`,
            });
          }
        } catch (error) {
          console.error(`❌ Error procesando producto ID ${id}:`, error);
        }
      })
    );

    if (insertBatch.length > 0) {
      try {
        await sql`
          INSERT INTO "Product" ${sql(insertBatch)}
        `;
        console.log(`✅ Insertados ${insertBatch.length} productos nuevos.`);
        totalInserted += insertBatch.length;
      } catch (error) {
        console.error("❌ Error insertando nuevos productos:", error);
      }
    }

    offset += limit;
    await delay(2000);
  }

  console.log(`🏁 Seed finalizado. Total insertados o actualizados: ${totalInserted}`);
  console.log("🧹 Realizando soft-delete de productos no encontrados en Elit...");

  const { count } = await sql`
    UPDATE "Product"
    SET "deleted" = true
    WHERE "proveedorIt" = 'elit'
      AND NOT ("externalId" = ANY(${Array.from(allExternalIds)}))
    RETURNING id;
  `.then((res) => ({ count: res.length }));

  console.log(`✅ Soft-delete completado. Productos marcados como deleted: ${count}`);
}

seedProducts()
  .catch(console.error)
  .finally(() => sql.end());
