"use client";

import { IoCartSharp, IoClose, IoFilter } from "react-icons/io5";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useCartStore } from "@/stores/useCartStore";
import { formatPesosArgentinos } from "@/utils/formatcurrency";

interface Props {
  name: string;
  slug: string;
}

export default function OffcanvasFilter({ name, slug }: Props) {
  const [menu, setMenu] = useState(false);
  const [load, setLoad] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLUListElement>(null);
  const currentRef = useRef<HTMLSpanElement>(null);
  const nextRef = useRef<HTMLSpanElement>(null);

  // Animar el drawer
  useLayoutEffect(() => {
    if (!drawerRef.current) return;

    if (menu) {
      gsap.fromTo(
        drawerRef.current,
        { x: "-100%" },
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
        x: "-100%",
        duration: 0.3,
        ease: "power2.in",
      });
    }
  }, [menu]);

  useEffect(() => {
    setLoad(true);
  }, []);

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
  }, [menu]);
  return (
    <div className="block lg:hidden">
      <div className="relative">
        <button onClick={() => setMenu(true)} className="cursor-pointer  ">
          <IoFilter size={35} />
        </button>
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
        style={{ transform: "translateX(-100%)" }}
        className="rounded-r-xl w-[80%] md:w-[35rem] flex flex-col fixed top-0 left-0 bottom-0 bg-azulCompumatix text-white gap-4 p-4 z-20 shadow-xl"
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
      </div>
    </div>
  );
}
