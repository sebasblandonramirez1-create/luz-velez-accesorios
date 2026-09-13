import { describe, expect, it } from "vitest";
import { calcularPeriodo, desplazarPeriodo, sumarDias, ultimoDiaDelMes } from "@/lib/periodos";

describe("períodos", () => {
  it("día, mes y año", () => {
    expect(calcularPeriodo("dia", "2026-09-13")).toMatchObject({ desde: "2026-09-13", hasta: "2026-09-13", etiqueta: "13 de septiembre de 2026" });
    expect(calcularPeriodo("mes", "2026-02-10")).toMatchObject({ desde: "2026-02-01", hasta: "2026-02-28", etiqueta: "Febrero de 2026" });
    expect(calcularPeriodo("mes", "2028-02-10").hasta).toBe("2028-02-29");
    expect(calcularPeriodo("anio", "2026-09-13")).toMatchObject({ desde: "2026-01-01", hasta: "2026-12-31" });
  });
  it("semana de lunes a domingo", () => {
    // 13/09/2026 es domingo
    expect(calcularPeriodo("semana", "2026-09-13")).toMatchObject({ desde: "2026-09-07", hasta: "2026-09-13" });
    // 14/09/2026 es lunes
    expect(calcularPeriodo("semana", "2026-09-14")).toMatchObject({ desde: "2026-09-14", hasta: "2026-09-20" });
    expect(calcularPeriodo("semana", "2026-09-16")).toMatchObject({ desde: "2026-09-14", hasta: "2026-09-20" });
  });
  it("rango con valores por defecto y corrección de orden", () => {
    expect(calcularPeriodo("rango", "2026-09-13", { desde: "2026-09-01", hasta: "2026-09-10" })).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-10" });
    expect(calcularPeriodo("rango", "2026-09-13", { desde: "2026-09-20", hasta: "2026-09-10" })).toMatchObject({ desde: "2026-09-20", hasta: "2026-09-20" });
    expect(calcularPeriodo("rango", "2026-09-13", {})).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-13" });
  });
  it("desplaza períodos", () => {
    expect(desplazarPeriodo(calcularPeriodo("mes", "2026-12-05"), 1).referencia).toBe("2027-01-01");
    expect(desplazarPeriodo(calcularPeriodo("mes", "2026-01-05"), -1).referencia).toBe("2025-12-01");
    expect(desplazarPeriodo(calcularPeriodo("semana", "2026-09-13"), 1).referencia).toBe("2026-09-14");
    expect(desplazarPeriodo(calcularPeriodo("dia", "2026-09-13"), -1).referencia).toBe("2026-09-12");
    expect(desplazarPeriodo(calcularPeriodo("anio", "2026-09-13"), 1).referencia).toBe("2027-01-01");
    expect(desplazarPeriodo(calcularPeriodo("rango", "2026-09-13", { desde: "2026-09-01", hasta: "2026-09-10" }), 1)).toMatchObject({ desde: "2026-09-11", hasta: "2026-09-20" });
  });
  it("utilidades de fecha", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(ultimoDiaDelMes(2026, 2)).toBe(28);
    expect(ultimoDiaDelMes(2024, 2)).toBe(29);
  });
});
