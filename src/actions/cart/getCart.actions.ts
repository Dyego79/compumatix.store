// src/actions/getCart.ts
import { defineAction } from "astro:actions";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const getCart = defineAction({
  accept: "json",
  input: z.string(),
  handler: async (sessionId) => {
    const items = await prisma.cartItem.findMany({
      where: { sessionId },
      include: {
        product: {
          include: {
            brand: true,
            category: true,
            fichaProducto: true,
          },
        },
      },
    });

    return { items };
  },
});
