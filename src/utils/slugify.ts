export function slugify(text: any) {
  return text
    .toString()
    .normalize("NFD") // Normaliza caracteres Unicode
    .replace(/[\u0300-\u036f]/g, "") // Remueve marcas diacríticas
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Reemplaza caracteres no alfanuméricos por guiones
    .replace(/^-+|-+$/g, ""); // Remueve guiones al inicio o al final
}
