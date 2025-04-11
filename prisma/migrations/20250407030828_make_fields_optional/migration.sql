/*
  Warnings:

  - The primary key for the `Product` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[externalId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "initialB" INTEGER,
ADD COLUMN     "initialC" INTEGER;

-- AlterTable
ALTER TABLE "Product" DROP CONSTRAINT "Product_pkey",
ADD COLUMN     "amountStock" INTEGER,
ADD COLUMN     "cotizacion" DECIMAL(10,2),
ADD COLUMN     "externalId" INTEGER,
ADD COLUMN     "finalPrice" DECIMAL(10,2),
ADD COLUMN     "highAverage" INTEGER,
ADD COLUMN     "iva" DECIMAL(5,2),
ADD COLUMN     "lengthAverage" INTEGER,
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "stock" TEXT,
ADD COLUMN     "utility" DECIMAL(10,2),
ADD COLUMN     "weightAverage" INTEGER,
ADD COLUMN     "widthAverage" INTEGER,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Product_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_externalId_key" ON "Product"("externalId");
