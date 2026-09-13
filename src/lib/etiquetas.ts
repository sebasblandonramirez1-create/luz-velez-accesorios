/**
 * Diseño de etiquetas: tamaño del rollo, conversión a píxeles según los DPI de
 * la impresora, y las cuatro líneas de texto (negocio, descripción, código con
 * precio en miles, precio al público). Lógica pura; el dibujo va en el
 * componente EtiquetaCanvas y se prueba en tests/etiquetas.test.ts.
 */
import { enMiles, pesos } from "./formato";

export type LineaEtiqueta = "negocio" | "descripcion" | "codigo_precio" | "precio_publico";

export const LINEAS_ETIQUETA: Record<LineaEtiqueta, string> = {
  negocio: "Nombre del negocio",
  descripcion: "Descripción en mayúsculas",
  codigo_precio: "Código con el precio en miles",
  precio_publico: "Precio al público",
};

/** Rollos habituales de NIIMBOT. ancho × alto tal como se lee la etiqueta. */
export const ROLLOS = [
  { nombre: "40 × 12 mm (D11, D110, D101)", ancho: 40, alto: 12 },
  { nombre: "30 × 12 mm (D11, D110)", ancho: 30, alto: 12 },
  { nombre: "30 × 14 mm (D11, D110)", ancho: 30, alto: 14 },
  { nombre: "30 × 15 mm (D110, D101)", ancho: 30, alto: 15 },
  { nombre: "50 × 15 mm (D110, D101)", ancho: 50, alto: 15 },
  { nombre: "40 × 20 mm (D101)", ancho: 40, alto: 20 },
  { nombre: "40 × 25 mm (D101)", ancho: 40, alto: 25 },
  { nombre: "30 × 15 mm (B1, B21)", ancho: 30, alto: 15 },
  { nombre: "40 × 30 mm (B1, B21)", ancho: 40, alto: 30 },
  { nombre: "50 × 30 mm (B1, B21)", ancho: 50, alto: 30 },
  { nombre: "60 × 40 mm (B1, B21)", ancho: 60, alto: 40 },
  { nombre: "70 × 40 mm (B1, B21)", ancho: 70, alto: 40 },
];

/** Modelos NIIMBOT con su resolución y ancho del cabezal, según niimbluelib (modelsLibrary). */
export const MODELOS_NIIMBOT: Record<string, { dpi: number; cabezalPx: number; direccion: "left" | "top" }> = {
  D11: { dpi: 203, cabezalPx: 96, direccion: "left" },
  D11_H: { dpi: 203, cabezalPx: 96, direccion: "left" },
  D101: { dpi: 203, cabezalPx: 192, direccion: "left" },
  D110: { dpi: 203, cabezalPx: 96, direccion: "left" },
  D110_M: { dpi: 203, cabezalPx: 96, direccion: "left" },
  B18: { dpi: 203, cabezalPx: 96, direccion: "left" },
  B1: { dpi: 203, cabezalPx: 384, direccion: "top" },
  B1_PRO: { dpi: 300, cabezalPx: 567, direccion: "top" },
  B21: { dpi: 203, cabezalPx: 384, direccion: "top" },
  B21_PRO: { dpi: 300, cabezalPx: 591, direccion: "top" },
};

export function mmAPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

export interface TamanoEtiqueta {
  anchoMm: number;
  altoMm: number;
  dpi: number;
  anchoPx: number;
  altoPx: number;
}

export function tamanoEtiqueta(anchoMm: number, altoMm: number, dpi: number): TamanoEtiqueta {
  return { anchoMm, altoMm, dpi, anchoPx: mmAPx(anchoMm, dpi), altoPx: mmAPx(altoMm, dpi) };
}

export function metaModelo(modelo: string) {
  return MODELOS_NIIMBOT[modelo.toUpperCase().replace(/[\s-]/g, "_")];
}

/**
 * Comprueba que la etiqueta cabe en el cabezal del modelo. En impresoras que
 * imprimen «de lado» (D11, D110: la etiqueta avanza por su lado largo) el alto
 * es el que va contra el cabezal; en las «de frente» (B1, B21) es el ancho.
 * Se tolera hasta un 8 % de más (el rollo de 50 mm de la B1 se imprime en los
 * 48 mm del cabezal, con margen recortado).
 */
