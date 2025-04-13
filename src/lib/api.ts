// lib/api.ts

import { Prisma } from "@prisma/client";
import { obtenerToken } from "../utils/apiclient";
import { db } from "../utils/db";
import { extractIdFromSlug } from "./slug";

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({
    where: { slug },
  });
}

export async function getAllProducts(
  page: number = 1,
  pageSize: number = 10,
  busqueda: string = ""
) {
  const skip = (page - 1) * pageSize;

  const where: Prisma.ProductWhereInput = busqueda
    ? {
        title: {
          contains: busqueda,
          mode: Prisma.QueryMode.insensitive,
        },
      }
    : {};

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      skip,
      take: pageSize,
    }),
    db.product.count({ where }),
  ]);

  return { products, total };
}

/* export async function getProductBySlug(slug: string) {
  const id = extractIdFromSlug(slug);
  return await db.product.findUnique({ where: { externalId: id } });
} */

export async function fetchLiveData(id: number) {
  const token = await obtenerToken();
  if (!token) {
    return [];
  }

  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    redirect: "follow",
  };
  const res = await fetch(
    `https://api.nb.com.ar/v1/item/${id}`,
    requestOptions
  );
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchLiveDataSinToken(id: number, token?: string) {
  if (!token) {
    token = await obtenerToken(); // fallback si no se pasa
  }

  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    redirect: "follow",
  };

  const res = await fetch(
    `https://api.nb.com.ar/v1/item/${id}`,
    requestOptions
  );

  if (!res.ok) return null;

  return await res.json();
}
