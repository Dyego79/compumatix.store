import { defineAction } from "astro:actions";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const getProductBySlug = defineAction({
  accept: "json",
  input: z.string(),
  handler: async (slug: string) => {
    const product = await prisma.product.findUnique({
      where: { slug },
    });

    if (!product) {
      throw new Error(`Product with slug "${slug}" not found`);
    }

    return {
      product,
    };
  },
});
