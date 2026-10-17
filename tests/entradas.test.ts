import { describe, expect, it } from "vitest";
import { resumenEntrada, totalesEntrada, validarEntrada, type LineaEntrada } from "@/lib/entradas";

const linea = (codigo: string, cantidad: number, valor = 10000): LineaEntrada => ({ producto_id: codigo, codigo, nombre: codigo, stock_actual: 1, cantidad, valor_unitario: valor });

describe("entrada al stock en lote", () => {
  it("suma solo las líneas con cantidad", () => {
    expect(totalesEntrada([linea("A", 2, 10000), linea("B", 0, 5000), linea("C", 3, 20000)])).toEqual({ productos: 2, unidades: 5, valor: 80000 });
    expect(resumenEntrada([linea("A", 1, 0)])).toBe("1 producto · 1 unidad");
    expect(resumenEntrada([linea("A", 2, 10000), linea("C", 3, 20000)])).toBe("2 productos · 5 unidades · $80.000");
  });

  it("valida tipo, repetidos, cantidades y costos", () => {
    expect(validarEntrada([linea("A", 1)], "entrada_compra")).toBeNull();
    expect(validarEntrada([linea("A", 1)], "salida_venta")).toMatch(/tipo/);
    expect(validarEntrada([], "entrada_compra")).toMatch(/al menos un producto/);
    expect(validarEntrada([linea("A", 1), linea("A", 2)], "entrada_compra")).toMatch(/dos veces/);
    expect(validarEntrada([linea("A", -1)], "entrada_compra")).toMatch(/entero/);
    expect(validarEntrada([linea("A", 1.5)], "entrada_compra")).toMatch(/entero/);
    expect(validarEntrada([linea("A", 1, -5)], "entrada_compra")).toMatch(/costo/);
    expect(validarEntrada([linea("A", 0), linea("B", 0)], "ajuste_entrada")).toMatch(/cantidad que entra/);
  });
});
