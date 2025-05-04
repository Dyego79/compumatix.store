import { obtenerToken } from "@/utils/apiclient";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import pLimit from "p-limit";

const prisma = new PrismaClient();
const API_URL = "https://api.nb.com.ar/v1/";
const CHUNK_SIZE = 30; // Aumentar si tu entorno lo permite
const CONCURRENCY_LIMIT = 5; // Máximo de chunks en paralelo

interface ProductAPI {
  id: number;
  stock: string;
  amountStock: number;
  price?: { value: number; finalPrice: number; iva: number };
  cotizacion?: number;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function fetchJSON(url: string, token: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Error al obtener: ${url}`);
  return res.json();
}

async function actualizarStockYPrecio() {
  console.time("🛠 Actualización");

  const errores: string[] = [];
  let totalActualizados = 0;
  let totalFallidos = 0;

  const token = await obtenerToken();
  const productosApi = (await fetchJSON(API_URL, token)) as ProductAPI[];

  const productosLocales = await prisma.product.findMany({
    where: { proveedorIt: "NB" },
    select: { id: true, externalId: true },
  });

  const productosMap = new Map<number, string>();
  for (const p of productosLocales) {
    if (p.externalId !== null) {
      productosMap.set(p.externalId, p.id);
    }
  }

  const productosFiltrados = productosApi.filter((p) => productosMap.has(p.id));
  const chunks = chunkArray(productosFiltrados, CHUNK_SIZE);

  const limit = pLimit(CONCURRENCY_LIMIT);

  await Promise.allSettled(
    chunks.map((chunk) =>
      limit(async () => {
        const updates = chunk.map((item) =>
          prisma.product.update({
            where: { externalId: item.id },
            data: {
              stock: item.stock,
              amountStock: item.amountStock,
              price: item.price?.value ?? 0,
              finalPrice: item.price?.finalPrice ?? 0,
              iva: item.price?.iva ?? 0,
              cotizacion: item.cotizacion ?? null,
            },
          })
        );

        try {
          console.log(
            `🌀 Ejecutando transacción de ${updates.length} productos...`
          );
          await prisma.$transaction(updates);
          totalActualizados += updates.length;
          console.log(
            `✔️ Chunk actualizado. Total actualizados: ${totalActualizados}`
          );
        } catch (error: any) {
          const msg = `❌ Error en $transaction(): ${error.message || error}`;
          console.error(msg);
          errores.push(msg);
          totalFallidos += updates.length;
        }
      })
    )
  );

  if (errores.length > 0) {
    fs.writeFileSync("errores-actualizacion.log", errores.join("\n"), "utf-8");
    console.log("📄 Errores guardados en errores-actualizacion.log");
  }

  console.log(`\n🔁 Total actualizados: ${totalActualizados}`);
  console.log(`❌ Total fallidos: ${totalFallidos}`);

  await prisma.$disconnect();
  console.timeEnd("🛠 Actualización");
}

actualizarStockYPrecio().catch((e) => {
  console.error("❌ Error en actualización:", e);
  prisma.$disconnect();
  process.exit(1);
});
