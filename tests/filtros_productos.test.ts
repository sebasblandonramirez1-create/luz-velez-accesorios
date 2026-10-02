import { describe, expect, it } from "vitest";
import { facetas, filtrarProductos, filtrosActivos, FILTROS_INICIALES, normalizar, type ProductoFiltrable } from "@/lib/filtros-productos";

const p = (codigo: string, nombre: string, categoria: ProductoFiltrable["categoria"], material: string, color: string, stock: number, precio: number): ProductoFiltrable => ({
  id: codigo,
  codigo,
  nombre,
  categoria,
  material,
  color,
  stock_actual: stock,
  precio_base: precio,
  miniatura: null,
});

const productos = [
  p("SLA013", "Aretas perla de Mallorca", "areta", "Perla de Mallorca", "Blanco", 5, 40000),
  p("SLA2", "Aretas topo", "areta", "Acero", "Dorado", 0, 15000),
  p("SLA030", "Collar perla", "collar", "perla de mallorca", "Blanco", 3, 65000),
  p("SLAP026", "Pulsera tejida", "pulsera", "Hilo", "Azul", 9, 20000),
  p("SLA100", "Anillo ajustable", "anillo", "", "", 1, 30000),
];
const ids = (l: ProductoFiltrable[]) => l.map((x) => x.codigo);

describe("filtrarProductos", () => {
  it("por defecto oculta lo que no tiene existencias y ordena por código (numérico)", () => {
    expect(ids(filtrarProductos(productos, FILTROS_INICIALES))).toEqual(["SLA013", "SLA030", "SLA100", "SLAP026"]);
    expect(ids(filtrarProductos(productos, { ...FILTROS_INICIALES, soloConStock: false }))).toEqual(["SLA2", "SLA013", "SLA030", "SLA100", "SLAP026"]);
  });

  it("busca por código, nombre, material, color o categoría, sin tildes y con varias palabras", () => {
    const buscar = (texto: string) => ids(filtrarProductos(productos, { ...FILTROS_INICIALES, texto }));
    expect(buscar("sla03")).toEqual(["SLA030"]);
    expect(buscar("PERLA")).toEqual(["SLA013", "SLA030"]);
    expect(buscar("perla collar")).toEqual(["SLA030"]);
    expect(buscar("azul")).toEqual(["SLAP026"]);
    expect(buscar("pulseras")).toEqual(["SLAP026"]);
    expect(buscar("mállorca")).toEqual(["SLA013", "SLA030"]);
    expect(buscar("nada")).toEqual([]);
  });

  it("filtra por categoría, material y color sin distinguir mayúsculas", () => {
    expect(ids(filtrarProductos(productos, { ...FILTROS_INICIALES, categoria: "areta" }))).toEqual(["SLA013"]);
    expect(ids(filtrarProductos(productos, { ...FILTROS_INICIALES, material: "Perla de Mallorca" }))).toEqual(["SLA013", "SLA030"]);
    expect(ids(filtrarProductos(productos, { ...FILTROS_INICIALES, color: "blanco", categoria: "collar" }))).toEqual(["SLA030"]);
  });

  it("ordena por nombre, precio o existencias", () => {
    const orden = (o: typeof FILTROS_INICIALES.orden) => ids(filtrarProductos(productos, { ...FILTROS_INICIALES, orden: o }));
    expect(orden("nombre")).toEqual(["SLA100", "SLA013", "SLA030", "SLAP026"]);
    expect(orden("precio_menor")).toEqual(["SLAP026", "SLA100", "SLA013", "SLA030"]);
    expect(orden("precio_mayor")).toEqual(["SLA030", "SLA013", "SLA100", "SLAP026"]);
    expect(orden("stock")).toEqual(["SLAP026", "SLA013", "SLA030", "SLA100"]);
  });

  it("«solo añadidos» muestra lo que ya está en la entrega, aunque no quede stock", () => {
    const anadidos = new Set(["SLA2", "SLA030"]);
    expect(ids(filtrarProductos(productos, { ...FILTROS_INICIALES, soloAnadidos: true }, anadidos))).toEqual(["SLA2", "SLA030"]);
    // un añadido sin stock sigue visible con el filtro de existencias
    expect(ids(filtrarProductos(productos, FILTROS_INICIALES, anadidos))).toContain("SLA2");
  });
});

describe("facetas y contador", () => {
  it("lista categorías con conteo y materiales y colores sin repetir", () => {
    const f = facetas(productos);
    expect(f.categorias).toEqual([
      { valor: "areta", etiqueta: "Aretas", cantidad: 2 },
      { valor: "collar", etiqueta: "Collares", cantidad: 1 },
      { valor: "pulsera", etiqueta: "Pulseras", cantidad: 1 },
      { valor: "anillo", etiqueta: "Anillos", cantidad: 1 },
    ]);
    expect(f.materiales).toEqual(["Acero", "Hilo", "Perla de Mallorca"]);
    expect(f.colores).toEqual(["Azul", "Blanco", "Dorado"]);
  });
  it("cuenta los filtros puestos", () => {
    expect(filtrosActivos(FILTROS_INICIALES)).toBe(0);
    expect(filtrosActivos({ ...FILTROS_INICIALES, texto: "perla", categoria: "areta", soloConStock: false })).toBe(3);
    expect(normalizar("  Pérla ")).toBe("perla");
  });
});
