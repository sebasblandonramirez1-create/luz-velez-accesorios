import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let db: PostgresDePruebas;
let propietaria: string;
let ayudante: string;
let proveedor: string;
let vendedora: string;
let aretas: string;
let collar: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.cliente.query(sql, params)).rows as T[];
}
async function stock(id: string) {
  return (await q<{ s: number }>("select stock_actual as s from public.productos where id = $1", [id]))[0].s;
}
async function rpc(fn: string, p: unknown): Promise<string> {
  return (await q<{ id: string }>(`select public.${fn}($1::jsonb) as id`, [JSON.stringify(p)]))[0].id;
}

beforeAll(async () => {
  db = await iniciarPostgresDePruebas();
  propietaria = await db.crearUsuaria("luz@ejemplo.com", "Luz");
  ayudante = await db.crearUsuaria("ayuda@ejemplo.com", "Ayudante");
  await db.iniciarSesion(propietaria);
  proveedor = (await q<{ id: string }>("insert into public.contactos (nombre, tipo) values ('San Victorino', 'proveedor') returning id"))[0].id;
  vendedora = (await q<{ id: string }>("insert into public.contactos (nombre, tipo) values ('Marcela', 'vendedora') returning id"))[0].id;
  aretas = (await q<{ id: string }>("insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ('SLA013', 'Aretas perla', 'areta', 40000, 118900) returning id"))[0].id;
  collar = (await q<{ id: string }>("insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ('SLA030', 'Collar perla', 'collar', 65000, 192900) returning id"))[0].id;
});

afterAll(async () => {
  await db?.detener();
});

describe("compras", () => {
  let compraId: string;

  it("una compra entra inventario, fija el costo y crea su gasto de mercancía", async () => {
    await db.iniciarSesion(propietaria);
    compraId = await rpc("registrar_compra", {
      proveedor_id: proveedor,
      medio_pago: "transferencia",
      lineas: [
        { producto_id: aretas, cantidad: 10, costo_unitario: 22000 },
        { producto_id: collar, cantidad: 4, costo_unitario: 36000 },
      ],
    });
    expect(await stock(aretas)).toBe(10);
    expect(await stock(collar)).toBe(4);
    const [c] = await q<{ total: number; numero: number }>("select total, numero from public.compras where id = $1", [compraId]);
    expect(c.total).toBe(10 * 22000 + 4 * 36000);
    const costos = await q<{ codigo: string; costo_compra: number }>("select codigo, costo_compra from public.productos order by codigo");
    expect(costos).toEqual([
      { codigo: "SLA013", costo_compra: 22000 },
      { codigo: "SLA030", costo_compra: 36000 },
    ]);
    const gastos = await q<{ categoria: string; valor: number; medio_pago: string; proveedor_id: string }>("select categoria, valor, medio_pago, proveedor_id from public.gastos where compra_id = $1", [compraId]);
    expect(gastos).toEqual([{ categoria: "compra_mercancia", valor: c.total, medio_pago: "transferencia", proveedor_id: proveedor }]);
  });

  it("la ayudante no puede registrar compras ni ver gastos", async () => {
    await db.iniciarSesion(ayudante);
    await expect(rpc("registrar_compra", { lineas: [{ producto_id: aretas, cantidad: 1, costo_unitario: 1000 }] })).rejects.toThrow(/SIN_PERMISO/);
    await db.cliente.query("set role authenticated");
    try {
      const r = await q<{ n: number }>("select count(*)::int as n from public.gastos");
      expect(r[0].n).toBe(0);
      const c = await q<{ n: number }>("select count(*)::int as n from public.compras");
      expect(c[0].n).toBe(0);
      await expect(q("select public.reporte_periodo(current_date, current_date)")).rejects.toThrow(/SIN_PERMISO/);
    } finally {
      await db.cliente.query("reset role");
    }
  });

  it("no se puede anular una compra cuya mercancía ya se vendió", async () => {
    await db.iniciarSesion(propietaria);
    await rpc("registrar_venta", { estado_pago: "pagada", lineas: [{ producto_id: collar, cantidad: 2, precio_unitario: 192900 }] });
    await expect(q("update public.compras set eliminado_en = now() where id = $1", [compraId])).rejects.toThrow(/COMPRA_YA_VENDIDA/);
  });

  it("anular una compra sin ventas devuelve el inventario y anula el gasto; restaurar lo rehace", async () => {
    await db.iniciarSesion(propietaria);
    const id = await rpc("registrar_compra", { lineas: [{ producto_id: aretas, cantidad: 5, costo_unitario: 21000 }] });
    expect(await stock(aretas)).toBe(15);
    await q("update public.compras set eliminado_en = now() where id = $1", [id]);
    expect(await stock(aretas)).toBe(10);
    expect((await q<{ e: string | null }>("select eliminado_en as e from public.gastos where compra_id = $1", [id]))[0].e).not.toBeNull();
    await q("update public.compras set eliminado_en = null where id = $1", [id]);
    expect(await stock(aretas)).toBe(15);
    expect((await q<{ e: string | null }>("select eliminado_en as e from public.gastos where compra_id = $1", [id]))[0].e).toBeNull();
  });
});

