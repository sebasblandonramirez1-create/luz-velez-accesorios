import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let db: PostgresDePruebas;
let propietaria: string;
let ayudante: string;
let vendedora: string;
let clienta: string;
let aretas: string;
let collar: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.cliente.query(sql, params);
  return r.rows as T[];
}

async function stock(id: string) {
  return (await q<{ s: number }>("select stock_actual as s from public.productos where id = $1", [id]))[0].s;
}

async function registrar(fn: string, p: unknown): Promise<string> {
  return (await q<{ id: string }>(`select public.${fn}($1::jsonb) as id`, [JSON.stringify(p)]))[0].id;
}

beforeAll(async () => {
  db = await iniciarPostgresDePruebas();
  propietaria = await db.crearUsuaria("luz@ejemplo.com", "Luz");
  ayudante = await db.crearUsuaria("ayuda@ejemplo.com", "Ayudante");
  await db.iniciarSesion(propietaria);
  vendedora = (await q<{ id: string }>("insert into public.contactos (nombre, tipo) values ('Marcela', 'vendedora') returning id"))[0].id;
  clienta = (await q<{ id: string }>("insert into public.contactos (nombre, tipo) values ('Clara', 'cliente') returning id"))[0].id;
  aretas = (
    await q<{ id: string }>(
      "insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ('SLA013', 'Aretas perla', 'areta', 40000, 118900) returning id",
    )
  )[0].id;
  collar = (
    await q<{ id: string }>(
      "insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ('SLA030', 'Collar perla', 'collar', 65000, 192900) returning id",
    )
  )[0].id;
  await q("insert into public.movimientos_inventario (tipo, producto_id, cantidad) values ('entrada_compra', $1, 20), ('entrada_compra', $2, 10)", [aretas, collar]);
});

afterAll(async () => {
  await db?.detener();
});

describe("ventas directas", () => {
  it("una venta pagada saca inventario, calcula totales y queda con cuenta pagada", async () => {
    await db.iniciarSesion(ayudante); // la ayudante puede registrar ventas
    const id = await registrar("registrar_venta", {
      medio_pago: "nequi",
      estado_pago: "pagada",
      lineas: [
        { producto_id: aretas, cantidad: 2, precio_unitario: 118900, descuento: 900 },
        { producto_id: collar, cantidad: 1, precio_unitario: 192900 },
      ],
    });
    const [v] = await q<{ subtotal: number; total: number; numero: number }>("select subtotal, total, numero from public.ventas where id = $1", [id]);
    expect(v.subtotal).toBe(2 * 118900 - 900 + 192900);
    expect(v.total).toBe(v.subtotal);
    expect(v.numero).toBe(1);
    expect(await stock(aretas)).toBe(18);
    expect(await stock(collar)).toBe(9);
    const [c] = await q<{ valor_total: number; abonado: number; saldo: number; estado: string }>(
      "select valor_total, abonado, saldo, estado from public.cuentas_por_cobrar where origen_tipo = 'venta' and origen_id = $1",
      [id],
    );
    expect(c).toEqual({ valor_total: v.total, abonado: v.total, saldo: 0, estado: "pagada" });
    const abonos = await q<{ medio_pago: string; valor: number }>("select medio_pago, valor from public.abonos where cuenta_id = (select id from public.cuentas_por_cobrar where origen_id = $1)", [id]);
    expect(abonos).toEqual([{ medio_pago: "nequi", valor: v.total }]);
  });

  it("no vende más de lo que hay", async () => {
    await db.iniciarSesion(propietaria);
    await expect(
      registrar("registrar_venta", { estado_pago: "pagada", lineas: [{ producto_id: collar, cantidad: 50, precio_unitario: 192900 }] }),
    ).rejects.toThrow(/STOCK_INSUFICIENTE/);
    expect(await stock(collar)).toBe(9); // la transacción entera se deshizo
    expect((await q("select count(*)::int as n from public.ventas"))[0].n).toBe(1);
  });

  it("una venta con abono parcial exige clienta y deja saldo", async () => {
    await db.iniciarSesion(propietaria);
    await expect(
      registrar("registrar_venta", { estado_pago: "abono", abono: 50000, lineas: [{ producto_id: aretas, cantidad: 1, precio_unitario: 118900 }] }),
    ).rejects.toThrow(/VENTA_PENDIENTE_SIN_CONTACTO/);
    const id = await registrar("registrar_venta", {
      contacto_id: clienta,
      estado_pago: "abono",
      abono: 50000,
      descuento_total: 8900,
      lineas: [{ producto_id: aretas, cantidad: 1, precio_unitario: 118900 }],
    });
    const [c] = await q<{ saldo: number; estado: string; contacto_id: string }>("select saldo, estado, contacto_id from public.cuentas_por_cobrar where origen_id = $1", [id]);
    expect(c).toEqual({ saldo: 110000 - 50000, estado: "abierta", contacto_id: clienta });
    const [s] = await q<{ saldo: number; nombre: string }>("select saldo, nombre from public.saldos_por_contacto where contacto_id = $1", [clienta]);
    expect(s).toEqual({ saldo: 60000, nombre: "Clara" });
  });

  it("un abono no puede superar el saldo y al completar cierra la cuenta", async () => {
    await db.iniciarSesion(propietaria);
    const [c] = await q<{ id: string; saldo: number }>("select id, saldo from public.cuentas_por_cobrar where contacto_id = $1 and estado = 'abierta'", [clienta]);
    await expect(registrar("registrar_abono", { cuenta_id: c.id, valor: c.saldo + 1 })).rejects.toThrow(/ABONO_EXCEDE/);
    await registrar("registrar_abono", { cuenta_id: c.id, valor: c.saldo, medio_pago: "efectivo" });
    const [d] = await q<{ saldo: number; estado: string }>("select saldo, estado from public.cuentas_por_cobrar where id = $1", [c.id]);
    expect(d).toEqual({ saldo: 0, estado: "pagada" });
    expect(await q("select * from public.saldos_por_contacto where contacto_id = $1", [clienta])).toHaveLength(0);
  });

  it("enviar la venta a la papelera devuelve el inventario y anula la cuenta; restaurar lo rehace", async () => {
    await db.iniciarSesion(propietaria);
    const antes = await stock(collar);
    const id = await registrar("registrar_venta", { estado_pago: "pagada", lineas: [{ producto_id: collar, cantidad: 2, precio_unitario: 192900 }] });
    expect(await stock(collar)).toBe(antes - 2);
    await q("update public.ventas set eliminado_en = now() where id = $1", [id]);
    expect(await stock(collar)).toBe(antes);
    expect((await q<{ e: string | null }>("select eliminado_en as e from public.cuentas_por_cobrar where origen_id = $1", [id]))[0].e).not.toBeNull();
    await q("update public.ventas set eliminado_en = null where id = $1", [id]);
    expect(await stock(collar)).toBe(antes - 2);
    expect((await q<{ e: string | null }>("select eliminado_en as e from public.cuentas_por_cobrar where origen_id = $1", [id]))[0].e).toBeNull();
  });

  it("la ayudante no puede anular una venta", async () => {
    await db.iniciarSesion(propietaria);
    const id = await registrar("registrar_venta", { estado_pago: "pagada", lineas: [{ producto_id: aretas, cantidad: 1, precio_unitario: 118900 }] });
    await db.iniciarSesion(ayudante);
    await expect(q("update public.ventas set eliminado_en = now() where id = $1", [id])).rejects.toThrow(/SIN_PERMISO/);
  });
});

