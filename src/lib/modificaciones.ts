/**
 * Modificaciones de una consignación: tipos del registro, textos legibles y el
 * cálculo de diferencias que la pantalla muestra antes de guardar. Lógica pura,
 * probada en tests/modificaciones.test.ts. El registro definitivo lo escribe la
 * base de datos (función modificar_consignacion).
 */
import { fecha, fechaHora, pesos } from "./formato";

export type CambioConsignacion =
  | { tipo: "pieza_agregada"; codigo: string; nombre: string; cantidad: number; valor_unitario: number }
  | { tipo: "pieza_retirada"; codigo: string; nombre: string; cantidad: number; valor_unitario: number }
  | { tipo: "cantidad"; codigo: string; nombre: string; antes: number; despues: number }
  | { tipo: "valor"; codigo: string; nombre: string; antes: number; despues: number }
  | { tipo: "fecha_limite"; antes: string | null; despues: string | null }
  | { tipo: "nota"; antes: string; despues: string }
  | { tipo: "firma_anulada"; firmante: string; documento?: string; firmado_en: string; huella?: string };

const piezas = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

/** Una frase en español por cada cambio, para el historial y la vista previa. */
export function describirCambio(c: CambioConsignacion): string {
  switch (c.tipo) {
    case "pieza_agregada":
      return `Se añadió ${c.nombre} (${c.codigo}): ${piezas(c.cantidad)} a $${pesos(c.valor_unitario)}.`;
    case "pieza_retirada":
      return `Se retiró ${c.nombre} (${c.codigo}): ${piezas(c.cantidad)} ${c.cantidad === 1 ? "volvió" : "volvieron"} al inventario.`;
    case "cantidad": {
      const d = c.despues - c.antes;
      return `${c.nombre} (${c.codigo}): la cantidad pasó de ${c.antes} a ${c.despues} (${d > 0 ? `salen ${piezas(d)} más del inventario` : `${piezas(-d)} ${-d === 1 ? "vuelve" : "vuelven"} al inventario`}).`;
    }
    case "valor":
      return `${c.nombre} (${c.codigo}): el valor unitario pasó de $${pesos(c.antes)} a $${pesos(c.despues)}.`;
    case "fecha_limite":
      return `La fecha límite pasó de ${c.antes ? fecha(c.antes) : "sin fecha"} a ${c.despues ? fecha(c.despues) : "sin fecha"}.`;
    case "nota":
      return c.despues ? `La nota quedó así: «${c.despues}»${c.antes ? ` (antes: «${c.antes}»)` : ""}.` : `Se borró la nota (antes: «${c.antes}»).`;
    case "firma_anulada":
      return `Se anuló la firma electrónica de ${c.firmante || "quien recibió"}${c.documento ? ` (C.C. / NIT ${c.documento})` : ""}, hecha el ${fechaHora(c.firmado_en)}, porque el recibo cambió.`;
    default:
      return "Cambio registrado.";
  }
}

export interface LineaModificable {
  producto_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  valor_unitario: number;
}

export interface EstadoConsignacionEditable {
  lineas: LineaModificable[];
  fecha_limite: string | null;
  nota: string;
}

/**
 * Diferencias entre la entrega guardada y la que está en pantalla, en el mismo
 * orden y formato que el registro de la base de datos.
 */
