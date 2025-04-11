// src/actions/getFichaProducto.ts

import { defineAction } from "astro:actions";
import { z } from "zod";
import { obtenerToken } from "@/utils/apiclient";

type FichaProducto = {
  title: string;
  sku: string;
  id: number;
  description: { value: string };
  attributes: { name: string; value: string }[];
  images: { checksum: string }[];
  // ... agregá lo que más uses
};

export const getFichaProducto = defineAction({
  accept: "json",
  input: z.number(),
  handler: async (externalId): Promise<{ ficha: FichaProducto }> => {
    const token = await obtenerToken();

    const res = await fetch(`https://api.nb.com.ar/v1/item/${externalId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`No se pudo obtener la ficha del producto ${externalId}`);
    }

    const data = await res.json();
    return { ficha: data };
  },
});
