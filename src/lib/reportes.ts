/**
 * Transformación del reporte de la base a hojas de Excel y filas legibles.
 * Sin acceso a datos: se usa en la exportación y en la vista de impresión.
 */
import { pesos } from "./formato";
import type { Hoja } from "./xlsx";
import { CATEGORIAS, CATEGORIAS_GASTO, MEDIOS_PAGO, type Reporte } from "./tipos";

export interface FilaResumen {
  concepto: string;
  valor: number;
  nota?: string;
}

export function filasResumen(r: Reporte): FilaResumen[] {
  return [
    { concepto: "Ventas directas", valor: r.ventas_directas, nota: `${r.ventas_directas_cantidad} ventas` },
    { concepto: "Vendido en consignación", valor: r.ventas_consignacion },
    { concepto: "Descuentos", valor: -r.descuentos },
    { concepto: "Ventas totales", valor: r.ventas_total, nota: `${r.piezas_vendidas} piezas` },
    { concepto: "Costo de lo vendido", valor: -r.costo_vendido, nota: r.piezas_sin_costo > 0 ? `${r.piezas_sin_costo} piezas sin costo registrado` : undefined },
    { concepto: "Margen bruto estimado", valor: r.margen_bruto },
    { concepto: "Gastos operativos (sin mercancía)", valor: -r.gastos_operativos },
    { concepto: "Utilidad estimada", valor: r.utilidad_estimada },
    { concepto: "Compras de mercancía", valor: r.compras_mercancia, nota: "no se resta: ya está en el costo de lo vendido" },
    { concepto: "Dinero cobrado (abonos)", valor: r.ingresos_cobrados },
    { concepto: "Cuentas por cobrar (hoy)", valor: r.cuentas_por_cobrar },
    { concepto: "Mercancía en consignación (hoy)", valor: r.en_consignacion },
    { concepto: "Inventario a precio base (hoy)", valor: r.inventario_base, nota: `${r.inventario_unidades} unidades` },
    { concepto: "Inventario a precio público (hoy)", valor: r.inventario_publico },
    { concepto: "Inventario a costo (hoy)", valor: r.inventario_costo },
  ];
}

export function hojasReporte(r: Reporte, etiqueta: string): Hoja[] {
  return [
    {
      nombre: "Resumen",
      filas: [["Concepto", "Valor", "Nota"], ...filasResumen(r).map((f) => [f.concepto, f.valor, f.nota ?? ""]), [], ["Período", etiqueta, ""]],
      anchos: [38, 16, 44],
    },
    {
      nombre: "Ventas por categoría",
      filas: [["Categoría", "Piezas", "Ingreso"], ...r.por_categoria.map((c) => [CATEGORIAS[c.categoria] ?? c.categoria, c.cantidad, c.ingreso])],
      anchos: [24, 10, 16],
    },
    {
      nombre: "Más vendidos",
      filas: [["Código", "Producto", "Piezas", "Ingreso"], ...r.mas_vendidos.map((p) => [p.codigo, p.nombre, p.cantidad, p.ingreso])],
      anchos: [12, 44, 10, 16],
    },
    {
      nombre: "Gastos por categoría",
      filas: [["Categoría", "Cantidad", "Valor"], ...r.gastos_por_categoria.map((g) => [CATEGORIAS_GASTO[g.categoria] ?? g.categoria, g.cantidad, g.valor])],
      anchos: [28, 10, 16],
    },
    {
      nombre: "Cobros por medio",
      filas: [["Medio de pago", "Valor"], ...r.ingresos_por_medio.map((m) => [MEDIOS_PAGO[m.medio_pago] ?? m.medio_pago, m.valor])],
      anchos: [20, 16],
    },
  ];
}

export function textoValor(v: number): string {
  return v < 0 ? `− ${pesos(-v)}` : pesos(v);
}
