const ganancia1 = 1.8;
const ganancia2 = 1.6;
const ganancia3 = 1.22;

export function calcularPrecioConGanancia(precioBase: number): number {
  if (precioBase > 1 && precioBase < 200) return precioBase * ganancia1;
  if (precioBase >= 201 && precioBase <= 999) return precioBase * ganancia2;
  if (precioBase > 1000) return precioBase * ganancia3;
  return precioBase;
}
