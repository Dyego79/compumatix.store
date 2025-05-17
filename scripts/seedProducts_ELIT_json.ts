import "dotenv/config";
import { subirImagenAUploadThing } from "@/lib/uploadthingProduct";
import fs from "fs/promises";
import path from "path";

let allExternalIds: number[] = [];

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

async function seedProducts() {
  const limit = 100;
  let offset = 1;
  let totalCollected = 0;
  const allProducts: any[] = [];

  while (true) {
    const data = await fetchProductosElit(limit, offset);

    if (!data.resultado || data.resultado.length === 0) {
      console.log("\u2705 No hay m\u00e1s productos para importar.");
      break;
    }

    console.log(`\uD83D\uDE80 Importando productos: offset ${offset}`);

    for (const item of data.resultado) {
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

        const cleanSubCategoria = sub_categoria?.trim();
        const cleanCategoria = categoria?.trim();
        const categoryName = cleanSubCategoria || cleanCategoria;

        let newImageUrl = imagenes?.[0] ?? "";

        if (newImageUrl && !newImageUrl.includes("images.elit.com.ar")) {
          try {
            const uploaded = await subirImagenAUploadThing(newImageUrl);
            if (uploaded) newImageUrl = uploaded;
          } catch {}
        }

        allProducts.push({
          id,
          title: nombre,
          slug: uri,
          sku: codigo_producto,
          category: categoryName,
          brand: marca,
          mainImage: newImageUrl,
          warranty: garantia?.toString() ?? null,
          attributes: atributos?.length ? atributos : null,
          amountStock: stock_total,
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
          deleted: stock_total === 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`\u274C Error procesando producto ID ${id}:`, error);
      }
    }

    totalCollected += data.resultado.length;
    offset += limit;
  }

  console.log(`\uD83C\uDFC1 Seed finalizado. Total productos recolectados: ${totalCollected}`);

  const outputPath = path.resolve("./productos-elit.json");
  await fs.writeFile(outputPath, JSON.stringify(allProducts, null, 2), "utf8");
  console.log(`\u2705 Archivo JSON guardado en: ${outputPath}`);
}

seedProducts().catch(console.error);
