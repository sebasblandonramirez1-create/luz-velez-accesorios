import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let db: PostgresDePruebas;

beforeAll(async () => {
  db = await iniciarPostgresDePruebas();
  await db.cliente.query(readFileSync(join(__dirname, "..", "..", "supabase", "seed.sql"), "utf8"));
});

afterAll(async () => {
  await db?.detener();
});

describe("datos de prueba (seed.sql)", () => {
  it("cargan sin errores y el stock cuadra con los movimientos", async () => {
    const r = await db.cliente.query(
      "select codigo, stock_actual, public.stock_calculado(id) as calculado from public.productos order by codigo",
    );
    expect(r.rows.length).toBe(12);
    for (const fila of r.rows) expect(fila.stock_actual).toBe(fila.calculado);
    const porCodigo = Object.fromEntries(r.rows.map((x) => [x.codigo, x.stock_actual]));
    expect(porCodigo.SLA013).toBe(12);
    expect(porCodigo.SLA021).toBe(5); // 6 - 1 pérdida
    expect(porCodigo.SLA041).toBe(1); // 4 - 3 obsequio
    expect(porCodigo.SLA050).toBe(0); // agotado por ajuste
    expect(porCodigo.SLA031).toBe(1); // stock bajo (mínimo 1)
  });

  it("hay contactos de cada tipo", async () => {
    const r = await db.cliente.query("select tipo::text as tipo, count(*)::int as n from public.contactos group by tipo");
    expect(r.rows.map((x) => x.tipo).sort()).toEqual(["cliente", "mayorista", "proveedor", "vendedora"]);
  });

  it("el catálogo público expone solo lo marcado como visible", async () => {
    await db.cliente.query("update public.ajustes set catalogo_publico_activo = true where id = 1");
    const r = await db.cliente.query("select count(*)::int as n from public.catalogo_publico");
    expect(r.rows[0].n).toBe(8);
  });
});
