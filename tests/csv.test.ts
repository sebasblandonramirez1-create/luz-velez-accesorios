import { describe, expect, it } from "vitest";
import { categoriaDesdeTexto, detectarSeparador, escribirCsv, leerCsv, mapearEncabezados, normalizarEncabezado } from "@/lib/csv";

describe("csv", () => {
  it("detecta el separador", () => {
    expect(detectarSeparador("a;b;c\n1;2;3")).toBe(";");
    expect(detectarSeparador("a,b,c\n1,2,3")).toBe(",");
    expect(detectarSeparador("a\tb\n1\t2")).toBe("\t");
    expect(detectarSeparador("solo")).toBe(",");
  });
  it("lee comillas, saltos y BOM", () => {
    const texto = '﻿codigo;nombre;precio\r\nSLA013;"Aretas ""perla"", Mallorca";40.000\r\nSLA014;"Collar\ncorto";50000\r\n';
    expect(leerCsv(texto)).toEqual([
      ["codigo", "nombre", "precio"],
      ["SLA013", 'Aretas "perla", Mallorca', "40.000"],
      ["SLA014", "Collar\ncorto", "50000"],
    ]);
  });
  it("ignora filas vacías", () => {
    expect(leerCsv("a,b\n,\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("escribe con BOM, punto y coma y escapes", () => {
    const s = escribirCsv([
      ["codigo", "nombre"],
      ["SLA013", 'Aretas; "perla"'],
    ]);
    expect(s.startsWith("﻿")).toBe(true);
    expect(s).toContain('SLA013;"Aretas; ""perla"""');
    expect(leerCsv(s)).toEqual([
      ["codigo", "nombre"],
      ["SLA013", 'Aretas; "perla"'],
    ]);
  });
  it("normaliza encabezados y los mapea", () => {
    expect(normalizarEncabezado("Precio Público ")).toBe("precio_publico");
    expect(normalizarEncabezado("Código")).toBe("codigo");
    const mapa = mapearEncabezados(["Código", "Descripción", "Valor unitario", "Precio etiqueta", "Cantidad"]);
    expect(mapa).toEqual({ codigo: 0, nombre: 1, precio_base: 2, precio_publico: 3, stock_inicial: 4 });
  });
  it("adivina la categoría", () => {
    expect(categoriaDesdeTexto("Aretas perla")).toBe("areta");
    expect(categoriaDesdeTexto("Topo gancho dorado")).toBe("areta");
    expect(categoriaDesdeTexto("Pulsera murano")).toBe("pulsera");
    expect(categoriaDesdeTexto("Collar largo")).toBe("collar");
    expect(categoriaDesdeTexto("Anillo plata")).toBe("anillo");
    expect(categoriaDesdeTexto("Llavero")).toBe("otro");
  });
});
