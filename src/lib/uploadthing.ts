// lib/uploadthing.ts
import { createUploadthing, type FileRouter } from "uploadthing/server";

const f = createUploadthing();

export const uploadRouter = {
  productImage: f({ image: { maxFileSize: "8MB" } }).onUploadComplete(
    async ({ file }) => {
      console.log("Archivo subido:", file.url);
    }
  ),
} satisfies FileRouter;
