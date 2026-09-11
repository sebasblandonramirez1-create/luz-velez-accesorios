/**
 * Lógica pura de inventario, espejo de las funciones SQL de la base de datos.
 * Se usa en la interfaz (previsualizar el efecto de un movimiento) y en las
 * pruebas; la verdad última vive en los disparadores de Postgres.
 */

export type TipoMovimiento =
  | "entrada_compra"
  | "salida_venta"
  | "salida_consignacion"
  | "retorno_consignacion"
  | "ajuste_entrada"
  | "ajuste_salida"
  | "perdida"
  | "obsequio";

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, { nombre: string; signo: 1 | -1; manual: boolean }> = {
  entrada_compra: { nombre: "Entrada por compra", signo: 1, manual: true },
  salida_venta: { nombre: "Salida por venta", signo: -1, manual: false },
  salida_consignacion: { nombre: "Entrega en consignación", signo: -1, manual: false },
  retorno_consignacion: { nombre: "Devolución de consignación", signo: 1, manual: false },
  ajuste_entrada: { nombre: "Ajuste (suma)", signo: 1, manual: true },
  ajuste_salida: { nombre: "Ajuste (resta)", signo: -1, manual: true },
  perdida: { nombre: "Pérdida o daño", signo: -1, manual: true },
  obsequio: { nombre: "Obsequio", signo: -1, manual: true },
};

export function signoMovimiento(tipo: TipoMovimiento): 1 | -1 {
  return TIPOS_MOVIMIENTO[tipo].signo;
}

export function nombreMovimiento(tipo: TipoMovimiento): string {
  return TIPOS_MOVIMIENTO[tipo]?.nombre ?? tipo;
}

/** Tipos que la usuaria puede registrar a mano desde «Inventario». */
export function tiposManuales(): TipoMovimiento[] {
  return (Object.keys(TIPOS_MOVIMIENTO) as TipoMovimiento[]).filter((t) => TIPOS_MOVIMIENTO[t].manual);
}

export interface MovimientoMinimo {
  tipo: TipoMovimiento;
  cantidad: number;
  eliminado_en?: string | null;
}

/** Stock resultante de una lista de movimientos (ignora los de la papelera). */
export function calcularStock(movimientos: Iterable<MovimientoMinimo>): number {
  let total = 0;
  for (const m of movimientos) {
    if (m.eliminado_en) continue;
    total += signoMovimiento(m.tipo) * m.cantidad;
  }
  return total;
}

/**
 * Valida un movimiento antes de enviarlo. Devuelve un mensaje en español si hay
 * un problema, o null si está bien. Los ajustes de resta pueden dejar el stock
 * en cero pero no en negativo; las demás salidas tampoco.
 */
export function validarMovimiento(tipo: TipoMovimiento, cantidad: number, stockActual: number): string | null {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return "La cantidad debe ser un número entero mayor que cero.";
  }
  if (signoMovimiento(tipo) < 0 && stockActual - cantidad < 0) {
    return `Solo hay ${stockActual} en inventario y se intentan sacar ${cantidad}.`;
  }
  return null;
}

export function esStockBajo(stockActual: number, stockMinimo: number): boolean {
  return stockActual <= stockMinimo;
}
