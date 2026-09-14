/**
 * Prueba de extremo a extremo de los scripts reales de respaldo y restauración:
 * corre `node scripts/respaldo.mts` contra una base con datos y luego
 * `node scripts/restaurar.mts` contra una base vacía, y compara.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let origen: PostgresDePruebas;
let destino: PostgresDePruebas;
const raiz = join(__dirname, "..", "..");

function urlDe(db: PostgresDePruebas) {
  return `postgres://postgres:postgres@127.0.0.1:${db.port}/pruebas`;
}

function correr(args: string[], env: Record<string, string>) {
  const r = spawnSync(process.execPath, args, { cwd: raiz, env: { ...process.env, ...env, PGSSL: "off" }, encoding: "utf8", timeout: 120_000 });
  return { codigo: r.status, salida: `${r.stdout}\n${r.stderr}` };
}

beforeAll(async () => {
  origen = await iniciarPostgresDePruebas();
  destino = await iniciarPostgresDePruebas();
});
afterAll(async () => {
  await origen?.detener();
  await destino?.detener();
});

describe("scripts respaldo.mts y restaurar.mts", () => {
  it("respaldan a una carpeta y restauran en otra base", async () => {
    const luz = await origen.crearUsuaria("luz@ejemplo.com", "Luz");
    await origen.iniciarSesion(luz);
    await origen.cliente.query("insert into public.contactos (nombre, tipo) values ('Clara', 'cliente')");
    const p = (await origen.cliente.query("insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ('SLA013', 'Aretas', 'areta', 40000, 118900) returning id")).rows[0].id;
    await origen.cliente.query("insert into public.movimientos_inventario (tipo, producto_id, cantidad) values ('entrada_compra', $1, 7)", [p]);
    await origen.cliente.query("select public.registrar_venta($1::jsonb)", [JSON.stringify({ estado_pago: "pagada", lineas: [{ producto_id: p, cantidad: 2, precio_unitario: 118900 }] })]);

    const carpeta = mkdtempSync(join(tmpdir(), "lva-respaldo-"));
    const r1 = correr(["scripts/respaldo.mts", "--destino", "local", "--carpeta", carpeta, "--sin-fotos", "1"], { SUPABASE_DB_URL: urlDe(origen), NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1" });
    expect(r1.salida).toContain("Listo en");
    expect(r1.codigo).toBe(0);
    const archivos = readdirSync(carpeta).filter((a) => a.endsWith(".zip"));
    expect(archivos).toHaveLength(1);
    expect(archivos[0]).toMatch(/^respaldo-\d{4}-\d{2}-\d{2}\.zip$/);
    // el script anotó la fecha en ajustes
    const [{ ultimo_respaldo_en }] = (await origen.cliente.query("select ultimo_respaldo_en from public.ajustes")).rows;
    expect(ultimo_respaldo_en).not.toBeNull();

    // sin --confirmar no cambia nada
    const zip = join(carpeta, archivos[0]);
    const r2 = correr(["scripts/restaurar.mts", zip], { SUPABASE_DB_URL: urlDe(destino) });
    expect(r2.codigo).toBe(0);
    expect(r2.salida).toContain("Nada se ha cambiado");
    expect((await destino.cliente.query("select count(*)::int as n from public.productos")).rows[0].n).toBe(0);

    // con --confirmar restaura todo
    const r3 = correr(["scripts/restaurar.mts", zip, "--confirmar", "--sin-fotos"], { SUPABASE_DB_URL: urlDe(destino) });
    expect(r3.salida).toContain("filas restauradas");
    expect(r3.codigo).toBe(0);
    const conteo = (await destino.cliente.query("select (select count(*)::int from public.productos) as p, (select count(*)::int from public.ventas) as v, (select stock_actual from public.productos where codigo = 'SLA013') as stock")).rows[0];
    expect(conteo).toEqual({ p: 1, v: 1, stock: 5 });
  });
});
