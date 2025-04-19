// src/store/useCartStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";

interface State {
  cart: {
    id: number;
    quantity: number;
    price: number;
    stockMaximo: number;
    title: string;
  }[];
  selectedShipping: number;
  postalCodeDestination: string;
  freeShipping: boolean; // ✅ nuevo estado
  getTotalItems: () => number;
  getSumary: (paymentMethod?: "efectivo" | "transferencia" | "otro") => {
    subTotal: number;
    discount: number;
    shipping: number;
    total: number;
    itemsInCart: number;
  };
  getTotalWeight: () => number;
  setPostalCodeDestination: (postalCode: string) => void;
  addProductToCart: (product: any) => void;
  updateProductQuantity: (product: any, quantity: number) => void;
  removeProdcutInCart: (product: any) => void;
  clearCart: () => void;
  setSelectedShipping: (shipping: number) => void;
  checkFreeShipping: () => void; // ✅ nueva función
}

export const useCartStore = create<State>()(
  persist(
    (set, get) => ({
      cart: [],
      selectedShipping: 0,
      postalCodeDestination: "",
      freeShipping: false, // ✅ inicial

      getTotalItems: () => {
        const { cart } = get();
        return cart.reduce((total, item) => total + (item.quantity || 0), 0);
      },

      getSumary: (paymentMethod) => {
        const { cart, selectedShipping, freeShipping } = get();

        const subTotal = cart.reduce((sub, p) => sub + p.quantity * p.price, 0);

        const itemsInCart = cart.reduce(
          (total, item) => total + item.quantity,
          0
        );

        let discount = 0;
        if (paymentMethod === "efectivo") discount = subTotal * 0.1;
        else if (paymentMethod === "transferencia") discount = subTotal * 0.05;

        const shipping = freeShipping ? 0 : selectedShipping;
        const total = subTotal - discount + shipping;

        return {
          subTotal,
          discount,
          shipping,
          total,
          itemsInCart,
        };
      },

      getTotalWeight: () => {
        const { cart } = get();
        return cart.reduce((totalWeight, product) => {
          return totalWeight + 21 * product.quantity;
        }, 0);
      },

      setPostalCodeDestination: (postalCode) => {
        set({ postalCodeDestination: postalCode });
      },

      setSelectedShipping: (shipping) => {
        set({ selectedShipping: shipping });
        get().checkFreeShipping(); // ✅ verificar cuando se cambia envío
      },

      checkFreeShipping: () => {
        const { cart } = get();
        const subTotal = cart.reduce((sum, p) => sum + p.price * p.quantity, 0);
        const hasFreeShipping = subTotal >= 60000;

        set({ freeShipping: hasFreeShipping });

        /*   if (hasFreeShipping) {
          toast.info(
            "¡Felicitaciones! Tenés envío gratis por superar los $60.000 🎉",
            {
              position: "top-right",
              autoClose: 3000,
              theme: "colored",
            }
          );
        } */
      },

      addProductToCart: (product) => {
        const { cart } = get();
        const productInCart = cart.find((item) => item.id === product.id);
        if (!productInCart) {
          set({ cart: [...cart, product] });
        } else {
          const updatedCart = cart.map((item) =>
            item.id === product.id
              ? { ...item, quantity: product.quantity }
              : item
          );
          set({ cart: updatedCart });
        }

        toast.success(`¡${product.title} fue agregado al carrito!`, {
          position: "top-right",
          autoClose: 3000,
          theme: "colored",
        });

        get().checkFreeShipping(); // ✅ verificar después de agregar
      },

      updateProductQuantity: (product, quantity) => {
        const { cart } = get();
        const updateCartProudcts = cart.map((item) =>
          item.id === product.id ? { ...item, quantity } : item
        );
        set({ cart: updateCartProudcts });
        get().checkFreeShipping(); // ✅ verificar después de actualizar
      },

      removeProdcutInCart: (product) => {
        const { cart } = get();
        const updateCartProudcts = cart.filter(
          (item) => item.id !== product.id
        );
        set({ cart: updateCartProudcts });
        get().checkFreeShipping(); // ✅ verificar después de remover
      },

      clearCart: () => {
        set({ cart: [], freeShipping: false });
      },
    }),
    { name: "shopping-cart-candy" }
  )
);
