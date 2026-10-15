import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let db: PostgresDePruebas;
let propietaria: string;
let ayudante: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.cliente.query(sql, params);
  return r.rows as T[];
}
async function como(rol: "authenticated" | "anon", fn: () => Promise<void>) {
  await db.cliente.query(`set role ${rol}`);
  try {
    await fn();
  } finally {
    await db.cliente.query("reset role");
  }
}

beforeAll(async () => {
  db = await iniciarPostgresDePruebas();
  propietaria = await db.crearUsuaria("luz@ejemplo.com", "Luz");
  ayudante = await db.crearUsuaria("ayuda@ejemplo.com", "Ana");
});
afterAll(async () => {
  await db?.detener();
});

describe("clasificaciones de producto", () => {
  it("nace con las cinco de la propietaria, en orden", async () => {
    const r = await q<{ codigo: string; nombre: string }>("select codigo, nombre from public.clasificaciones_producto order by orden");
    expect(r).toEqual([
      { codigo: "CP", nombre: "Collar de piedras" },
      { codigo: "CM", nombre: "Collar medio" },
      { codigo: "CCH", nombre: "Collar choker" },
      { codigo: "PL", nombre: "Pulsera" },
      { codigo: "PLM", nombre: "Pulsera media" },
    ]);
  });

  it("un producto se clasifica con un código existente; uno desconocido se rechaza", async () => {
    await db.iniciarSesion(propietaria);
    await q("insert into public.productos (codigo, nombre, categoria, clasificacion, precio_base, precio_publico) values ('SLA001', 'Collar piedras', 'collar', 'CP', 40000, 118900)");
    await q("insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ('SLA002', 'Collar sin clasificar', 'collar', 40000, 118900)");
    await expect(q("insert into public.productos (codigo, nombre, categoria, clasificacion, precio_base, precio_publico) values ('SLA003', 'x', 'collar', 'ZZ', 1, 1)")).rejects.toThrow(/productos_clasificacion_fkey/);
    const [r] = await q<{ sin: number }>("select count(*)::int as sin from public.productos where eliminado_en is null and clasificacion is null");
    expect(r.sin).toBe(1);
  });

  it("solo la propietaria crea, edita o borra clasificaciones; la ayudante las lee", async () => {
    await db.iniciarSesion(ayudante);
    await como("authenticated", async () => {
      expect((await q<{ n: number }>("select count(*)::int as n from public.clasificaciones_producto"))[0].n).toBe(5);
      await expect(q("insert into public.clasificaciones_producto (codigo, nombre) values ('AR', 'Aretas')")).rejects.toThrow(/row-level security/);
      // La política de edición no le muestra filas: el update no cambia nada.
      await q("update public.clasificaciones_producto set nombre = 'x' where codigo = 'CP'");
      expect((await q<{ nombre: string }>("select nombre from public.clasificaciones_producto where codigo = 'CP'"))[0].nombre).toBe("Collar de piedras");
      await expect(q("delete from public.clasificaciones_producto where codigo = 'CP'")).resolves.toBeTruthy();
      expect((await q<{ n: number }>("select count(*)::int as n from public.clasificaciones_producto"))[0].n).toBe(5);
    });
    await db.iniciarSesion(propietaria);
    await como("authenticated", async () => {
      await q("insert into public.clasificaciones_producto (codigo, nombre, orden) values ('AR', 'Aretas', 6)");
      await q("update public.clasificaciones_producto set activa = false where codigo = 'AR'");
      await expect(q("insert into public.clasificaciones_producto (codigo, nombre) values ('mal-1', 'x')")).rejects.toThrow(/check/);
      // Una clasificación en uso no se puede borrar; una sin uso, sí.
      await expect(q("delete from public.clasificaciones_producto where codigo = 'CP'")).rejects.toThrow(/productos_clasificacion_fkey/);
      await q("delete from public.clasificaciones_producto where codigo = 'AR'");
    });
    await db.iniciarSesion(null);
    await como("anon", async () => {
      await expect(q("select * from public.clasificaciones_producto")).rejects.toThrow(/permission denied/);
    });
  });

  it("cambiar el código de una clasificación arrastra a sus productos", async () => {
    await db.iniciarSesion(propietaria);
    await q("update public.clasificaciones_producto set codigo = 'CPI' where codigo = 'CP'");
    expect((await q<{ c: string }>("select clasificacion as c from public.productos where codigo = 'SLA001'"))[0].c).toBe("CPI");
    await q("update public.clasificaciones_producto set codigo = 'CP' where codigo = 'CPI'");
  });

  it("el recibo de consignación lleva la clasificación de cada pieza y la lista de clasificaciones", async () => {
    await db.iniciarSesion(propietaria);
    const [{ id: vendedora }] = await q<{ id: string }>("insert into public.contactos (nombre, tipo) values ('Marcela', 'vendedora') returning id");
    await q("insert into public.movimientos_inventario (tipo, producto_id, cantidad) select 'entrada_compra', id, 5 from public.productos");
    const [{ id: a }, { id: b }] = await q<{ id: string }>("select id from public.productos order by codigo");
    const [{ id }] = await q<{ id: string }>("select public.registrar_consignacion($1::jsonb) as id", [
      JSON.stringify({ contacto_id: vendedora, lineas: [{ producto_id: a, cantidad: 2, valor_unitario: 40000 }, { producto_id: b, cantidad: 1, valor_unitario: 40000 }] }),
    ]);
    const [{ t }] = await q<{ t: string }>("select public.preparar_firma_consignacion($1) as t", [id]);
    await db.iniciarSesion(null);
    await como("anon", async () => {
      const [{ r }] = await q<{ r: { lineas: { codigo: string; clasificacion: string | null }[]; clasificaciones: { codigo: string; nombre: string }[] } }>("select public.recibo_para_firmar($1) as r", [t]);
      expect(r.lineas).toEqual([
        { codigo: "SLA001", nombre: "Collar piedras", clasificacion: "CP", cantidad: 2, valor_unitario: 40000 },
        { codigo: "SLA002", nombre: "Collar sin clasificar", clasificacion: null, cantidad: 1, valor_unitario: 40000 },
      ]);
      expect(r.clasificaciones.map((k) => k.codigo)).toEqual(["CP", "CM", "CCH", "PL", "PLM"]);
    });
  });
});
