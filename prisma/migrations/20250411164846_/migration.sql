/*
  Warnings:

  - A unique constraint covering the columns `[productExternalId]` on the table `FichaProducto` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "FichaProducto_productExternalId_key" ON "FichaProducto"("productExternalId");
