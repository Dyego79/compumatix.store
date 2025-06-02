// utils/uploadthing.ts
import { UTApi } from "uploadthing/server";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";

const utapi = new UTApi({ token: process.env.UPLOADTHING_SECRET! });

export async function subirImagenAUploadThing(
  url: string
): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) return null;

    const filename = path.basename(new URL(url).pathname);
    const tempPath = path.join(tmpdir(), filename);

    await pipeline(res.body, fs.createWriteStream(tempPath));

    const buffer = fs.readFileSync(tempPath);
    const blob = new Blob([buffer]) as Blob & { name: string };
    blob.name = filename;

    const result = await utapi.uploadFiles([blob]);

    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath); // Evita error ENOENT
    }

    // ✅ Usa la URL recomendada por UploadThing v9+
    return result?.[0]?.data?.ufsUrl ?? null;
  } catch (err) {
    console.error(`❌ Error subiendo ${url}`, err);
    return null;
  }
}
