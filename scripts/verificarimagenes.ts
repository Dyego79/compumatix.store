import { fetchLiveData } from "@/lib/api";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verificarImagenes() {
  const productos = await prisma.product.findMany({
    select: { externalId: true, title: true },
    where: {
      externalId: {
        not: null,
      },
    },
  });

  console.log(`📦 Total de productos en base: ${productos.length}\n`);

  for (const producto of productos) {
    const { externalId, title } = producto;

    if (externalId === null) {
      console.warn(`⛔ Sin ID externo → ${title}`);
      continue;
    }
    const data = await fetchLiveData(externalId);
    const images = Array.isArray(data?.images) ? data.images : [];

    if (images.length === 0) {
      console.warn(`⛔ Sin imágenes → ${title} [ID: ${externalId}]`);
      console.log("🧪 images:", data?.images);
    } else {
      console.log(
        `✅ ${title} [ID: ${externalId}] → ${images.length} imágenes`
      );
      console.table(
        images.map((img: any) => ({
          order: img.order,
          checksum: img.checksum,
          urlHD: `https://static.nb.com.ar/i/nb__ver_${img.checksum}`,
        }))
      );
    }

    console.log(
      "------------------------------------------------------------\n"
    );
  }

  await prisma.$disconnect();
}

verificarImagenes().catch((err) => {
  console.error("❌ Error en verificación de imágenes:", err);
  prisma.$disconnect();
  process.exit(1);
});
