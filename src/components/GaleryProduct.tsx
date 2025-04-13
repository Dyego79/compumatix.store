import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Thumbs, FreeMode } from "swiper/modules";
import { useState, useRef } from "react";
import { Swiper as SwiperClass } from "swiper";
//Estilos de Swiper
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/free-mode";
import "swiper/css/thumbs";

type Image = {
  checksum: string;
  order?: string;
};

interface Props {
  title: string;
  images: { hd: string; thumb: string }[];
}

const baseUrl = "https://static.nb.com.ar/i/nb_";

function generateSlugImage(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function GaleryProduct({ images, title }: Props) {
  const [thumbsSwiper, setThumbsSwiper] = useState<any>(null);
  const swiperRef = useRef<any>(null);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  console.log(images);

  return (
    <>
      <Swiper
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          setTimeout(() => {
            setIsBeginning(swiper.isBeginning);
            setIsEnd(swiper.isEnd);
          }, 0);
        }}
        onSlideChange={(swiper) => {
          setIsBeginning(swiper.isBeginning);
          setIsEnd(swiper.isEnd);
        }}
        style={{ width: "100%", marginBottom: "1rem" }}
        spaceBetween={10}
        thumbs={{ swiper: thumbsSwiper }}
        modules={[Navigation, Thumbs]}
        className="mySwiper2 h-96"
      >
        {images.map((img) => (
          <SwiperSlide
            key={img.hd}
            className="aspect-[1/1] relative rounded-md !flex justify-center items-center p-5"
          >
            <img
              src={img.hd}
              alt={`img-${img}`}
              style={{
                objectFit: "contain",
                width: "100%",
                height: "100%",
              }}
            />
          </SwiperSlide>
        ))}
        <div className="flex justify-between gap-2 absolute right-2 bottom-2 z-10">
          <button
            onClick={() => swiperRef.current?.slidePrev()}
            disabled={isBeginning}
            className={`px-4 py-2 rounded transition ${
              isBeginning
                ? "bg-gray-300 text-gray-500"
                : "bg-gray-900 text-white hover:bg-gray-600"
            }`}
          >
            ←
          </button>

          <button
            onClick={() => swiperRef.current?.slideNext()}
            disabled={isEnd}
            className={`px-4 py-2 rounded transition ${
              isEnd
                ? "bg-gray-300 text-gray-500"
                : "bg-gray-900 text-white hover:bg-gray-600"
            }`}
          >
            →
          </button>
        </div>
      </Swiper>

      <Swiper
        onSwiper={setThumbsSwiper}
        spaceBetween={10}
        slidesPerView={4}
        freeMode
        watchSlidesProgress
        modules={[FreeMode, Thumbs]}
        className="mySwiper"
      >
        {images.map((img, i) => (
          <SwiperSlide key={i}>
            <img src={img.thumb} alt={`thumb-${img}`} />
          </SwiperSlide>
        ))}
      </Swiper>
    </>
  );
}
