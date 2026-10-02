import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let db: PostgresDePruebas;
let propietaria: string;
let ayudante: string;
let vendedora: string;
let aretas: string;
let collar: string;
let pulsera: string;
let anillo: string;
let consignacion: string;

const FIRMA = "data:image/png;base64," + "A".repeat(400);

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.cliente.query(sql, params);
  return r.rows as T[];
}
async function stock(id: string) {
  return (await q<{ s: number }>("select stock_actual as s from public.productos where id = $1", [id]))[0].s;
}
async function producto(codigo: string, nombre: string, existencias: number) {
  const id = (await q<{ id: string }>("insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ($1, $2, 'otro', 40000, 118900) returning id", [codigo, nombre]))[0].id;
  if (existencias > 0) await q("insert into public.movimientos_inventario (tipo, producto_id, cantidad) values ('entrada_compra', $1, $2)", [id, existencias]);
  return id;
}
type Linea = { producto_id: string; cantidad: number; valor_unitario: number };
async function modificar(id: string, lineas: Linea[], extra: Record<string, unknown> = {}) {
  return (await q<{ id: string }>("select public.modificar_consignacion($1::jsonb) as id", [JSON.stringify({ consignacion_id: id, lineas, ...extra })]))[0].id;
}
async function lineasDe(id: string) {
  return q<{ codigo: string; e: number; v: number; d: number; valor: number }>(
    "select p.codigo, l.cantidad_entregada as e, l.cantidad_vendida as v, l.cantidad_devuelta as d, l.valor_unitario as valor from public.consignacion_lineas l join public.productos p on p.id = l.producto_id where l.consignacion_id = $1 order by p.codigo",
    [id],
  );
}
async function registro(id: string) {
  return q<{ numero: number; usuario_nombre: string; motivo: string; cambios: Record<string, unknown>[]; piezas_antes: number; piezas_despues: number; total_antes: number; total_despues: number }>(
    "select numero, usuario_nombre, motivo, cambios, piezas_antes, piezas_despues, total_antes, total_despues from public.consignacion_modificaciones where consignacion_id = $1 order by numero",
    [id],
  );
}

beforeAll(async () => {
  db = await iniciarPostgresDePruebas();
  propietaria = await db.crearUsuaria("luz@ejemplo.com", "Luz");
  ayudante = await db.crearUsuaria("ayuda@ejemplo.com", "Ana Ayudante");
  await db.iniciarSesion(propietaria);
  vendedora = (await q<{ id: string }>("insert into public.contactos (nombre, tipo) values ('Marcela', 'vendedora') returning id"))[0].id;
  aretas = await producto("SLA013", "Aretas perla", 20);
  collar = await producto("SLA030", "Collar perla", 10);
  pulsera = await producto("SLAP026", "Pulsera tejida", 5);
  anillo = await producto("SLA100", "Anillo ajustable", 3);
  await db.iniciarSesion(ayudante);
  consignacion = (
    await q<{ id: string }>("select public.registrar_consignacion($1::jsonb) as id", [
      JSON.stringify({
        contacto_id: vendedora,
        fecha_entrega: "2026-10-01T15:00:00Z",
        lineas: [
          { producto_id: aretas, cantidad: 4, valor_unitario: 40000 },
          { producto_id: collar, cantidad: 2, valor_unitario: 65000 },
        ],
      }),
    ])
  )[0].id;
});

afterAll(async () => {
  await db?.detener();
});