export function cabeEnCabezal(t: TamanoEtiqueta, modelo: string): { cabe: boolean; motivo?: string } {
  const m = metaModelo(modelo);
  if (!m) return { cabe: true };
  const px = m.direccion === "left" ? t.altoPx : t.anchoPx;
  const maxMm = Math.round((m.cabezalPx / m.dpi) * 25.4);
  if (px > m.cabezalPx * 1.08) {
    return { cabe: false, motivo: `La ${m.direccion === "left" ? "altura" : "anchura"} máxima para ${modelo} es ${maxMm} mm.` };
  }
  return { cabe: true };
}

/** Tamaño que se envía a la impresora: recorta al cabezal el lado que va contra él y usa los DPI del modelo. */
export function tamanoParaImpresora(t: TamanoEtiqueta, modelo: string): TamanoEtiqueta {
  const m = metaModelo(modelo);
  if (!m) return t;
  const base = t.dpi === m.dpi ? t : tamanoEtiqueta(t.anchoMm, t.altoMm, m.dpi);
  if (m.direccion === "left") return { ...base, altoPx: Math.min(base.altoPx, m.cabezalPx) };
  return { ...base, anchoPx: Math.min(base.anchoPx, m.cabezalPx) };
}

export interface ProductoEtiqueta {
  codigo: string;
  nombre: string;
  precio_base: number;
  precio_publico: number;
}

export interface ConfiguracionEtiqueta {
  nombre_negocio: string;
  etiqueta_lineas: LineaEtiqueta[];
  etiqueta_mostrar_precio_miles: boolean;
}

export interface TextoLinea {
  tipo: LineaEtiqueta;
  texto: string;
  /** Peso relativo del alto de la línea (para repartir el espacio). */
  peso: number;
  negrita: boolean;
  monoespaciada: boolean;
}

/** Las líneas de texto de una etiqueta, en orden, según la configuración. */
export function lineasDeEtiqueta(p: ProductoEtiqueta, cfg: ConfiguracionEtiqueta): TextoLinea[] {
  const todas: Record<LineaEtiqueta, TextoLinea> = {
    negocio: { tipo: "negocio", texto: cfg.nombre_negocio, peso: 0.8, negrita: false, monoespaciada: false },
    descripcion: { tipo: "descripcion", texto: p.nombre.toUpperCase(), peso: 1.2, negrita: true, monoespaciada: false },
    codigo_precio: { tipo: "codigo_precio", texto: cfg.etiqueta_mostrar_precio_miles ? `${p.codigo} ${enMiles(p.precio_base)}` : p.codigo, peso: 1, negrita: false, monoespaciada: true },
    precio_publico: { tipo: "precio_publico", texto: `$ ${pesos(p.precio_publico)}`, peso: 1.4, negrita: true, monoespaciada: false },
  };
  const orden: LineaEtiqueta[] = cfg.etiqueta_lineas.length ? cfg.etiqueta_lineas : ["negocio", "descripcion", "codigo_precio", "precio_publico"];
  return orden.filter((l) => l in todas).map((l) => todas[l]);
}

/**
 * Reparte el alto disponible entre las líneas según su peso y devuelve el
 * tamaño de fuente (px) de cada una. `medir` devuelve el ancho del texto para un
 * tamaño de fuente dado; se reduce hasta que quepa en el ancho útil.
 */
export function ajustarLineas(
  lineas: TextoLinea[],
  anchoUtil: number,
  altoUtil: number,
  medir: (linea: TextoLinea, tamano: number) => number,
): { linea: TextoLinea; tamano: number; y: number }[] {
  const pesoTotal = lineas.reduce((s, l) => s + l.peso, 0) || 1;
  let y = 0;
  return lineas.map((linea) => {
    const alto = (altoUtil * linea.peso) / pesoTotal;
    let tamano = Math.floor(alto * 0.82);
    while (tamano > 4 && medir(linea, tamano) > anchoUtil) tamano -= 1;
    const resultado = { linea, tamano, y: y + alto / 2 };
    y += alto;
    return resultado;
  });
}

/** Nombre de archivo seguro para el PNG de una etiqueta. */
export function nombreArchivoEtiqueta(codigo: string): string {
  return `etiqueta-${codigo.replace(/[^A-Za-z0-9_-]/g, "")}.png`;
}
