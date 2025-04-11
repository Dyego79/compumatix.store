import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearDatabase() {
  console.time("🧹 Borrando todas las tablas");

  // Borra en el orden correcto por relaciones
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();

  console.log("✅ Base de datos limpiada.");
  await prisma.$disconnect();
  console.timeEnd("🧹 Borrando todas las tablas");
}

clearDatabase().catch((e) => {
  console.error("❌ Error al limpiar la base de datos:", e);
  prisma.$disconnect();
  process.exit(1);
});