describe("consignaciones", () => {
  let consignacionId: string;
  let lineaAretas: string;
  let lineaCollar: string;

  it("la entrega saca inventario y abre la consignación", async () => {
    await db.iniciarSesion(propietaria);
    const stockAretas = await stock(aretas);
    const stockCollar = await stock(collar);
    consignacionId = await registrar("registrar_consignacion", {
      contacto_id: vendedora,
      lineas: [
        { producto_id: aretas, cantidad: 5, valor_unitario: 40000 },
        { producto_id: collar, cantidad: 2, valor_unitario: 65000 },
      ],
    });
    expect(await stock(aretas)).toBe(stockAretas - 5);
    expect(await stock(collar)).toBe(stockCollar - 2);
    const [c] = await q<{ estado: string; total_entregado: number; total_pendiente: number; total_vendido: number }>(
      "select estado, total_entregado, total_pendiente, total_vendido from public.consignaciones where id = $1",
      [consignacionId],
    );
    expect(c).toEqual({ estado: "abierta", total_entregado: 5 * 40000 + 2 * 65000, total_pendiente: 5 * 40000 + 2 * 65000, total_vendido: 0 });
    const lineas = await q<{ id: string; producto_id: string }>("select id, producto_id from public.consignacion_lineas where consignacion_id = $1", [consignacionId]);
    lineaAretas = lineas.find((l) => l.producto_id === aretas)!.id;
    lineaCollar = lineas.find((l) => l.producto_id === collar)!.id;
  });

  it("la liquidación acumula vendido y devuelto, devuelve al inventario y genera saldo", async () => {
    await db.iniciarSesion(ayudante);
    const stockAretas = await stock(aretas);
    await registrar("registrar_liquidacion", {
      consignacion_id: consignacionId,
      lineas: [
        { consignacion_linea_id: lineaAretas, cantidad_vendida: 2, cantidad_devuelta: 1 },
        { consignacion_linea_id: lineaCollar, cantidad_vendida: 1, cantidad_devuelta: 0 },
      ],
      abono: 100000,
      medio_pago: "transferencia",
    });
    expect(await stock(aretas)).toBe(stockAretas + 1);
    const lineas = await q<{ producto_id: string; cantidad_entregada: number; cantidad_vendida: number; cantidad_devuelta: number; cantidad_pendiente: number }>(
      "select producto_id, cantidad_entregada, cantidad_vendida, cantidad_devuelta, cantidad_pendiente from public.consignacion_lineas where consignacion_id = $1",
      [consignacionId],
    );
    for (const l of lineas) expect(l.cantidad_vendida + l.cantidad_devuelta + l.cantidad_pendiente).toBe(l.cantidad_entregada);
    const [c] = await q<{ estado: string; total_vendido: number; total_devuelto: number; total_pendiente: number }>(
      "select estado, total_vendido, total_devuelto, total_pendiente from public.consignaciones where id = $1",
      [consignacionId],
    );
    expect(c).toEqual({ estado: "parcial", total_vendido: 2 * 40000 + 65000, total_devuelto: 40000, total_pendiente: 2 * 40000 + 65000 });
    const [cuenta] = await q<{ valor_total: number; abonado: number; saldo: number }>("select valor_total, abonado, saldo from public.cuentas_por_cobrar where origen_tipo = 'consignacion' and origen_id = $1", [consignacionId]);
    expect(cuenta).toEqual({ valor_total: 145000, abonado: 100000, saldo: 45000 });
  });

  it("no se puede liquidar más de lo pendiente", async () => {
    await db.iniciarSesion(propietaria);
    await expect(
      registrar("registrar_liquidacion", { consignacion_id: consignacionId, lineas: [{ consignacion_linea_id: lineaAretas, cantidad_vendida: 3, cantidad_devuelta: 0 }] }),
    ).rejects.toThrow(/LIQUIDACION_EXCEDE/);
    await expect(registrar("registrar_liquidacion", { consignacion_id: consignacionId, lineas: [] })).rejects.toThrow(/LIQUIDACION_VACIA/);
  });

  it("al liquidar todo, la consignación se cierra y vendido + devuelto = entregado", async () => {
    await db.iniciarSesion(propietaria);
    await registrar("registrar_liquidacion", {
      consignacion_id: consignacionId,
      lineas: [
        { consignacion_linea_id: lineaAretas, cantidad_vendida: 0, cantidad_devuelta: 2 },
        { consignacion_linea_id: lineaCollar, cantidad_vendida: 0, cantidad_devuelta: 1 },
      ],
    });
    const [c] = await q<{ estado: string; total_entregado: number; total_vendido: number; total_devuelto: number; total_pendiente: number }>(
      "select estado, total_entregado, total_vendido, total_devuelto, total_pendiente from public.consignaciones where id = $1",
      [consignacionId],
    );
    expect(c.estado).toBe("cerrada");
    expect(c.total_pendiente).toBe(0);
    expect(c.total_vendido + c.total_devuelto).toBe(c.total_entregado);
    // todo lo devuelto volvió al inventario: stock = 20 - ventas directas (2+1+1) - 2 vendidas en consignación
    expect(await stock(aretas)).toBe(20 - 4 - 2);
  });

  it("anular una liquidación deshace cantidades y retornos; restaurarla los reaplica", async () => {
    await db.iniciarSesion(propietaria);
    const [liq] = await q<{ id: string }>("select id from public.liquidaciones where consignacion_id = $1 order by creado_en desc limit 1", [consignacionId]);
    const antes = await stock(aretas);
    await q("update public.liquidaciones set eliminado_en = now() where id = $1", [liq.id]);
    expect(await stock(aretas)).toBe(antes - 2);
    expect((await q<{ e: string }>("select estado as e from public.consignaciones where id = $1", [consignacionId]))[0].e).toBe("parcial");
    await q("update public.liquidaciones set eliminado_en = null where id = $1", [liq.id]);
    expect(await stock(aretas)).toBe(antes);
    expect((await q<{ e: string }>("select estado as e from public.consignaciones where id = $1", [consignacionId]))[0].e).toBe("cerrada");
  });

  it("una consignación con liquidaciones no se puede mandar a la papelera", async () => {
    await db.iniciarSesion(propietaria);
    await expect(q("update public.consignaciones set eliminado_en = now() where id = $1", [consignacionId])).rejects.toThrow(/CONSIGNACION_CON_LIQUIDACIONES/);
  });

  it("el saldo de la vendedora aparece en saldos_por_contacto", async () => {
    const [s] = await q<{ saldo: number; cuentas_abiertas: number }>("select saldo, cuentas_abiertas from public.saldos_por_contacto where contacto_id = $1", [vendedora]);
    expect(s).toEqual({ saldo: 45000, cuentas_abiertas: 1 });
  });

  it("la papelera lista ventas, consignaciones, liquidaciones y abonos", async () => {
    await db.iniciarSesion(propietaria);
    const id = await registrar("registrar_consignacion", { contacto_id: vendedora, lineas: [{ producto_id: collar, cantidad: 1, valor_unitario: 65000 }] });
    await q("update public.consignaciones set eliminado_en = now() where id = $1", [id]);
    const filas = await q<{ tabla: string; descripcion: string }>("select tabla, descripcion from public.papelera");
    expect(filas.some((f) => f.tabla === "consignaciones" && /Marcela/.test(f.descripcion))).toBe(true);
    expect(filas.some((f) => f.tabla === "ventas")).toBe(false); // la venta anulada antes se restauró
  });

  it("todo el stock sigue cuadrando con los movimientos", async () => {
    const r = await q<{ n: number }>("select count(*)::int as n from public.productos where stock_actual <> public.stock_calculado(id)");
    expect(r[0].n).toBe(0);
  });
});
