import { describe, expect, it } from "vitest";
import { precioPublicoSugerido, redondearPrecio } from "@/lib/precios";
import { interpretarCodigoDeHoja, normalizarCodigo, prefijoParaCategoria, siguienteCodigo, codigoValido } from "@/lib/codigos";
import { calcularStock, validarMovimiento, tiposManuales } from "@/lib/inventario";

describe("redondeo de precios", () => {
  it("terminación 900", () => {
    expect(redondearPrecio(118_800, "terminacion_900")).toBe(118_900);
    expect(redondearPrecio(120_000, "terminacion_900")).toBe(119_900);
    expect(redondearPrecio(119_950, "terminacion_900")).toBe(119_900);
    expect(redondearPrecio(500, "terminacion_900")).toBe(900);
  });
  it("centena y mil", () => {
    expect(redondearPrecio(118_849, "centena")).toBe(118_800);
    expect(redondearPrecio(118_850, "centena")).toBe(118_900);
    expect(redondearPrecio(118_499, "mil")).toBe(118_000);
    expect(redondearPrecio(118_500, "mil")).toBe(119_000);
  });
  it("ninguno", () => {
    expect(redondearPrecio(118_849.6, "ninguno")).toBe(118_850);
    expect(redondearPrecio(0, "ninguno")).toBe(0);
  });
});

describe("precio público sugerido", () => {
  it("manual no sugiere nada", () => {
    expect(
      precioPublicoSugerido(40_000, { regla_precio_publico: "manual", factor_precio_publico: 3, redondeo_precio_publico: "mil" }),
    ).toBeNull();
  });
  it("multiplicador con redondeo", () => {
    expect(
      precioPublicoSugerido(40_000, {
        regla_precio_publico: "multiplicador",
        factor_precio_publico: 2.97,
        redondeo_precio_publico: "terminacion_900",
      }),
    ).toBe(118_900);
  });
  it("factor inválido", () => {
    expect(
      precioPublicoSugerido(40_000, { regla_precio_publico: "multiplicador", factor_precio_publico: 0, redondeo_precio_publico: "mil" }),
    ).toBeNull();
  });
});

describe("códigos", () => {
  const prefijos = { prefijo_general: "SLA", prefijo_pulsera: "SLAP" };
  it("prefijo por categoría", () => {
    expect(prefijoParaCategoria("pulsera", prefijos)).toBe("SLAP");
    expect(prefijoParaCategoria("areta", prefijos)).toBe("SLA");
  });
  it("siguiente código no mezcla SLA con SLAP", () => {
    const existentes = ["SLA013", "SLA040", "SLAP026", "SLAP037", "OTRO1"];
    expect(siguienteCodigo("SLA", existentes)).toBe("SLA041");
    expect(siguienteCodigo("SLAP", existentes)).toBe("SLAP038");
    expect(siguienteCodigo("NUEVO", existentes)).toBe("NUEVO001");
    expect(siguienteCodigo("SLA", ["SLA999"])).toBe("SLA1000");
  });
  it("normaliza y valida", () => {
    expect(normalizarCodigo(" sla 013 ")).toBe("SLA013");
    expect(codigoValido("SLA013")).toBe(true);
    expect(codigoValido("S")).toBe(false);
    expect(codigoValido("sla013")).toBe(false);
  });
  it("interpreta «SLA013 40» de las hojas", () => {
    expect(interpretarCodigoDeHoja("SLA013 40")).toEqual({ codigo: "SLA013", precioBase: 40_000 });
    expect(interpretarCodigoDeHoja("SLAP026 35")).toEqual({ codigo: "SLAP026", precioBase: 35_000 });
    expect(interpretarCodigoDeHoja("SLA013")).toEqual({ codigo: "SLA013", precioBase: null });
    expect(interpretarCodigoDeHoja("SLA013 12,5")).toEqual({ codigo: "SLA013", precioBase: 12_500 });
  });
});

describe("inventario puro", () => {
  it("el stock es la suma con signo, ignorando la papelera", () => {
    expect(
      calcularStock([
        { tipo: "entrada_compra", cantidad: 10 },
        { tipo: "salida_venta", cantidad: 3 },
        { tipo: "salida_consignacion", cantidad: 4 },
        { tipo: "retorno_consignacion", cantidad: 2 },
        { tipo: "perdida", cantidad: 1 },
        { tipo: "obsequio", cantidad: 1, eliminado_en: "2026-01-01" },
      ]),
    ).toBe(4);
  });
  it("valida cantidades y stock", () => {
    expect(validarMovimiento("salida_venta", 0, 5)).toMatch(/entero/);
    expect(validarMovimiento("salida_venta", 6, 5)).toMatch(/Solo hay 5/);
    expect(validarMovimiento("salida_venta", 5, 5)).toBeNull();
    expect(validarMovimiento("entrada_compra", 100, 0)).toBeNull();
  });
  it("tipos manuales", () => {
    expect(tiposManuales()).toEqual(["entrada_compra", "ajuste_entrada", "ajuste_salida", "perdida", "obsequio"]);
  });
});
