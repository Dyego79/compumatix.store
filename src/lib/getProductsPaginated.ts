import { prisma } from "@/lib/db";

export async function getProductsPaginated({
  page = 1,
  limit = 12,
  query = "",
}: {
  page?: number;
  limit?: number;
  query?: string;
}) {
  const currentPage = page <= 0 ? 1 : page;

  const totalRecords = await prisma.product.count({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
  });

  const totalPages = Math.ceil(totalRecords / limit);

  if (currentPage > totalPages) {
    return {
      products: [],
      totalPages,
    };
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
    skip: (currentPage - 1) * limit,
    take: limit,
    orderBy: { title: "asc" },
    include: {
      brand: true,
      category: true,
    },
  });

  return {
    products,
    totalPages,
  };
}
