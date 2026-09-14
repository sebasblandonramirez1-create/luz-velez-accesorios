import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";
import { armarZip, exportarTablas, leerZip, listarFotos, restaurarTablas, TABLAS_RESPALDO } from "@/lib/respaldo";

let origen: PostgresDePruebas;
let destino: PostgresDePruebas;

async function q<T = Record<string, unknown>>(db: PostgresDePruebas, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.cliente.query(sql, params)).rows as T[];
}

beforeAll(async () => {
  origen = await iniciarPostgresDePruebas();
  destino = await iniciarPostgresDePruebas();
});
afterAll(async () => {
  await origen?.detener();
  await destino?.detener();
});

describe("restauración de un respaldo", () => {
  it("exporta una base con actividad y la restaura idéntica en una base vacía", async () => {
    // --- Base de origen con actividad real
    const luz = await origen.crearUsuaria("luz@ejemplo.com", "Luz");
    await origen.iniciarSesion(luz);
    const vendedora = (await q<{ id: string }>(origen, "insert into public.contactos (nombre, tipo) values ('Marcela', 'vendedora') returning id"))[0].id;
    const aretas = (await q<{ id: string }>(origen, "insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico, costo_compra) values ('SLA013', 'Aretas perla', 'areta', 40000, 118900, 22000) returning id"))[0].id;
    const collar = (await q<{ id: string }>(origen, "insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ('SLA030', 'Collar perla', 'collar', 65000, 192900) returning id"))[0].id;
    await q(origen, "insert into public.producto_fotos (producto_id, ruta, ruta_miniatura, principal) values ($1, 'productos/x/1.jpg', 'productos/x/1_mini.jpg', true)", [aretas]);
    await q(origen, "insert into storage.objects (bucket_id, name) values ('fotos', 'productos/x/1.jpg'), ('fotos', 'productos/x/1_mini.jpg')");
    await q(origen, "select public.registrar_compra($1::jsonb)", [JSON.stringify({ lineas: [{ producto_id: aretas, cantidad: 10, costo_unitario: 22000 }, { producto_id: collar, cantidad: 5, costo_unitario: 36000 }] })]);
    await q(origen, "select public.registrar_venta($1::jsonb)", [JSON.stringify({ estado_pago: "pagada", medio_pago: "nequi", lineas: [{ producto_id: collar, cantidad: 2, precio_unitario: 192900 }] })]);
    const cid = (await q<{ c: string }>(origen, "select public.registrar_consignacion($1::jsonb) as c", [JSON.stringify({ contacto_id: vendedora, lineas: [{ producto_id: aretas, cantidad: 4, valor_unitario: 40000 }] })]))[0].c;
    const [linea] = await q<{ id: string }>(origen, "select id from public.consignacion_lineas where consignacion_id = $1", [cid]);
    await q(origen, "select public.registrar_liquidacion($1::jsonb)", [JSON.stringify({ consignacion_id: cid, lineas: [{ consignacion_linea_id: linea.id, cantidad_vendida: 1, cantidad_devuelta: 1 }], abono: 20000 })]);
    await q(origen, "insert into public.gastos (categoria, valor, nota) values ('transporte', 12000, 'taxi')");
    await q(origen, "select public.cerrar_caja(current_date, 100000, 'prueba')");

    const antes = Object.fromEntries(await Promise.all(TABLAS_RESPALDO.map(async (t) => [t, (await q<{ n: number }>(origen, `select count(*)::int as n from public.${t}`))[0].n])));
    const stockAntes = await q<{ codigo: string; stock_actual: number }>(origen, "select codigo, stock_actual from public.productos order by codigo");
    const resumenAntes = (await q(origen, "select (select sum(total) from public.ventas) as ventas, (select sum(saldo) from public.cuentas_por_cobrar) as saldo, (select estado from public.consignaciones limit 1) as estado"))[0];

    // --- Exportar
    const tablas = await exportarTablas(origen.cliente);
    const fotos = (await listarFotos(origen.cliente)).map((ruta) => ({ ruta, bytes: new Uint8Array([9]) }));
    expect(fotos.map((f) => f.ruta)).toEqual(["productos/x/1.jpg", "productos/x/1_mini.jpg"]);
    const zip = armarZip(tablas, fotos);
    const leido = leerZip(zip);
    expect(leido.meta.conteos.ventas).toBe(1);

    // --- Restaurar en una base limpia (sin usuarias: solo el esquema)
    const conteos = await restaurarTablas(destino.cliente, leido.tablas);
    expect(conteos).toEqual(antes);

    const despues = Object.fromEntries(await Promise.all(TABLAS_RESPALDO.map(async (t) => [t, (await q<{ n: number }>(destino, `select count(*)::int as n from public.${t}`))[0].n])));
    expect(despues).toEqual(antes);
    expect(await q(destino, "select codigo, stock_actual from public.productos order by codigo")).toEqual(stockAntes);
    expect((await q(destino, "select (select sum(total) from public.ventas) as ventas, (select sum(saldo) from public.cuentas_por_cobrar) as saldo, (select estado from public.consignaciones limit 1) as estado"))[0]).toEqual(resumenAntes);
    // columnas generadas recalculadas correctamente
    expect((await q<{ n: number }>(destino, "select count(*)::int as n from public.consignacion_lineas where cantidad_pendiente <> cantidad_entregada - cantidad_vendida - cantidad_devuelta"))[0].n).toBe(0);
    // el stock cuadra con los movimientos restaurados (sin duplicados por disparadores)
    expect((await q<{ n: number }>(destino, "select count(*)::int as n from public.productos where stock_actual <> public.stock_calculado(id)"))[0].n).toBe(0);
  });

  it("después de restaurar, la numeración continúa y la app sigue funcionando", async () => {
    // La base destino no tiene usuarias en auth: se crea una propietaria nueva (perfil con id distinto).
    await destino.iniciarSesion(null);
    // Los perfiles restaurados apuntan a cuentas que no existen aquí; se quitan sin validar claves foráneas.
    await q(destino, "set session_replication_role = replica");
    await q(destino, "delete from public.perfiles");
    await q(destino, "set session_replication_role = origin");
    const nueva = await destino.crearUsuaria("luz@nuevo.com", "Luz");
    await destino.iniciarSesion(nueva);
    const [collar] = await q<{ id: string }>(destino, "select id from public.productos where codigo = 'SLA030'");
    const vid = (await q<{ v: string }>(destino, "select public.registrar_venta($1::jsonb) as v", [JSON.stringify({ estado_pago: "pagada", lineas: [{ producto_id: collar.id, cantidad: 1, precio_unitario: 192900 }] })]))[0].v;
    const [v] = await q<{ numero: number }>(destino, "select numero from public.ventas where id = $1", [vid]);
    expect(v.numero).toBe(2);
    expect((await q<{ n: number }>(destino, "select count(*)::int as n from public.productos where stock_actual <> public.stock_calculado(id)"))[0].n).toBe(0);
  });

  it("si algo falla, no queda nada a medias", async () => {
    const tablas = { productos: [{ id: "no-es-uuid", codigo: "X" }] } as Record<string, Record<string, unknown>[]>;
    const antes = (await q<{ n: number }>(destino, "select count(*)::int as n from public.productos"))[0].n;
    await expect(restaurarTablas(destino.cliente, tablas)).rejects.toThrow();
    expect((await q<{ n: number }>(destino, "select count(*)::int as n from public.productos"))[0].n).toBe(antes);
  });
});
