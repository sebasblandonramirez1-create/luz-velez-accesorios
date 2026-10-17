/**
 * Entrada de varios productos al stock en una sola operación: validación,
 * totales y resumen. Lógica pura, probada en tests/entradas.test.ts. Los
 * movimientos los escribe la base de datos; el stock se recalcula solo.
 */
import { pesos } from "./formato";
import type { TipoMovimiento } from "./inventario";

export type TipoEntrada = Extract<TipoMovimiento, "entrada_compra" | "ajuste_entrada">;

export const TIPOS_ENTRADA: Record<TipoEntrada, { nombre: string; ayuda: string }> = {
  entrada_compra: { nombre: "Entrada por compra", ayuda: "Mercancía que llegó. El costo por unidad se guarda como costo de compra del producto." },
  ajuste_entrada: { nombre: "Ajuste de inventario (suma)", ayuda: "Para cuadrar existencias que había y no estaban contadas." },
};

export interface LineaEntrada {
  producto_id: string;
  codigo: string;
  nombre: string;
  stock_actual: number;
  cantidad: number;
  valor_unitario: number;
}

/** Clave de la selección de productos guardada en el navegador. */
export const CLAVE_SELECCION_PRODUCTOS = "productos-seleccionados";

export function totalesEntrada(lineas: Pick<LineaEntrada, "cantidad" | "valor_unitario">[]) {
  const conCantidad = lineas.filter((l) => l.cantidad > 0);
  return {
    productos: conCantidad.length,
    unidades: conCantidad.reduce((s, l) => s + l.cantidad, 0),
    valor: conCantidad.reduce((s, l) => s + l.cantidad * l.valor_unitario, 0),
  };
}

/** Mensaje en español si la entrada no se puede registrar; null si está bien. */
export function validarEntrada(lineas: LineaEntrada[], tipo: string): string | null {
  if (!(tipo in TIPOS_ENTRADA)) return "Elige el tipo de entrada.";
  if (lineas.length === 0) return "Selecciona al menos un producto.";
  const ids = new Set<string>();
  for (const l of lineas) {
    if (ids.has(l.producto_id)) return `${l.codigo} aparece dos veces.`;
    ids.add(l.producto_id);
    if (!Number.isInteger(l.cantidad) || l.cantidad < 0) return `La cantidad de ${l.codigo} debe ser un entero de cero o más.`;
    if (l.cantidad > 100000) return `La cantidad de ${l.codigo} es demasiado grande.`;
    if (!Number.isInteger(l.valor_unitario) || l.valor_unitario < 0) return `Revisa el costo de ${l.codigo}.`;
  }
  if (lineas.every((l) => l.cantidad === 0)) return "Escribe la cantidad que entra de al menos un producto.";
  return null;
}

/** «3 productos · 12 unidades · $480.000». */
export function resumenEntrada(lineas: Pick<LineaEntrada, "cantidad" | "valor_unitario">[]): string {
  const t = totalesEntrada(lineas);
  const partes = [`${t.productos} ${t.productos === 1 ? "producto" : "productos"}`, `${t.unidades} ${t.unidades === 1 ? "unidad" : "unidades"}`];
  if (t.valor > 0) partes.push(`$${pesos(t.valor)}`);
  return partes.join(" · ");
}
