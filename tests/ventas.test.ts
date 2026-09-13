import { describe, expect, it } from "vitest";
import {
  agruparEnBloques,
  antiguedad,
  enlaceWhatsApp,
  hojasConsignacion,
  nombreBloque,
  numeroDocumento,
  textoComprobanteVenta,
  textoRecordatorioSaldo,
  totalesCarrito,
  validarCarrito,
  type LineaCarrito,
  type LineaConsignacionHoja,
} from "@/lib/ventas";

const linea = (extra: Partial<LineaCarrito> = {}): LineaCarrito => ({
  producto_id: "p1",
  codigo: "SLA013",
  nombre: "Aretas perla",
  cantidad: 2,
  precio_unitario: 118900,
  descuento: 0,
  stock_actual: 5,
  ...extra,
});

describe("carrito", () => {
  it("calcula subtotal, descuento y total", () => {
    const t = totalesCarrito([linea(), linea({ producto_id: "p2", codigo: "SLA030", cantidad: 1, precio_unitario: 192900, descuento: 2900 })], 10000);
    expect(t.subtotal).toBe(2 * 118900 + 192900 - 2900);
    expect(t.total).toBe(t.subtotal - 10000);
    expect(t.unidades).toBe(3);
  });
  it("valida", () => {
    expect(validarCarrito([])).toMatch(/al menos un producto/);
    expect(validarCarrito([linea({ cantidad: 6 })])).toMatch(/solo hay 5/);
    expect(validarCarrito([linea({ cantidad: 0 })])).toMatch(/entero mayor/);
    expect(validarCarrito([linea({ descuento: 999999 })])).toMatch(/supera/);
    expect(validarCarrito([linea()])).toBeNull();
  });
  it("numera documentos", () => {
    expect(numeroDocumento("V", 7)).toBe("V-0007");
    expect(numeroDocumento("C", 12345)).toBe("C-12345");
  });
});

describe("textos de WhatsApp", () => {
  it("comprobante de venta", () => {
    const t = textoComprobanteVenta("Luz Vélez Accesorios", {
      numero: 3,
      fecha: "2026-09-13T15:00:00Z",
      total: 230900,
      descuento_total: 6900,
      medio_pago: "nequi",
      saldo: 0,
      lineas: [{ nombre: "Aretas perla", codigo: "SLA013", cantidad: 2, precio_unitario: 118900, descuento: 0 }],
    });
    expect(t).toContain("*Luz Vélez Accesorios*");
    expect(t).toContain("V-0003 · 13/09/2026");
    expect(t).toContain("• 2 × Aretas perla (SLA013) — $237.800");
    expect(t).toContain("Descuento: $6.900");
    expect(t).toContain("*Total: $230.900*");
    expect(t).toContain("Pago: Nequi · Pagado");
  });
  it("comprobante con saldo", () => {
    const t = textoComprobanteVenta("LV", { numero: 1, fecha: "2026-01-01", total: 100000, descuento_total: 0, medio_pago: "efectivo", saldo: 40000, lineas: [] });
    expect(t).toContain("Saldo pendiente: $40.000");
  });
  it("recordatorio de saldo", () => {
    const t = textoRecordatorioSaldo("Luz Vélez Accesorios", "Marcela Ríos", 45000, [{ descripcion: "Consignación C-0001", saldo: 45000 }]);
    expect(t.startsWith("Hola Marcela,")).toBe(true);
    expect(t).toContain("*$45.000*");
    expect(t).toContain("• Consignación C-0001: $45.000");
  });
  it("enlace de WhatsApp con indicativo", () => {
    expect(enlaceWhatsApp("300 123 4567", "hola")).toBe("https://wa.me/573001234567?text=hola");
    expect(enlaceWhatsApp("+57 300 123 4567", "hola")).toBe("https://wa.me/573001234567?text=hola");
    expect(enlaceWhatsApp("", "hola")).toBe("https://wa.me/?text=hola");
  });
});

describe("hojas de consignación", () => {
  const lineas: LineaConsignacionHoja[] = [
    { codigo: "SLA013", nombre: "Aretas perla de Mallorca", categoria: "areta", material: "Mallorca", valor_unitario: 40000, cantidad_entregada: 5, cantidad_vendida: 2, cantidad_devuelta: 1, cantidad_pendiente: 2 },
    { codigo: "SLA014", nombre: "Aretas perla topo presión", categoria: "areta", material: "Mallorca", valor_unitario: 38000, cantidad_entregada: 3, cantidad_vendida: 0, cantidad_devuelta: 3, cantidad_pendiente: 0 },
    { codigo: "SLA030", nombre: "Collar perla", categoria: "collar", material: "Mallorca", valor_unitario: 65000, cantidad_entregada: 2, cantidad_vendida: 1, cantidad_devuelta: 0, cantidad_pendiente: 1 },
    { codigo: "SLAP038", nombre: "Pulsera shell", categoria: "pulsera", material: "", valor_unitario: 25000, cantidad_entregada: 4, cantidad_vendida: 1, cantidad_devuelta: 2, cantidad_pendiente: 1 },
  ];

  it("nombres de bloque", () => {
    expect(nombreBloque({ categoria: "areta", material: "Mallorca" })).toBe("Aretas Mallorca");
    expect(nombreBloque({ categoria: "pulsera", material: "" })).toBe("Productos varios");
  });

  it("VENTAS, DEVOLUCIONES y PENDIENTE cuadran con lo entregado", () => {
    const h = hojasConsignacion(lineas);
    expect(h.entregado.total).toBe(5 * 40000 + 3 * 38000 + 2 * 65000 + 4 * 25000);
    expect(h.ventas.total).toBe(2 * 40000 + 65000 + 25000);
    expect(h.devoluciones.total).toBe(40000 + 3 * 38000 + 2 * 25000);
    expect(h.pendientes.total).toBe(2 * 40000 + 65000 + 25000);
    expect(h.ventas.total + h.devoluciones.total + h.pendientes.total).toBe(h.entregado.total);
    expect(h.ventas.filas.map((f) => f.codigo)).toEqual(["SLA013", "SLA030", "SLAP038"]);
  });

  it("DEVOLUCIONES agrupa por bloque con totales", () => {
    const bloques = agruparEnBloques(lineas, (l) => l.cantidad_devuelta);
    expect(bloques.map((b) => b.titulo)).toEqual(["Aretas Mallorca", "Productos varios"]);
    expect(bloques[0].total).toBe(40000 + 3 * 38000);
    expect(bloques[0].filas).toHaveLength(2);
    expect(bloques[1].total).toBe(50000);
  });

  it("antigüedad", () => {
    expect(antiguedad(0)).toBe("de hoy");
    expect(antiguedad(1)).toBe("1 día");
    expect(antiguedad(12)).toBe("12 días");
    expect(antiguedad(45)).toBe("1 mes");
    expect(antiguedad(95)).toBe("3 meses");
  });
});
