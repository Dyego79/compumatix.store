import { createUploadthing, type FileRouter } from "uploadthing/server";

const f = createUploadthing();

export const ourFileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      // Implementa tu lógica de autenticación aquí
      return { userId: "usuario_ejemplo" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload completo para el usuario:", metadata.userId);
      console.log("URL del archivo:", file.ufsUrl);
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
