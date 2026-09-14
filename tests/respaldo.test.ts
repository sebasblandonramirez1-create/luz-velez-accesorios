import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { armarZip, copiasParaBorrar, leerZip, nombreRespaldo } from "@/lib/respaldo";

describe("respaldo (zip y retención)", () => {
  it("arma y lee un zip con meta, JSON, CSV y fotos", () => {
    const tablas = {
      productos: [{ id: "a", codigo: "SLA013", nombre: "Aretas; perla", precio_base: 40000, creado_en: "2026-09-13T10:00:00.000Z", etiqueta: null }],
      contactos: [],
    };
    const fotos = [{ ruta: "productos/a/1.jpg", bytes: new Uint8Array([1, 2, 3]) }];
    const zip = armarZip(tablas, fotos, new Date("2026-09-13T12:00:00Z"));
    const partes = unzipSync(zip);
    expect(Object.keys(partes).sort()).toEqual(["datos/contactos.csv", "datos/contactos.json", "datos/productos.csv", "datos/productos.json", "fotos/productos/a/1.jpg", "meta.json"]);
    expect(strFromU8(partes["datos/productos.csv"])).toContain('SLA013;"Aretas; perla";40000');
    const leido = leerZip(zip);
    expect(leido.meta).toMatchObject({ version: 1, conteos: { productos: 1, contactos: 0 }, fotos: 1, fecha: "2026-09-13T12:00:00.000Z" });
    expect(leido.tablas.productos[0]).toEqual(tablas.productos[0]);
    expect(leido.fotos[0]).toEqual({ ruta: "productos/a/1.jpg", bytes: new Uint8Array([1, 2, 3]) });
  });

  it("rechaza archivos que no son respaldos", () => {
    expect(() => leerZip(armarZip({}, []).slice(0, 10))).toThrow();
    const sinMeta = unzipSync(armarZip({}, []));
    delete sinMeta["meta.json"];
    expect(() => leerZip(new Uint8Array(0))).toThrow();
  });

  it("nombra la copia con la fecha de Bogotá", () => {
    expect(nombreRespaldo(new Date("2026-09-14T03:00:00Z"))).toBe("respaldo-2026-09-13.zip");
    expect(nombreRespaldo(new Date("2026-09-14T12:00:00Z"))).toBe("respaldo-2026-09-14.zip");
  });

  it("conserva 30 diarias y 12 mensuales", () => {
    const nombres: string[] = [];
    // 400 días seguidos hasta el 13/09/2026
    for (let i = 0; i < 400; i++) {
      const d = new Date(Date.UTC(2026, 8, 13) - i * 86_400_000);
      nombres.push(`respaldo-${d.toISOString().slice(0, 10)}.zip`);
    }
    nombres.push("otro-archivo.txt");
    const borrar = copiasParaBorrar(nombres);
    const conservadas = nombres.filter((n) => !borrar.includes(n) && n !== "otro-archivo.txt");
    // últimas 30 diarias
    for (let i = 0; i < 30; i++) expect(conservadas).toContain(nombres[i]);
    expect(conservadas).not.toContain(nombres[31]);
    // primera copia de cada uno de los 12 meses más recientes (sep 2026 … oct 2025)
    expect(conservadas).toContain("respaldo-2026-09-01.zip");
    expect(conservadas).toContain("respaldo-2026-08-01.zip");
    expect(conservadas).toContain("respaldo-2025-10-01.zip");
    expect(conservadas).not.toContain("respaldo-2025-09-01.zip");
    expect(conservadas).not.toContain("respaldo-2026-07-15.zip");
    expect(conservadas.length).toBe(30 + 12 - 1); // septiembre 2026 ya está entre las 30 diarias
    expect(borrar).not.toContain("otro-archivo.txt"); // archivos ajenos no se tocan
  });
});
