/**
 * Lógica pura de ventas, consignaciones y cuentas por cobrar: totales,
 * agrupación en hojas (VENTAS, DEVOLUCIONES, PENDIENTE DE PAGO) y textos para
 * WhatsApp. Sin acceso a la base de datos; se prueba en tests/ventas.test.ts.
 */
import { fecha, pesos } from "./formato";
import { CATEGORIA_SINGULAR, type CategoriaProducto, MEDIOS_PAGO, type MedioPago } from "./tipos";

export function numeroDocumento(prefijo: "V" | "C", numero: number): string {
  return `${prefijo}-${String(numero).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------------- */
/* Carrito de venta                                                          */
/* ------------------------------------------------------------------------- */

export interface LineaCarrito {
  producto_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number; // en pesos, por línea
  stock_actual: number;
}

export function subtotalLinea(l: Pick<LineaCarrito, "cantidad" | "precio_unitario" | "descuento">): number {
  return Math.max(0, l.cantidad * l.precio_unitario - l.descuento);
}

export function totalesCarrito(lineas: LineaCarrito[], descuentoTotal = 0) {
  const subtotal = lineas.reduce((s, l) => s + subtotalLinea(l), 0);
  const total = Math.max(0, subtotal - descuentoTotal);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  return { subtotal, total, unidades };
}

/** Mensaje en español si el carrito no se puede vender; null si está bien. */
export function validarCarrito(lineas: LineaCarrito[]): string | null {
  if (lineas.length === 0) return "Añade al menos un producto.";
  for (const l of lineas) {
    if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) return `La cantidad de ${l.codigo} debe ser un entero mayor que cero.`;
    if (l.cantidad > l.stock_actual) return `De ${l.codigo} solo hay ${l.stock_actual} en inventario.`;
    if (l.precio_unitario < 0 || l.descuento < 0) return `Revisa el precio y el descuento de ${l.codigo}.`;
    if (l.descuento > l.cantidad * l.precio_unitario) return `El descuento de ${l.codigo} supera el valor de la línea.`;
  }
  return null;
}

/* ------------------------------------------------------------------------- */
/* Textos para WhatsApp                                                      */
/* ------------------------------------------------------------------------- */

export interface VentaParaTexto {
  numero: number;
  fecha: string;
  total: number;
  descuento_total: number;
  medio_pago: MedioPago;
  saldo: number;
  lineas: { nombre: string; codigo: string; cantidad: number; precio_unitario: number; descuento: number }[];
}

export function textoComprobanteVenta(negocio: string, v: VentaParaTexto): string {
  const filas = v.lineas.map((l) => {
    const sub = subtotalLinea(l);
    return `• ${l.cantidad} × ${l.nombre} (${l.codigo}) — $${pesos(sub)}`;
  });
  const partes = [
    `*${negocio}*`,
    `Comprobante ${numeroDocumento("V", v.numero)} · ${fecha(v.fecha)}`,
    "",
    ...filas,
    "",
  ];
  if (v.descuento_total > 0) partes.push(`Descuento: $${pesos(v.descuento_total)}`);
  partes.push(`*Total: $${pesos(v.total)}*`);
  partes.push(`Pago: ${MEDIOS_PAGO[v.medio_pago]}${v.saldo > 0 ? ` · Saldo pendiente: $${pesos(v.saldo)}` : " · Pagado"}`);
  partes.push("", "¡Gracias por tu compra! ✨");
  return partes.join("\n");
}

export function textoRecordatorioSaldo(negocio: string, nombre: string, saldo: number, detalle: { descripcion: string; saldo: number }[]): string {
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;
  const filas = detalle.map((d) => `• ${d.descripcion}: $${pesos(d.saldo)}`);
  return [
    `Hola ${primerNombre}, te escribo de *${negocio}* 😊`,
    `Te recuerdo que tienes un saldo pendiente de *$${pesos(saldo)}*:`,
    ...filas,
    "",
    "Puedes pagar por Nequi, transferencia o en efectivo. ¡Gracias!",
  ].join("\n");
}

/** Enlace de WhatsApp con el texto listo. Teléfono colombiano sin el 57 o con él. */
export function enlaceWhatsApp(telefono: string | null | undefined, texto: string): string {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  const numero = digitos ? (digitos.startsWith("57") && digitos.length > 10 ? digitos : `57${digitos}`) : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/* ------------------------------------------------------------------------- */
/* Hojas de consignación                                                     */
/* ------------------------------------------------------------------------- */

export interface LineaConsignacionHoja {
  codigo: string;
  nombre: string;
  categoria: CategoriaProducto;
  material: string;
  valor_unitario: number;
  cantidad_entregada: number;
  cantidad_vendida: number;
  cantidad_devuelta: number;
  cantidad_pendiente: number;
}

export interface FilaHoja {
  codigo: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  total: number;
}

export interface BloqueHoja {
  titulo: string;
  filas: FilaHoja[];
  total: number;
}

function fila(l: LineaConsignacionHoja, cantidad: number): FilaHoja {
  return { codigo: l.codigo, descripcion: l.nombre, cantidad, valor_unitario: l.valor_unitario, total: cantidad * l.valor_unitario };
}

/** Nombre del bloque en la hoja de DEVOLUCIONES: «Aretas perla de Mallorca», «Productos varios»… */
export function nombreBloque(l: Pick<LineaConsignacionHoja, "categoria" | "material">): string {
  if (!l.material) return "Productos varios";
  return `${CATEGORIA_SINGULAR[l.categoria]}s ${l.material}`.replace(/^Aretas/, "Aretas").replace(/^Otros/, "Productos");
}

/** Agrupa filas por bloque conservando el orden de aparición. */
export function agruparEnBloques(lineas: LineaConsignacionHoja[], cantidadDe: (l: LineaConsignacionHoja) => number): BloqueHoja[] {
  const mapa = new Map<string, BloqueHoja>();
  for (const l of lineas) {
    const c = cantidadDe(l);
    if (c <= 0) continue;
    const nombre = nombreBloque(l);
    if (!mapa.has(nombre)) mapa.set(nombre, { titulo: nombre, filas: [], total: 0 });
    const b = mapa.get(nombre)!;
    const f = fila(l, c);
    b.filas.push(f);
    b.total += f.total;
  }
  return [...mapa.values()];
}

/** Las tres hojas de una consignación, como las de papel. */
export function hojasConsignacion(lineas: LineaConsignacionHoja[]) {
  const entregado = lineas.filter((l) => l.cantidad_entregada > 0).map((l) => fila(l, l.cantidad_entregada));
  const ventas = lineas.filter((l) => l.cantidad_vendida > 0).map((l) => fila(l, l.cantidad_vendida));
  const devoluciones = agruparEnBloques(lineas, (l) => l.cantidad_devuelta);
  const pendientes = lineas.filter((l) => l.cantidad_pendiente > 0).map((l) => fila(l, l.cantidad_pendiente));
  const suma = (f: FilaHoja[]) => f.reduce((s, x) => s + x.total, 0);
  return {
    entregado: { filas: entregado, total: suma(entregado) },
    ventas: { filas: ventas, total: suma(ventas) },
    devoluciones: { bloques: devoluciones, total: devoluciones.reduce((s, b) => s + b.total, 0) },
    pendientes: { filas: pendientes, total: suma(pendientes) },
  };
}

/** Antigüedad legible de una deuda. */
export function antiguedad(dias: number): string {
  if (dias <= 0) return "de hoy";
  if (dias === 1) return "1 día";
  if (dias < 30) return `${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "1 mes" : `${meses} meses`;
}
