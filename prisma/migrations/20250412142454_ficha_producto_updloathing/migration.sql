/*
  Warnings:

  - You are about to drop the column `images` on the `FichaProducto` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FichaProducto" DROP COLUMN "images",
ADD COLUMN     "imageUrlsHD" JSONB,
ADD COLUMN     "imageUrlsThumb" JSONB,
ADD COLUMN     "originalImages" JSONB;
