-- CreateTable
CREATE TABLE "FichaProducto" (
    "id" TEXT NOT NULL,
    "productExternalId" INTEGER NOT NULL,
    "description" TEXT,
    "images" JSONB,
    "atributos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichaProducto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FichaProducto" ADD CONSTRAINT "FichaProducto_productExternalId_fkey" FOREIGN KEY ("productExternalId") REFERENCES "Product"("externalId") ON DELETE RESTRICT ON UPDATE CASCADE;
