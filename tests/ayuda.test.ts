import { describe, expect, it } from "vitest";
import { AYUDA_POR_PANTALLA, ayudaPara, TAREAS_DEL_DIA } from "@/lib/ayuda";

describe("ayuda por pantalla", () => {
  it("encuentra la pantalla correcta, de la más específica a la más general", () => {
    expect(ayudaPara("/").titulo).toBe("Inicio");
    expect(ayudaPara("/productos").titulo).toBe("Productos");
    expect(ayudaPara("/productos/nuevo").titulo).toBe("Añadir un producto nuevo");
    expect(ayudaPara("/productos/123/editar").titulo).toBe("Editar un producto");
    expect(ayudaPara("/productos/123").titulo).toBe("Ficha del producto");
    expect(ayudaPara("/inventario/entrada").titulo).toBe("Ingresar productos al stock");
    expect(ayudaPara("/inventario").titulo).toBe("Inventario");
    expect(ayudaPara("/consignaciones/abc/modificar").titulo).toBe("Modificar una entrega");
    expect(ayudaPara("/consignaciones/abc/").titulo).toBe("Detalle de la consignación");
    expect(ayudaPara("/consignaciones").titulo).toBe("Consignaciones");
    expect(ayudaPara("/caja").titulo).toBe("Contabilidad");
    expect(ayudaPara("/algo-raro").titulo).toBe("Ayuda");
  });
  it("todas las pantallas y tareas tienen pasos claros y enlaces válidos", () => {
    for (const a of AYUDA_POR_PANTALLA) {
      expect(a.pasos.length).toBeGreaterThan(0);
      for (const p of a.pasos) expect(p.length).toBeLessThan(220);
      for (const e of a.enlaces ?? []) expect(e.href).toMatch(/^\//);
    }
    expect(TAREAS_DEL_DIA.length).toBeGreaterThanOrEqual(5);
    for (const t of TAREAS_DEL_DIA) expect(t.href).toMatch(/^\//);
  });
});