describe("gastos, caja y reportes", () => {
  it("registra gastos manuales y el reporte los agrupa por categoría", async () => {
    await db.iniciarSesion(propietaria);
    await q("insert into public.gastos (categoria, valor, medio_pago, nota) values ('empaques', 30000, 'efectivo', 'bolsas'), ('transporte', 12000, 'efectivo', 'taxi'), ('publicidad', 50000, 'nequi', 'pauta')");
    const [{ r }] = await q<{ r: Record<string, unknown> }>("select public.reporte_periodo(current_date, current_date) as r");
    const cats = Object.fromEntries((r.gastos_por_categoria as { categoria: string; valor: number }[]).map((x) => [x.categoria, x.valor]));
    expect(cats.empaques).toBe(30000);
    expect(cats.transporte).toBe(12000);
    expect(cats.publicidad).toBe(50000);
    expect(cats.compra_mercancia).toBe(10 * 22000 + 4 * 36000 + 5 * 21000);
    expect(r.gastos_operativos).toBe(92000);
  });

  it("el reporte suma ventas directas y de consignación, con costo y margen", async () => {
    await db.iniciarSesion(propietaria);
    // consignación: entrega 4 aretas, liquida 3 vendidas
    const cid = await rpc("registrar_consignacion", { contacto_id: vendedora, lineas: [{ producto_id: aretas, cantidad: 4, valor_unitario: 40000 }] });
    const [linea] = await q<{ id: string }>("select id from public.consignacion_lineas where consignacion_id = $1", [cid]);
    await rpc("registrar_liquidacion", { consignacion_id: cid, lineas: [{ consignacion_linea_id: linea.id, cantidad_vendida: 3, cantidad_devuelta: 0 }], abono: 100000 });
    const [{ r }] = await q<{ r: Record<string, number | unknown[]> }>("select public.reporte_periodo(current_date, current_date) as r");
    expect(r.ventas_directas).toBe(2 * 192900);
    expect(r.ventas_consignacion).toBe(3 * 40000);
    expect(r.ventas_total).toBe(2 * 192900 + 3 * 40000);
    expect(r.piezas_vendidas).toBe(5);
    // costo: collar 36.000 × 2 + aretas (costo actual 21.000) × 3
    expect(r.costo_vendido).toBe(2 * 36000 + 3 * 21000);
    expect(r.margen_bruto).toBe((r.ventas_total as number) - (r.costo_vendido as number));
    expect(r.utilidad_estimada).toBe((r.margen_bruto as number) - 92000);
    expect(r.ingresos_cobrados).toBe(2 * 192900 + 100000);
    const cat = Object.fromEntries((r.por_categoria as { categoria: string; ingreso: number; cantidad: number }[]).map((x) => [x.categoria, x]));
    expect(cat.collar).toEqual({ categoria: "collar", cantidad: 2, ingreso: 2 * 192900 });
    expect(cat.areta).toEqual({ categoria: "areta", cantidad: 3, ingreso: 120000 });
    expect((r.mas_vendidos as { codigo: string }[])[0].codigo).toBe("SLA013");
    expect(r.cuentas_por_cobrar).toBe(20000);
    expect(r.en_consignacion).toBe(40000);
    expect(r.inventario_unidades).toBe(15 - 4 + 2); // aretas: 15 − 4 entregadas; collar: 4 − 2 vendidos
  });

  it("un período sin movimiento da ceros", async () => {
    await db.iniciarSesion(propietaria);
    const [{ r }] = await q<{ r: Record<string, unknown> }>("select public.reporte_periodo('2000-01-01', '2000-01-31') as r");
    expect(r.ventas_total).toBe(0);
    expect(r.gastos_total).toBe(0);
    expect(r.por_categoria).toEqual([]);
  });

  it("la caja del día cuadra ingresos y gastos por medio y el cierre guarda la diferencia", async () => {
    await db.iniciarSesion(propietaria);
    const [{ c }] = await q<{ c: Record<string, number> }>("select public.caja_del_dia(current_date) as c");
    expect(c.ingresos_efectivo).toBe(2 * 192900 + 100000);
    // en efectivo: empaques, transporte y la segunda compra (medio por defecto); otros: publicidad (nequi) y la primera compra (transferencia)
    expect(c.gastos_efectivo).toBe(30000 + 12000 + 5 * 21000);
    expect(c.gastos_otros).toBe(50000 + 10 * 22000 + 4 * 36000);
    const esperado = c.ingresos_efectivo - c.gastos_efectivo;
    await q("select public.cerrar_caja(current_date, $1, 'cuadre de prueba')", [esperado - 5000]);
    const [cierre] = await q<{ efectivo_esperado: number; efectivo_contado: number; diferencia: number }>("select efectivo_esperado, efectivo_contado, diferencia from public.cierres_caja where dia = current_date");
    expect(cierre).toEqual({ efectivo_esperado: esperado, efectivo_contado: esperado - 5000, diferencia: -5000 });
    // volver a cerrar el mismo día reemplaza el cierre
    await q("select public.cerrar_caja(current_date, $1, 'corregido')", [esperado]);
    const [c2] = await q<{ diferencia: number; n: number }>("select diferencia, (select count(*)::int from public.cierres_caja) as n from public.cierres_caja where dia = current_date");
    expect(c2).toEqual({ diferencia: 0, n: 1 });
  });

  it("el stock sigue cuadrando", async () => {
    const r = await q<{ n: number }>("select count(*)::int as n from public.productos where stock_actual <> public.stock_calculado(id)");
    expect(r[0].n).toBe(0);
  });
});
