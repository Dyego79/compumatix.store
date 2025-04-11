import {
  Pagination as Pg,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

type Props = {
  currentPage: number;
  totalPages: number;
  busqueda?: string;
};

export default function Pagination({
  currentPage,
  totalPages,
  busqueda = "",
}: Props) {
  const getPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (busqueda) params.set("busqueda", busqueda);
    params.set("pagina", page.toString());
    return `/tienda?${params.toString()}`;
  };

  // Solo mostrar páginas cercanas (ej: 3,4,5 si estás en 4)
  const visiblePages = Array.from(
    { length: totalPages },
    (_, i) => i + 1
  ).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
  );

  const showStartEllipsis = currentPage > 3;
  const showEndEllipsis = currentPage < totalPages - 2;

  return (
    <Pg className="mt-6">
      <PaginationContent>
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationLink
              href={getPageHref(currentPage - 1)}
              className="mx-5"
            >
              ← Anterior
            </PaginationLink>
          </PaginationItem>
        )}

        {visiblePages.map((p, i) => (
          <PaginationItem key={p}>
            <PaginationLink href={getPageHref(p)} isActive={p === currentPage}>
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}

        {showEndEllipsis && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationLink
              href={getPageHref(currentPage + 1)}
              className="mx-5"
            >
              Siguiente →
            </PaginationLink>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pg>
  );
}
