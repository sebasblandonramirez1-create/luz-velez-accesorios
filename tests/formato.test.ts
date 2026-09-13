import { describe, expect, it } from "vitest";
import { enMiles, fecha, fechaHora, hoyIso, leerPesos, pesos, pesosConSigno, horasDesde } from "@/lib/formato";

describe("pesos", () => {
  it("usa punto de miles y sin decimales", () => {
    expect(pesos(118900)).toBe("118.900");
    expect(pesos(40000)).toBe("40.000");
    expect(pesos(1234567)).toBe("1.234.567");
    expect(pesos(0)).toBe("0");
    expect(pesos(null)).toBe("0");
    expect(pesos(999)).toBe("999");
    expect(pesos(-0)).toBe("0");
    expect(pesos(-118900)).toBe("-118.900");
  });
  it("redondea decimales", () => {
    expect(pesos(118900.4)).toBe("118.900");
  });
  it("con signo", () => {
    expect(pesosConSigno(118900)).toBe("$ 118.900");
  });
});

describe("leerPesos", () => {
  it("acepta texto con puntos, espacios y símbolo", () => {
    expect(leerPesos("118.900")).toBe(118900);
    expect(leerPesos("$ 40.000")).toBe(40000);
    expect(leerPesos("40000")).toBe(40000);
    expect(leerPesos("")).toBeNull();
    expect(leerPesos("abc")).toBeNull();
    expect(leerPesos(null)).toBeNull();
  });
});

describe("enMiles", () => {
  it("40.000 → 40, como en las hojas", () => {
    expect(enMiles(40000)).toBe("40");
    expect(enMiles(118900)).toBe("118,9");
    expect(enMiles(0)).toBe("0");
  });
});

describe("fechas en Bogotá", () => {
  it("dd/mm/aaaa", () => {
    expect(fecha("2026-09-11T03:00:00Z")).toBe("10/09/2026"); // 22:00 del día anterior en Bogotá
    expect(fecha("2026-09-11T12:00:00Z")).toBe("11/09/2026");
    expect(fecha(null)).toBe("");
    expect(fecha("no es fecha")).toBe("");
  });
  it("dd/mm/aaaa hh:mm", () => {
    expect(fechaHora("2026-09-11T12:05:00Z")).toBe("11/09/2026 07:05");
  });
  it("hoyIso devuelve aaaa-mm-dd", () => {
    expect(hoyIso(new Date("2026-09-11T03:00:00Z"))).toBe("2026-09-10");
  });
  it("horasDesde", () => {
    const ahora = new Date("2026-09-11T12:00:00Z");
    expect(horasDesde("2026-09-09T12:00:00Z", ahora)).toBe(48);
    expect(horasDesde(null, ahora)).toBeNull();
  });
});
