import { describe, expect, it } from "vitest";
import { describirCambio, diferenciasConsignacion, mensajeErrorModificacion, resumenModificacion, totalesLineas, type EstadoConsignacionEditable } from "@/lib/modificaciones";

const antes: EstadoConsignacionEditable = {
  lineas: [
    { producto_id: "a", codigo: "SLA013", nombre: "Aretas perla", cantidad: 4, valor_unitario: 40000 },
    { producto_id: "c", codigo: "SLA030", nombre: "Collar perla", cantidad: 2, valor_unitario: 65000 },
    { producto_id: "p", codigo: "SLAP026", nombre: "Pulsera tejida", cantidad: 3, valor_unitario: 20000 },
  ],
  fecha_limite: "2026-10-31",
  nota: "",
};

describe("diferenciasConsignacion", () => {
  it("sin cambios no devuelve nada", () => {
    expect(diferenciasConsignacion(antes, { ...antes, nota: "  " })).toEqual([]);
  });

  it("detecta retiros, cantidades, valores, piezas nuevas, fecha y nota, en el orden del registro", () => {
    const despues: EstadoConsignacionEditable = {
      lineas: [
        { producto_id: "a", codigo: "SLA013", nombre: "Aretas perla", cantidad: 6, valor_unitario: 42000 },
        { producto_id: "c", codigo: "SLA030", nombre: "Collar perla", cantidad: 1, valor_unitario: 65000 },
        { producto_id: "n", codigo: "SLA100", nombre: "Anillo ajustable", cantidad: 1, valor_unitario: 30000 },
      ],
      fecha_limite: "2026-11-15",
      nota: " Entrega ajustada ",
    };
    expect(diferenciasConsignacion(antes, despues)).toEqual([
      { tipo: "pieza_retirada", codigo: "SLAP026", nombre: "Pulsera tejida", cantidad: 3, valor_unitario: 20000 },
      { tipo: "cantidad", codigo: "SLA013", nombre: "Aretas perla", antes: 4, despues: 6 },
      { tipo: "valor", codigo: "SLA013", nombre: "Aretas perla", antes: 40000, despues: 42000 },
      { tipo: "cantidad", codigo: "SLA030", nombre: "Collar perla", antes: 2, despues: 1 },
      { tipo: "pieza_agregada", codigo: "SLA100", nombre: "Anillo ajustable", cantidad: 1, valor_unitario: 30000 },
      { tipo: "fecha_limite", antes: "2026-10-31", despues: "2026-11-15" },
      { tipo: "nota", antes: "", despues: "Entrega ajustada" },
    ]);
    expect(totalesLineas(despues.lineas)).toEqual({ piezas: 8, total: 347000 });
  });
});

describe("textos del historial", () => {
  it("describe cada tipo de cambio", () => {
    expect(describirCambio({ tipo: "pieza_agregada", codigo: "SLA100", nombre: "Anillo", cantidad: 1, valor_unitario: 30000 })).toBe("Se añadió Anillo (SLA100): 1 pieza a $30.000.");
    expect(describirCambio({ tipo: "pieza_retirada", codigo: "SLAP026", nombre: "Pulsera", cantidad: 3, valor_unitario: 20000 })).toBe("Se retiró Pulsera (SLAP026): 3 piezas volvieron al inventario.");
    expect(describirCambio({ tipo: "pieza_retirada", codigo: "SLA100", nombre: "Anillo", cantidad: 1, valor_unitario: 30000 })).toBe("Se retiró Anillo (SLA100): 1 pieza volvió al inventario.");
    expect(describirCambio({ tipo: "cantidad", codigo: "SLA013", nombre: "Aretas", antes: 4, despues: 6 })).toBe("Aretas (SLA013): la cantidad pasó de 4 a 6 (salen 2 piezas más del inventario).");
    expect(describirCambio({ tipo: "cantidad", codigo: "SLA030", nombre: "Collar", antes: 2, despues: 1 })).toBe("Collar (SLA030): la cantidad pasó de 2 a 1 (1 pieza vuelve al inventario).");
    expect(describirCambio({ tipo: "valor", codigo: "SLA013", nombre: "Aretas", antes: 40000, despues: 42000 })).toBe("Aretas (SLA013): el valor unitario pasó de $40.000 a $42.000.");
    expect(describirCambio({ tipo: "fecha_limite", antes: "2026-10-31", despues: "2026-11-15" })).toBe("La fecha límite pasó de 31/10/2026 a 15/11/2026.");
    expect(describirCambio({ tipo: "nota", antes: "", despues: "Ajuste" })).toBe("La nota quedó así: «Ajuste».");
    expect(describirCambio({ tipo: "nota", antes: "Vieja", despues: "" })).toBe("Se borró la nota (antes: «Vieja»).");
    expect(describirCambio({ tipo: "firma_anulada", firmante: "Marcela Ríos", documento: "43123456", firmado_en: "2026-10-02T14:30:00Z" })).toBe(
      "Se anuló la firma electrónica de Marcela Ríos (C.C. / NIT 43123456), hecha el 02/10/2026 09:30, porque el recibo cambió.",
    );
  });

  it("resume el antes y el después", () => {
    expect(resumenModificacion({ piezas_antes: 6, piezas_despues: 10, total_antes: 290000, total_despues: 365000 })).toBe("De 6 piezas ($290.000) a 10 piezas ($365.000).");
    expect(resumenModificacion({ piezas_antes: 1, piezas_despues: 1, total_antes: 40000, total_despues: 40000 })).toBe("Sin cambio en las piezas: 1 pieza por $40.000.");
  });

  it("traduce los errores de la base de datos", () => {
    expect(mensajeErrorModificacion("CANTIDAD_MENOR_A_LIQUIDADA: de SLA013 ya se liquidaron 3 piezas y se intenta dejar 2")).toBe("De SLA013 ya se liquidaron 3 piezas: no puedes dejar menos de 3.");
    expect(mensajeErrorModificacion("LINEA_CON_LIQUIDACION: SLA013 ya tiene 3 piezas liquidadas y no se puede retirar")).toMatch(/SLA013 ya tiene piezas liquidadas/);
    expect(mensajeErrorModificacion("VALOR_CON_VENTAS: SLA013 ya tiene piezas vendidas")).toMatch(/valor unitario no se puede cambiar/);
    expect(mensajeErrorModificacion("SIN_CAMBIOS: no hay nada")).toMatch(/No cambiaste nada/);
    expect(mensajeErrorModificacion("RECIBO_FIRMADO: x")).toMatch(/firma se anula/);
    expect(mensajeErrorModificacion("otra cosa")).toBeNull();
  });
});
