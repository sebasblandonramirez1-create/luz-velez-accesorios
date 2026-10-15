import { describe, expect, it } from "vitest";
import { codigoClasificacionValido, conteoPorClasificacion, etiquetaClasificacion, nombreClasificacion, normalizarCodigoClasificacion, resumenClasificacionCorto } from "@/lib/clasificaciones";

const lista = [
  { codigo: "CP", nombre: "Collar de piedras" },
  { codigo: "CM", nombre: "Collar medio" },
  { codigo: "PL", nombre: "Pulsera" },
];

describe("códigos y etiquetas", () => {
  it("valida y normaliza el código", () => {
    expect(codigoClasificacionValido("CP")).toBe(true);
    expect(codigoClasificacionValido("cp")).toBe(false);
    expect(codigoClasificacionValido("CP1")).toBe(false);
    expect(codigoClasificacionValido("ABCDEFG")).toBe(false);
    expect(normalizarCodigoClasificacion(" collar-piedras ")).toBe("COLLAR");
    expect(normalizarCodigoClasificacion("plm")).toBe("PLM");
    expect(normalizarCodigoClasificacion("ñu")).toBe("NU");
  });
  it("arma la etiqueta y el nombre", () => {
    expect(etiquetaClasificacion("CP", lista)).toBe("CP · Collar de piedras");
    expect(etiquetaClasificacion("ZZ", lista)).toBe("ZZ");
    expect(etiquetaClasificacion(null, lista)).toBe("Sin clasificar");
    expect(nombreClasificacion("PL", lista)).toBe("Pulsera");
    expect(nombreClasificacion("", lista)).toBe("Sin clasificar");
  });
});

describe("conteoPorClasificacion", () => {
  it("cuenta referencias, piezas y valor en el orden de la lista, con lo sin clasificar al final", () => {
    const conteo = conteoPorClasificacion(
      [
        { codigo: "SLAP026", clasificacion: "PL", cantidad: 2, valor_unitario: 20000 },
        { codigo: "SLA013", clasificacion: "CP", cantidad: 3, valor_unitario: 40000 },
        { codigo: "SLA099", clasificacion: null, cantidad: 1, valor_unitario: 10000 },
        { codigo: "SLA014", clasificacion: "CP", cantidad: 1, valor_unitario: 42000 },
        { codigo: "SLA013", clasificacion: "CP", cantidad: 2, valor_unitario: 40000 },
      ],
      lista,
    );
    expect(conteo).toEqual([
      { codigo: "CP", nombre: "Collar de piedras", referencias: 2, piezas: 6, valor: 242000 },
      { codigo: "PL", nombre: "Pulsera", referencias: 1, piezas: 2, valor: 40000 },
      { codigo: null, nombre: "Sin clasificar", referencias: 1, piezas: 1, valor: 10000 },
    ]);
    expect(resumenClasificacionCorto(conteo)).toBe("CP 6 · PL 2 · Sin clasificar 1");
  });
  it("un código que ya no está en la lista se muestra igual, antes de lo sin clasificar", () => {
    const conteo = conteoPorClasificacion([{ clasificacion: "ZZ", cantidad: 1 }, { clasificacion: null, cantidad: 2 }, { clasificacion: "CM", cantidad: 1 }], lista);
    expect(conteo.map((c) => c.codigo)).toEqual(["CM", "ZZ", null]);
    expect(conteo[1].nombre).toBe("ZZ");
  });
  it("sin items no devuelve nada", () => {
    expect(conteoPorClasificacion([], lista)).toEqual([]);
  });
});
