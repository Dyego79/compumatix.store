// src/actions/getFichaProducto.ts

import { defineAction } from "astro:actions";
import { z } from "zod";
import { prisma } from "@/lib/db";

type FichaProducto = {
  description?: string;
  images?: { checksum: string; [key: string]: any }[];
  attributes?: { name: string; value: string }[];
};

export const getFichaProducto = defineAction({
  accept: "json",
  input: z.number(),
  handler: async (externalId): Promise<{ ficha: FichaProducto | null }> => {
    const ficha = await prisma.fichaProducto.findUnique({
      where: {
        productExternalId: externalId,
      },
    });

    if (!ficha) {
      return { ficha: null };
    }

    return {
      ficha: {
        description: ficha.description ?? undefined,
        images: ficha.images as any[],
        attributes: ficha.atributos as any[],
      },
    };
  },
});