describe("modificar una consignación sin liquidarla", () => {
  it("añade una pieza, sube una cantidad, baja otra y deja el registro", async () => {
    expect([await stock(aretas), await stock(collar), await stock(pulsera)]).toEqual([16, 8, 5]);
    await db.iniciarSesion(ayudante);
    await modificar(
      consignacion,
      [
        { producto_id: aretas, cantidad: 6, valor_unitario: 40000 },
        { producto_id: collar, cantidad: 1, valor_unitario: 65000 },
        { producto_id: pulsera, cantidad: 3, valor_unitario: 20000 },
      ],
      { motivo: "  Pidió más aretas  " },
    );
    expect(await lineasDe(consignacion)).toEqual([
      { codigo: "SLA013", e: 6, v: 0, d: 0, valor: 40000 },
      { codigo: "SLA030", e: 1, v: 0, d: 0, valor: 65000 },
      { codigo: "SLAP026", e: 3, v: 0, d: 0, valor: 20000 },
    ]);
    expect([await stock(aretas), await stock(collar), await stock(pulsera)]).toEqual([14, 9, 2]);
    const [c] = await q<{ total_entregado: number; total_pendiente: number; estado: string }>("select total_entregado, total_pendiente, estado from public.consignaciones where id = $1", [consignacion]);
    expect(c).toEqual({ total_entregado: 365000, total_pendiente: 365000, estado: "abierta" });

    const [m] = await registro(consignacion);
    expect(m).toMatchObject({ numero: 1, usuario_nombre: "Ana Ayudante", motivo: "Pidió más aretas", piezas_antes: 6, piezas_despues: 10, total_antes: 290000, total_despues: 365000 });
    expect(m.cambios).toEqual([
      { tipo: "cantidad", codigo: "SLA013", nombre: "Aretas perla", antes: 4, despues: 6 },
      { tipo: "cantidad", codigo: "SLA030", nombre: "Collar perla", antes: 2, despues: 1 },
      { tipo: "pieza_agregada", codigo: "SLAP026", nombre: "Pulsera tejida", cantidad: 3, valor_unitario: 20000 },
    ]);
  });

  it("los movimientos de la modificación llevan la fecha de hoy y su nota", async () => {
    const movs = await q<{ tipo: string; codigo: string; cantidad: number; nota: string; hoy: boolean }>(
      "select m.tipo, p.codigo, m.cantidad, m.nota, m.fecha > now() - interval '5 minutes' as hoy from public.movimientos_inventario m join public.productos p on p.id = m.producto_id where m.documento_tipo = 'consignacion' and m.documento_id = $1 and m.nota like '%modificación%' order by p.codigo",
      [consignacion],
    );
    expect(movs).toEqual([
      { tipo: "salida_consignacion", codigo: "SLA013", cantidad: 2, nota: "Consignación C-0001 · modificación: se añaden piezas", hoy: true },
      { tipo: "retorno_consignacion", codigo: "SLA030", cantidad: 1, nota: "Consignación C-0001 · modificación: se retiran piezas", hoy: true },
      { tipo: "salida_consignacion", codigo: "SLAP026", cantidad: 3, nota: "Consignación C-0001 · modificación: pieza añadida", hoy: true },
    ]);
  });

  it("retira una pieza completa, cambia un valor, la fecha límite y la nota", async () => {
    await db.iniciarSesion(propietaria);
    await modificar(
      consignacion,
      [
        { producto_id: aretas, cantidad: 6, valor_unitario: 42000 },
        { producto_id: collar, cantidad: 1, valor_unitario: 65000 },
      ],
      { fecha_limite: "2026-11-15", nota: "Entrega ajustada" },
    );
    expect(await stock(pulsera)).toBe(5);
    expect(await lineasDe(consignacion)).toEqual([
      { codigo: "SLA013", e: 6, v: 0, d: 0, valor: 42000 },
      { codigo: "SLA030", e: 1, v: 0, d: 0, valor: 65000 },
    ]);
    const m = (await registro(consignacion))[1];
    expect(m).toMatchObject({ numero: 2, usuario_nombre: "Luz", motivo: "", piezas_antes: 10, piezas_despues: 7, total_antes: 365000, total_despues: 317000 });
    expect(m.cambios).toEqual([
      { tipo: "pieza_retirada", codigo: "SLAP026", nombre: "Pulsera tejida", cantidad: 3, valor_unitario: 20000 },
      { tipo: "valor", codigo: "SLA013", nombre: "Aretas perla", antes: 40000, despues: 42000 },
      { tipo: "fecha_limite", antes: "2026-10-31", despues: "2026-11-15" },
      { tipo: "nota", antes: "", despues: "Entrega ajustada" },
    ]);
  });

  it("rechaza lo que no cuadra y no deja nada a medias", async () => {
    await db.iniciarSesion(ayudante);
    const actual = [
      { producto_id: aretas, cantidad: 6, valor_unitario: 42000 },
      { producto_id: collar, cantidad: 1, valor_unitario: 65000 },
    ];
    await expect(modificar(consignacion, actual)).rejects.toThrow(/SIN_CAMBIOS/);
    await expect(modificar(consignacion, [])).rejects.toThrow(/CONSIGNACION_SIN_LINEAS/);
    await expect(modificar(consignacion, [...actual, actual[0]])).rejects.toThrow(/LINEAS_REPETIDAS/);
    await expect(modificar(consignacion, [{ ...actual[0], cantidad: 0 }, actual[1]])).rejects.toThrow(/LINEA_INVALIDA/);
    await expect(modificar(consignacion, actual, { fecha_limite: "2026-09-01" })).rejects.toThrow(/FECHA_LIMITE_INVALIDA/);
    // Solo hay 3 anillos: pedir 4 falla y la pieza añadida antes en la misma llamada tampoco queda.
    await expect(modificar(consignacion, [...actual, { producto_id: pulsera, cantidad: 1, valor_unitario: 20000 }, { producto_id: anillo, cantidad: 4, valor_unitario: 30000 }])).rejects.toThrow(/STOCK_INSUFICIENTE/);
    expect(await lineasDe(consignacion)).toHaveLength(2);
    expect([await stock(pulsera), await stock(anillo)]).toEqual([5, 3]);
    expect(await registro(consignacion)).toHaveLength(2);
    await db.iniciarSesion(null);
    await expect(modificar(consignacion, actual)).rejects.toThrow(/SIN_PERMISO/);
  });

  it("respeta lo ya liquidado: ni por debajo, ni retirar, ni cambiar el valor de lo vendido", async () => {
    await db.iniciarSesion(ayudante);
    const [la] = await q<{ id: string }>("select id from public.consignacion_lineas where consignacion_id = $1 and producto_id = $2", [consignacion, aretas]);
    await q("select public.registrar_liquidacion($1::jsonb)", [
      JSON.stringify({ consignacion_id: consignacion, abono: 0, medio_pago: "efectivo", lineas: [{ consignacion_linea_id: la.id, cantidad_vendida: 2, cantidad_devuelta: 1 }] }),
    ]);
    expect(await stock(aretas)).toBe(15); // 14 + 1 devuelta
    const collarIgual = { producto_id: collar, cantidad: 1, valor_unitario: 65000 };
    await expect(modificar(consignacion, [{ producto_id: aretas, cantidad: 2, valor_unitario: 42000 }, collarIgual])).rejects.toThrow(/CANTIDAD_MENOR_A_LIQUIDADA: de SLA013 ya se liquidaron 3 piezas y se intenta dejar 2/);
    await expect(modificar(consignacion, [collarIgual])).rejects.toThrow(/LINEA_CON_LIQUIDACION: SLA013/);
    await expect(modificar(consignacion, [{ producto_id: aretas, cantidad: 6, valor_unitario: 45000 }, collarIgual])).rejects.toThrow(/VALOR_CON_VENTAS/);
    // Bajar hasta lo liquidado sí se puede: quedan 3 entregadas, 0 pendientes de esa pieza.
    await modificar(consignacion, [{ producto_id: aretas, cantidad: 3, valor_unitario: 42000 }, collarIgual], { motivo: "Devolvió tres sin vender" });
    expect(await stock(aretas)).toBe(18);
    const [c] = await q<{ estado: string; total_vendido: number; total_pendiente: number }>("select estado, total_vendido, total_pendiente from public.consignaciones where id = $1", [consignacion]);
    expect(c).toEqual({ estado: "parcial", total_vendido: 84000, total_pendiente: 65000 });
  });

  it("el recibo cuenta las modificaciones", async () => {
    await db.iniciarSesion(ayudante);
    const token = (await q<{ t: string }>("select public.preparar_firma_consignacion($1) as t", [consignacion]))[0].t;
    const r = (await q<{ r: { modificaciones: { cantidad: number; ultima: string }; lineas: unknown[] } }>("select public.recibo_para_firmar($1) as r", [token]))[0].r;
    expect(r.modificaciones.cantidad).toBe(3);
    expect(r.modificaciones.ultima).toBeTruthy();
    expect(r.lineas).toHaveLength(2);
  });

  it("con el recibo firmado solo modifica la propietaria, y la firma se anula y queda anotada", async () => {
    const [{ token }] = await q<{ token: string }>("select token from public.consignacion_recibos where consignacion_id = $1", [consignacion]);
    await db.iniciarSesion(null);
    await q("select public.firmar_recibo_consignacion($1, $2::jsonb)", [token, JSON.stringify({ nombre: "Marcela Ríos", documento: "43123456", firma: FIRMA, acepta: true })]);
    const nueva = [
      { producto_id: aretas, cantidad: 3, valor_unitario: 42000 },
      { producto_id: collar, cantidad: 2, valor_unitario: 65000 },
    ];
    await db.iniciarSesion(ayudante);
    await expect(modificar(consignacion, nueva)).rejects.toThrow(/RECIBO_FIRMADO/);
    await db.iniciarSesion(propietaria);
    await modificar(consignacion, nueva, { motivo: "Se llevó otro collar" });
    expect((await q<{ n: number }>("select count(*)::int as n from public.consignacion_recibos where consignacion_id = $1", [consignacion]))[0].n).toBe(0);
    const m = (await registro(consignacion))[3];
    expect(m.numero).toBe(4);
    expect(m.cambios[0]).toEqual({ tipo: "cantidad", codigo: "SLA030", nombre: "Collar perla", antes: 1, despues: 2 });
    expect(m.cambios[1]).toMatchObject({ tipo: "firma_anulada", firmante: "Marcela Ríos", documento: "43123456" });
    expect(String(m.cambios[1].huella)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el registro no se puede escribir, editar ni borrar a mano", async () => {
    await db.iniciarSesion(propietaria);
    await db.cliente.query("set role authenticated");
    try {
      expect((await q<{ n: number }>("select count(*)::int as n from public.consignacion_modificaciones"))[0].n).toBe(4);
      await expect(q("update public.consignacion_modificaciones set motivo = 'x'")).rejects.toThrow(/permission denied/);
      await expect(q("delete from public.consignacion_modificaciones")).rejects.toThrow(/permission denied/);
      await expect(q("insert into public.consignacion_modificaciones (consignacion_id, numero, cambios, piezas_antes, piezas_despues, total_antes, total_despues) values ($1, 9, '[{}]', 0, 0, 0, 0)", [consignacion])).rejects.toThrow(/permission denied/);
    } finally {
      await db.cliente.query("reset role");
    }
    await db.iniciarSesion(null);
    await db.cliente.query("set role anon");
    try {
      await expect(q("select * from public.consignacion_modificaciones")).rejects.toThrow(/permission denied/);
      await expect(q("select public.modificar_consignacion('{}'::jsonb)")).rejects.toThrow(/permission denied/);
    } finally {
      await db.cliente.query("reset role");
    }
  });

  it("una entrega cerrada no se modifica", async () => {
    await db.iniciarSesion(ayudante);
    const id = (await q<{ id: string }>("select public.registrar_consignacion($1::jsonb) as id", [JSON.stringify({ contacto_id: vendedora, lineas: [{ producto_id: anillo, cantidad: 1, valor_unitario: 30000 }] })]))[0].id;
    const [l] = await q<{ id: string }>("select id from public.consignacion_lineas where consignacion_id = $1", [id]);
    await q("select public.registrar_liquidacion($1::jsonb)", [JSON.stringify({ consignacion_id: id, abono: 0, medio_pago: "efectivo", lineas: [{ consignacion_linea_id: l.id, cantidad_vendida: 0, cantidad_devuelta: 1 }] })]);
    await expect(modificar(id, [{ producto_id: anillo, cantidad: 2, valor_unitario: 30000 }])).rejects.toThrow(/CONSIGNACION_CERRADA/);
  });

  it("no admite la misma pieza dos veces en una entrega", async () => {
    await expect(q("insert into public.consignacion_lineas (consignacion_id, producto_id, cantidad_entregada, valor_unitario) values ($1, $2, 1, 1000)", [consignacion, aretas])).rejects.toThrow(/consignacion_lineas_producto_unico/);
  });

  it("el inventario cuadra con los movimientos, y anular la entrega devuelve lo que sigue fuera", async () => {
    const descuadre = async () => (await q<{ n: number }>("select count(*)::int as n from public.productos where stock_actual <> public.stock_calculado(id)"))[0].n;
    expect(await descuadre()).toBe(0);
    // Entrega nueva, modificada dos veces y luego anulada: el stock vuelve al punto de partida.
    await db.iniciarSesion(ayudante);
    const antes = [await stock(aretas), await stock(pulsera)];
    const id = (await q<{ id: string }>("select public.registrar_consignacion($1::jsonb) as id", [JSON.stringify({ contacto_id: vendedora, lineas: [{ producto_id: aretas, cantidad: 2, valor_unitario: 40000 }] })]))[0].id;
    await modificar(id, [{ producto_id: aretas, cantidad: 5, valor_unitario: 40000 }, { producto_id: pulsera, cantidad: 2, valor_unitario: 20000 }]);
    await modificar(id, [{ producto_id: aretas, cantidad: 1, valor_unitario: 40000 }, { producto_id: pulsera, cantidad: 2, valor_unitario: 20000 }]);
    expect([await stock(aretas), await stock(pulsera)]).toEqual([antes[0] - 1, antes[1] - 2]);
    await db.iniciarSesion(propietaria);
    await q("update public.consignaciones set eliminado_en = now() where id = $1", [id]);
    expect([await stock(aretas), await stock(pulsera)]).toEqual(antes);
    expect(await descuadre()).toBe(0);
    await expect(modificar(id, [{ producto_id: aretas, cantidad: 2, valor_unitario: 40000 }])).rejects.toThrow(/CONSIGNACION_NO_ENCONTRADA/);
    // La purga definitiva se lleva la entrega con su registro y sus movimientos.
    await q("update public.consignaciones set eliminado_en = now() - interval '40 days' where id = $1", [id]);
    await q("update public.movimientos_inventario set eliminado_en = now() - interval '40 days' where documento_id = $1", [id]);
    await db.cliente.query("set role service_role");
    try {
      await q("select public.purgar_papelera(30)");
    } finally {
      await db.cliente.query("reset role");
    }
    expect((await q<{ n: number }>("select (select count(*) from public.consignacion_modificaciones where consignacion_id = $1)::int + (select count(*) from public.movimientos_inventario where documento_id = $1)::int as n", [id]))[0].n).toBe(0);
    expect(await descuadre()).toBe(0);
  });
});
