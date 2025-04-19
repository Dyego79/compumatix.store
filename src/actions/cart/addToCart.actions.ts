// src/actions/addToCart.ts
import { defineAction } from "astro:actions";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const addToCart = defineAction({
  accept: "json",
  input: z.object({
    sessionId: z.string(),
    productId: z.string(),
    quantity: z.number().min(1).default(1),
  }),
  handler: async ({ sessionId, productId, quantity }) => {
    await prisma.cartSession.upsert({
      where: { id: sessionId },
      create: { id: sessionId },
      update: {},
    });

    await prisma.cartItem.upsert({
      where: { sessionId_productId: { sessionId, productId } },
      create: { sessionId, productId, quantity },
      update: {
        quantity: { increment: quantity },
      },
    });

    return { success: true };
  },
});
