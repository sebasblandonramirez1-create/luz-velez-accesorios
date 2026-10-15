/**
 * Clasificación de productos por código corto (CP, CM, CCH, PL, PLM…): la
 * lista se administra en Ajustes y la base de datos la guarda en
 * clasificaciones_producto. Aquí va la lógica pura: etiquetas y conteos.
 * Se prueba en tests/clasificaciones.test.ts.
 */

export interface Clasificacion {
  codigo: string;
  nombre: string;
  orden?: number;
  activa?: boolean;
}

export const SIN_CLASIFICAR = "Sin clasificar";
/** Valor del filtro «sin clasificar» en las direcciones (?clasificacion=sin). */
export const FILTRO_SIN_CLASIFICAR = "sin";

/** Código válido: de 1 a 6 letras mayúsculas. */
export function codigoClasificacionValido(codigo: string): boolean {
  return /^[A-Z]{1,6}$/.test(codigo);
}

export function normalizarCodigoClasificacion(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

/** «CP · Collar de piedras», o «Sin clasificar». */
export function etiquetaClasificacion(codigo: string | null | undefined, lista: Clasificacion[] = []): string {
  if (!codigo) return SIN_CLASIFICAR;
  const k = lista.find((c) => c.codigo === codigo);
  return k ? `${k.codigo} · ${k.nombre}` : codigo;
}

export function nombreClasificacion(codigo: string | null | undefined, lista: Clasificacion[] = []): string {
  if (!codigo) return SIN_CLASIFICAR;
  return lista.find((c) => c.codigo === codigo)?.nombre ?? codigo;
}

export interface ConteoClasificacion {
  /** Código, o null para «sin clasificar». */
  codigo: string | null;
  nombre: string;
  referencias: number;
  piezas: number;
  valor: number;
}

/**
 * Conteo por clasificación: referencias (productos distintos), piezas (unidades)
 * y valor. Sigue el orden de la lista; lo que no tiene clasificación va al final.
 * Las clasificaciones sin piezas no aparecen.
 */
export function conteoPorClasificacion(
  items: { clasificacion?: string | null; cantidad: number; valor_unitario?: number; codigo?: string }[],
  lista: Clasificacion[] = [],
): ConteoClasificacion[] {
  const mapa = new Map<string, ConteoClasificacion & { codigos: Set<string> }>();
  items.forEach((it, i) => {
    const clave = it.clasificacion || "";
    if (!mapa.has(clave)) mapa.set(clave, { codigo: clave || null, nombre: nombreClasificacion(clave || null, lista), referencias: 0, piezas: 0, valor: 0, codigos: new Set() });
    const c = mapa.get(clave)!;
    const idReferencia = it.codigo ?? `#${i}`;
    if (!c.codigos.has(idReferencia)) {
      c.codigos.add(idReferencia);
      c.referencias += 1;
    }
    c.piezas += it.cantidad;
    c.valor += it.cantidad * (it.valor_unitario ?? 0);
  });
  const posicion = (codigo: string | null) => {
    if (!codigo) return Number.MAX_SAFE_INTEGER;
    const i = lista.findIndex((k) => k.codigo === codigo);
    return i === -1 ? Number.MAX_SAFE_INTEGER - 1 : i;
  };
  return [...mapa.values()]
    .filter((c) => c.piezas > 0 || c.referencias > 0)
    .sort((a, b) => posicion(a.codigo) - posicion(b.codigo) || (a.codigo ?? "").localeCompare(b.codigo ?? ""))
    .map(({ codigos: _codigos, ...c }) => c);
}

/** «CP 3 · PL 2 · Sin clasificar 1», para textos cortos. */
export function resumenClasificacionCorto(conteo: ConteoClasificacion[]): string {
  return conteo.map((c) => `${c.codigo ?? SIN_CLASIFICAR} ${c.piezas}`).join(" · ");
}
