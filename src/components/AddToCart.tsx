// src/components/AddToCart.tsx
"use client";

import { useState } from "react";
import { useCartStore } from "@/stores/useCartStore";
import { calcularPrecioConGanancia } from "@/utils/calcularGanancia";

type Product = {
  id: string;
  title: string;
  finalPrice: number;
  mainImage?: string;
  slug: string;
  weight: number;
  height: number;
  width: number;
  length: number;
  cotizacion: number;
};

export default function AddToCart({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((state) => state.addProductToCart);
  const cart = useCartStore((state) => state.cart);

  const handleAdd = () => {
    const cartProduct = {
      id: product.id,
      image: product.mainImage ?? [],
      price: calcularPrecioConGanancia(product.finalPrice) * product.cotizacion,
      quantity: quantity, // Cantidad seleccionada
      slug: product.slug ?? 0,
      title: product.title,
      weight: product.weight ?? 0,
      height: product.height ?? 0,
      width: product.width ?? 0,
      length: product.length ?? 0,
    };
    console.log(cartProduct);
    console.log(cart);

    addItem(cartProduct);
  };

  return (
    <div className="mt-6 flex flex-col md:flex-row items-start gap-4">
      <select
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        className="border px-3 py-2 rounded"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1} unidad{i > 0 ? "es" : ""}
          </option>
        ))}
      </select>
      <button
        onClick={handleAdd}
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition cursor-pointer"
      >
        Agregar al carrito
      </button>
    </div>
  );
}
