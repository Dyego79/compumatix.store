"use client";

import { IoCartSharp, IoClose } from "react-icons/io5";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useCartStore } from "@/stores/useCartStore";
import { formatPesosArgentinos } from "@/utils/formatcurrency";

const links = [
  { id: 1, title: "Link 1", url: "#" },
  { id: 2, title: "Link 2", url: "#" },
  { id: 3, title: "Link 3", url: "#" },
  { id: 4, title: "Link 4", url: "#" },
  { id: 5, title: "Link 5", url: "#" },
];

export default function OffcanvasCarrito() {
  const [menu, setMenu] = useState(false);
  const [load, setLoad] = useState(false);
  const itemCart = useCartStore((state) => state.getTotalItems());
  const cart = useCartStore((state) => state.cart);
  const removeProuduct = useCartStore((state) => state.removeProdcutInCart);

  const drawerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLUListElement>(null);
  const currentRef = useRef<HTMLSpanElement>(null);
  const nextRef = useRef<HTMLSpanElement>(null);
  const prevCountRef = useRef(itemCart);

  // Animar el drawer
  useLayoutEffect(() => {
    if (!drawerRef.current) return;

    if (menu) {
      gsap.fromTo(
        drawerRef.current,
        { x: "100%" },
        {
          x: 0,
          duration: 0.6,
          ease: "back.out(0.5)",
        }
      );

      if (linksRef.current) {
        const items = linksRef.current.querySelectorAll("li");
        gsap.fromTo(
          items,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.04,
            duration: 0.8,
            ease: "power2.out",
          }
        );
      }
    } else {
      gsap.to(drawerRef.current, {
        x: "100%",
        duration: 0.3,
        ease: "power2.in",
      });
    }
  }, [menu]);

  useEffect(() => {
    setLoad(true);
  }, []);

  // Animar el badge cuando cambia itemCart
  useEffect(() => {
    if (itemCart === prevCountRef.current) return;
    if (!currentRef.current || !nextRef.current) return;

    nextRef.current.innerText = String(itemCart);

    const tl = gsap.timeline({
      onComplete: () => {
        prevCountRef.current = itemCart;
        if (currentRef.current) {
          currentRef.current.innerText = String(itemCart);
          gsap.set(currentRef.current, { clearProps: "all" });
        }
        if (nextRef.current) {
          gsap.set(nextRef.current, { opacity: 0 });
        }
      },
    });

    tl.to(currentRef.current, {
      y: -20,
      opacity: 0,
      duration: 0.2,
      ease: "power1.in",
    }).fromTo(
      nextRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
      "<"
    );
  }, [itemCart]);
  useLayoutEffect(() => {
    if (!menu || !linksRef.current) return;

    const items = linksRef.current.querySelectorAll("li");

    gsap.fromTo(
      items,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.15,
        duration: 0.5,
        ease: "power2.out",
        overwrite: true, // por si ya tenían animaciones pendientes
      }
    );
  }, [cart, menu]);
  return (
    <>
      <div className="relative">
        <button onClick={() => setMenu(true)} className="cursor-pointer  ">
          <IoCartSharp size={35} />
        </button>
        <div className="h-6 w-6 right-[-30%] top-[-30%] bg-amber-500 text-white rounded-full overflow-hidden text-sm font-bold absolute">
          <span
            ref={currentRef}
            className="absolute inset-0 flex items-center justify-center"
          >
            {load && itemCart}
          </span>
          <span
            ref={nextRef}
            className="absolute inset-0 flex items-center justify-center opacity-0"
          ></span>
        </div>
      </div>

      {/* Fondo oscuro */}
      {menu && (
        <div
          onClick={() => setMenu(false)}
          className="bg-black/40 backdrop-blur-sm fixed inset-0 z-10"
        ></div>
      )}

      {/* Panel lateral */}
      <div
        ref={drawerRef}
        style={{ transform: "translateX(100%)" }}
        className="rounded-l-xl w-[80%] md:w-[35rem] flex flex-col fixed top-0 right-0 bottom-0 bg-azulCompumatix text-white gap-4 p-4 z-20 shadow-xl"
      >
        <div className="flex items-center justify-between my-3">
          <IoCartSharp size={24} />
          <h3 className="m-0 font-extrabold uppercase text-lg leading-[1.25rem]">
            Carrito
          </h3>
          <div className="bg-principal text-black rounded-full p-1">
            <IoClose
              size={18}
              className="cursor-pointer"
              onClick={() => setMenu(false)}
            />
          </div>
        </div>

        <div className="scroll-personalizado overflow-y-auto">
          <ul
            ref={linksRef}
            className="flex flex-col gap-5 font-extralight p-5"
          >
            {cart.map((product, i) => (
              <li key={i} className="opacity-0">
                <p>{product.title}</p>
                <p>Cant.: {product.quantity}</p>{" "}
                <p className="font-bold">
                  {formatPesosArgentinos(product.quantity * product.price)}
                </p>
                <button
                  className="cursor-pointer"
                  onClick={() => {
                    removeProuduct(product);
                  }}
                >
                  borrar
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
