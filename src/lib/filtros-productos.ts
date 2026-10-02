/**
 * Filtros para ubicar productos al armar una entrega: texto libre, categoría,
 * material, color, existencias y orden. Lógica pura, probada en
 * tests/filtros_productos.test.ts.
 */
import { CATEGORIAS, type CategoriaProducto } from "./tipos";

export interface ProductoFiltrable {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaProducto;
  material: string;
  color: string;
  stock_actual: number;
  precio_base: number;
  miniatura: string | null;
}

export type OrdenProductos = "codigo" | "nombre" | "precio_menor" | "precio_mayor" | "stock";

export const ORDENES_PRODUCTOS: Record<OrdenProductos, string> = {
  codigo: "Código",
  nombre: "Nombre (A-Z)",
  precio_menor: "Precio: menor primero",
  precio_mayor: "Precio: mayor primero",
  stock: "Más existencias primero",
};

export interface FiltrosProductos {
  texto: string;
  categoria: CategoriaProducto | "";
  material: string;
  color: string;
  soloConStock: boolean;
  soloAnadidos: boolean;
  orden: OrdenProductos;
}

export const FILTROS_INICIALES: FiltrosProductos = { texto: "", categoria: "", material: "", color: "", soloConStock: true, soloAnadidos: false, orden: "codigo" };

/** Minúsculas y sin tildes, para comparar «perla» con «Pérla». */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function coincideTexto(p: ProductoFiltrable, palabras: string[]): boolean {
  if (palabras.length === 0) return true;
  const pajar = normalizar(`${p.codigo} ${p.nombre} ${p.material} ${p.color} ${CATEGORIAS[p.categoria]}`);
  return palabras.every((w) => pajar.includes(w));
}

const comparadores: Record<OrdenProductos, (a: ProductoFiltrable, b: ProductoFiltrable) => number> = {
  codigo: (a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es") || a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
  precio_menor: (a, b) => a.precio_base - b.precio_base || a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
  precio_mayor: (a, b) => b.precio_base - a.precio_base || a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
  stock: (a, b) => b.stock_actual - a.stock_actual || a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
};

/** Aplica los filtros y el orden. `anadidos` son los ids que ya están en la entrega. */
export function filtrarProductos<T extends ProductoFiltrable>(productos: T[], f: FiltrosProductos, anadidos: ReadonlySet<string> = new Set()): T[] {
  const palabras = normalizar(f.texto).split(/\s+/).filter(Boolean);
  const material = normalizar(f.material);
  const color = normalizar(f.color);
  return productos
    .filter((p) => {
      if (f.soloAnadidos) return anadidos.has(p.id) && coincideTexto(p, palabras);
      // Lo que ya está en la entrega se sigue viendo aunque el stock restante sea 0.
      if (f.soloConStock && p.stock_actual <= 0 && !anadidos.has(p.id)) return false;
      if (f.categoria && p.categoria !== f.categoria) return false;
      if (material && normalizar(p.material) !== material) return false;
      if (color && normalizar(p.color) !== color) return false;
      return coincideTexto(p, palabras);
    })
    .sort(comparadores[f.orden]);
}

function distintos(valores: string[]): string[] {
  const vistos = new Map<string, string>();
  for (const v of valores) {
    const limpio = v.trim();
    if (!limpio) continue;
    const clave = normalizar(limpio);
    if (!vistos.has(clave)) vistos.set(clave, limpio);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/** Valores disponibles para los filtros, con el conteo por categoría. */
export function facetas(productos: ProductoFiltrable[]) {
  const porCategoria = new Map<CategoriaProducto, number>();
  for (const p of productos) porCategoria.set(p.categoria, (porCategoria.get(p.categoria) ?? 0) + 1);
  const categorias = (Object.keys(CATEGORIAS) as CategoriaProducto[]).filter((c) => porCategoria.has(c)).map((c) => ({ valor: c, etiqueta: CATEGORIAS[c], cantidad: porCategoria.get(c)! }));
  return { categorias, materiales: distintos(productos.map((p) => p.material)), colores: distintos(productos.map((p) => p.color)) };
}

/** Cuántos filtros están puestos (para el botón «Limpiar filtros»). */
export function filtrosActivos(f: FiltrosProductos): number {
  return [f.texto.trim() !== "", f.categoria !== "", f.material !== "", f.color !== "", !f.soloConStock, f.soloAnadidos, f.orden !== "codigo"].filter(Boolean).length;
}