export function diferenciasConsignacion(antes: EstadoConsignacionEditable, despues: EstadoConsignacionEditable): CambioConsignacion[] {
  const cambios: CambioConsignacion[] = [];
  const nuevas = new Map(despues.lineas.map((l) => [l.producto_id, l]));
  const viejas = new Map(antes.lineas.map((l) => [l.producto_id, l]));
  for (const v of antes.lineas) {
    if (!nuevas.has(v.producto_id)) cambios.push({ tipo: "pieza_retirada", codigo: v.codigo, nombre: v.nombre, cantidad: v.cantidad, valor_unitario: v.valor_unitario });
  }
  for (const n of despues.lineas) {
    const v = viejas.get(n.producto_id);
    if (!v) {
      cambios.push({ tipo: "pieza_agregada", codigo: n.codigo, nombre: n.nombre, cantidad: n.cantidad, valor_unitario: n.valor_unitario });
      continue;
    }
    if (n.cantidad !== v.cantidad) cambios.push({ tipo: "cantidad", codigo: n.codigo, nombre: n.nombre, antes: v.cantidad, despues: n.cantidad });
    if (n.valor_unitario !== v.valor_unitario) cambios.push({ tipo: "valor", codigo: n.codigo, nombre: n.nombre, antes: v.valor_unitario, despues: n.valor_unitario });
  }
  if ((despues.fecha_limite || null) !== (antes.fecha_limite || null) && despues.fecha_limite) cambios.push({ tipo: "fecha_limite", antes: antes.fecha_limite, despues: despues.fecha_limite });
  if (despues.nota.trim() !== antes.nota) cambios.push({ tipo: "nota", antes: antes.nota, despues: despues.nota.trim() });
  return cambios;
}

/** Totales de una lista de líneas. */
export function totalesLineas(lineas: Pick<LineaModificable, "cantidad" | "valor_unitario">[]) {
  return { piezas: lineas.reduce((s, l) => s + l.cantidad, 0), total: lineas.reduce((s, l) => s + l.cantidad * l.valor_unitario, 0) };
}

/** Resumen de una modificación: «De 6 piezas ($290.000) a 10 piezas ($365.000)». */
export function resumenModificacion(m: { piezas_antes: number; piezas_despues: number; total_antes: number; total_despues: number }): string {
  if (m.piezas_antes === m.piezas_despues && m.total_antes === m.total_despues) return `Sin cambio en las piezas: ${piezas(m.piezas_despues)} por $${pesos(m.total_despues)}.`;
  return `De ${piezas(m.piezas_antes)} ($${pesos(m.total_antes)}) a ${piezas(m.piezas_despues)} ($${pesos(m.total_despues)}).`;
}

/** Traduce los errores de modificar_consignacion. Devuelve null si no es uno de ellos. */
export function mensajeErrorModificacion(mensaje: string): string | null {
  let x: RegExpExecArray | null;
  if (/SIN_CAMBIOS/.test(mensaje)) return "No cambiaste nada. Ajusta las piezas, la fecha límite o la nota antes de guardar.";
  if (/CONSIGNACION_CERRADA/.test(mensaje)) return "Esta entrega ya está cerrada y no se puede modificar. Si se lleva más mercancía, crea una entrega nueva.";
  if (/CONSIGNACION_NO_ENCONTRADA/.test(mensaje)) return "La entrega no existe o fue anulada.";
  if (/RECIBO_FIRMADO/.test(mensaje)) return "El recibo ya está firmado. Solo la propietaria puede modificar la entrega, y al hacerlo la firma se anula.";
  if ((x = /CANTIDAD_MENOR_A_LIQUIDADA: de (\S+) ya se liquidaron (\d+) piezas y se intenta dejar (\d+)/.exec(mensaje))) return `De ${x[1]} ya se liquidaron ${x[2]} piezas: no puedes dejar menos de ${x[2]}.`;
  if ((x = /LINEA_CON_LIQUIDACION: (\S+)/.exec(mensaje))) return `${x[1]} ya tiene piezas liquidadas y no se puede retirar de la entrega.`;
  if ((x = /VALOR_CON_VENTAS: (\S+)/.exec(mensaje))) return `${x[1]} ya tiene piezas vendidas: su valor unitario no se puede cambiar.`;
  if (/LINEAS_REPETIDAS/.test(mensaje)) return "Un producto aparece dos veces. Deja una sola línea por producto.";
  if (/LINEA_INVALIDA/.test(mensaje)) return "Revisa la cantidad y el valor de cada pieza.";
  return null;
}
