import { describe, expect, it } from "vitest";
import { ajustarLineas, cabeEnCabezal, lineasDeEtiqueta, mmAPx, nombreArchivoEtiqueta, tamanoEtiqueta, tamanoParaImpresora } from "@/lib/etiquetas";

const producto = { codigo: "SLA013", nombre: "Aretas perla de Mallorca", precio_base: 40000, precio_publico: 118900 };
const cfg = { nombre_negocio: "Luzazul Accesorios", etiqueta_lineas: ["negocio", "descripcion", "codigo_precio", "precio_publico"] as const, etiqueta_mostrar_precio_miles: true };

describe("etiquetas", () => {
  it("convierte milímetros a píxeles según los DPI", () => {
    expect(mmAPx(12, 203)).toBe(96); // cabezal de la D110
    expect(mmAPx(40, 203)).toBe(320);
    expect(mmAPx(48, 203)).toBe(384); // cabezal de la B1
    expect(tamanoEtiqueta(40, 12, 203)).toEqual({ anchoMm: 40, altoMm: 12, dpi: 203, anchoPx: 320, altoPx: 96 });
  });

  it("comprueba si la etiqueta cabe en el cabezal del modelo", () => {
    expect(cabeEnCabezal(tamanoEtiqueta(40, 12, 203), "D110").cabe).toBe(true);
    expect(cabeEnCabezal(tamanoEtiqueta(40, 15, 203), "D110").cabe).toBe(false);
    expect(cabeEnCabezal(tamanoEtiqueta(40, 15, 203), "d110").motivo).toMatch(/altura máxima para d110 es 12 mm/);
    expect(cabeEnCabezal(tamanoEtiqueta(50, 30, 203), "B1").cabe).toBe(true); // 50 mm en cabezal de 48: tolerado
    expect(cabeEnCabezal(tamanoEtiqueta(60, 30, 203), "B1").cabe).toBe(false);
    expect(cabeEnCabezal(tamanoEtiqueta(100, 100, 203), "Otro").cabe).toBe(true); // modelo desconocido: no se bloquea
    // el tamaño enviado a la impresora se recorta al cabezal y usa los DPI del modelo
    expect(tamanoParaImpresora(tamanoEtiqueta(50, 30, 203), "B1")).toMatchObject({ anchoPx: 384, altoPx: 240 });
    expect(tamanoParaImpresora(tamanoEtiqueta(40, 12, 203), "D110")).toMatchObject({ anchoPx: 320, altoPx: 96 });
    expect(tamanoParaImpresora(tamanoEtiqueta(40, 12, 203), "B21_PRO").dpi).toBe(300);
    expect(tamanoParaImpresora(tamanoEtiqueta(40, 12, 203), "Otro")).toMatchObject({ anchoPx: 320, altoPx: 96 });
  });

  it("arma las cuatro líneas como en la etiqueta actual", () => {
    const l = lineasDeEtiqueta(producto, { ...cfg, etiqueta_lineas: [...cfg.etiqueta_lineas] });
    expect(l.map((x) => x.texto)).toEqual(["Luzazul Accesorios", "ARETAS PERLA DE MALLORCA", "SLA013 40", "$ 118.900"]);
    const sinMiles = lineasDeEtiqueta(producto, { ...cfg, etiqueta_lineas: ["codigo_precio", "precio_publico"], etiqueta_mostrar_precio_miles: false });
    expect(sinMiles.map((x) => x.texto)).toEqual(["SLA013", "$ 118.900"]);
  });

  it("reduce la fuente hasta que el texto cabe", () => {
    const lineas = lineasDeEtiqueta(producto, { ...cfg, etiqueta_lineas: [...cfg.etiqueta_lineas] });
    // medida ficticia: cada carácter mide 0,6 × tamaño
    const ajuste = ajustarLineas(lineas, 300, 90, (l, t) => l.texto.length * 0.6 * t);
    expect(ajuste).toHaveLength(4);
    for (const a of ajuste) expect(a.linea.texto.length * 0.6 * a.tamano).toBeLessThanOrEqual(300);
    // la línea de precio (peso mayor) obtiene más altura que el nombre del negocio
    expect(ajuste[3].tamano).toBeGreaterThan(ajuste[0].tamano);
    // las posiciones verticales crecen
    expect(ajuste[1].y).toBeGreaterThan(ajuste[0].y);
    expect(ajuste[3].y).toBeLessThan(90);
  });

  it("nombre de archivo seguro", () => {
    expect(nombreArchivoEtiqueta("SLA013")).toBe("etiqueta-SLA013.png");
    expect(nombreArchivoEtiqueta("SLA 013/40")).toBe("etiqueta-SLA01340.png");
  });
});
