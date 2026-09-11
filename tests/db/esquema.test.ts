import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let db: PostgresDePruebas;
let propietaria: string;
let ayudante: string;

beforeAll(async () => {
  db = await iniciarPostgresDePruebas();
  propietaria = await db.crearUsuaria("luz@ejemplo.com", "Luz");
  ayudante = await db.crearUsuaria("ayuda@ejemplo.com", "Ayudante");
});

afterAll(async () => {
  await db?.detener();
});

async function crearProducto(codigo: string, extra: Record<string, unknown> = {}) {
  const r = await db.cliente.query(
    `insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico, stock_minimo)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [codigo, extra.nombre ?? `Producto ${codigo}`, extra.categoria ?? "areta", extra.precio_base ?? 40000, extra.precio_publico ?? 118900, extra.stock_minimo ?? 2],
  );
  return r.rows[0].id as string;
}

async function stockDe(id: string) {
  const r = await db.cliente.query("select stock_actual, public.stock_calculado($1) as calculado from public.productos where id = $1", [id]);
  return r.rows[0] as { stock_actual: number; calculado: number };
}

async function mover(producto_id: string, tipo: string, cantidad: number) {
  const r = await db.cliente.query(
    "insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario) values ($1, $2, $3, 0) returning id",
    [tipo, producto_id, cantidad],
  );
  return r.rows[0].id as string;
}

describe("perfiles y roles", () => {
  it("la primera usuaria es propietaria y la segunda ayudante", async () => {
    const r = await db.cliente.query("select id, rol, nombre, correo from public.perfiles order by creado_en");
    const porId = Object.fromEntries(r.rows.map((x) => [x.id, x]));
    expect(porId[propietaria].rol).toBe("propietaria");
    expect(porId[propietaria].nombre).toBe("Luz");
    expect(porId[ayudante].rol).toBe("ayudante");
    expect(porId[ayudante].correo).toBe("ayuda@ejemplo.com");
  });

  it("es_propietaria() responde según la sesión", async () => {
    await db.iniciarSesion(propietaria);
    expect((await db.cliente.query("select public.es_propietaria() as v")).rows[0].v).toBe(true);
    await db.iniciarSesion(ayudante);
    expect((await db.cliente.query("select public.es_propietaria() as v")).rows[0].v).toBe(false);
    await db.iniciarSesion(null);
    expect((await db.cliente.query("select public.es_propietaria() as v")).rows[0].v).toBe(false);
  });

  it("los ajustes existen con una sola fila", async () => {
    const r = await db.cliente.query("select * from public.ajustes");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].nombre_negocio).toBe("Luz Vélez Accesorios");
    await expect(db.cliente.query("insert into public.ajustes (id) values (2)")).rejects.toThrow();
  });
});

describe("stock a partir de movimientos", () => {
  it("el stock siempre cuadra con la suma de movimientos", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA001");
    expect((await stockDe(id)).stock_actual).toBe(0);

    await mover(id, "entrada_compra", 10);
    await mover(id, "salida_venta", 3);
    await mover(id, "salida_consignacion", 4);
    await mover(id, "retorno_consignacion", 2);
    await mover(id, "perdida", 1);
    await mover(id, "obsequio", 1);
    await mover(id, "ajuste_entrada", 5);
    await mover(id, "ajuste_salida", 2);

    const s = await stockDe(id);
    expect(s.stock_actual).toBe(6);
    expect(s.calculado).toBe(6);
  });

  it("no permite sacar más de lo que hay", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA002");
    await mover(id, "entrada_compra", 2);
    await expect(mover(id, "salida_venta", 3)).rejects.toThrow(/STOCK_INSUFICIENTE/);
    expect((await stockDe(id)).stock_actual).toBe(2);
    // un ajuste de resta sí puede corregir hacia abajo hasta cero
    await mover(id, "ajuste_salida", 2);
    expect((await stockDe(id)).stock_actual).toBe(0);
  });

  it("el stock no se puede editar a mano", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA003");
    await mover(id, "entrada_compra", 4);
    await db.cliente.query("update public.productos set stock_actual = 99 where id = $1", [id]);
    expect((await stockDe(id)).stock_actual).toBe(4);
  });

  it("mandar un movimiento a la papelera recalcula; restaurarlo también", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA004");
    await mover(id, "entrada_compra", 10);
    const venta = await mover(id, "salida_venta", 4);
    expect((await stockDe(id)).stock_actual).toBe(6);

    await db.cliente.query("update public.movimientos_inventario set eliminado_en = now() where id = $1", [venta]);
    expect((await stockDe(id)).stock_actual).toBe(10);

    await db.cliente.query("update public.movimientos_inventario set eliminado_en = null where id = $1", [venta]);
    expect((await stockDe(id)).stock_actual).toBe(6);
  });

  it("recalcular_todo_el_stock deja todo cuadrado", async () => {
    await db.iniciarSesion(propietaria);
    const r = await db.cliente.query("select public.recalcular_todo_el_stock() as n");
    expect(r.rows[0].n).toBeGreaterThan(0);
    const desc = await db.cliente.query(
      "select count(*)::int as n from public.productos where stock_actual <> public.stock_calculado(id)",
    );
    expect(desc.rows[0].n).toBe(0);
  });
});

describe("códigos", () => {
  it("siguiente_codigo no mezcla SLA con SLAP", async () => {
    await db.iniciarSesion(propietaria);
    await crearProducto("SLAP026", { categoria: "pulsera" });
    await crearProducto("SLAP037", { categoria: "pulsera" });
    const sla = await db.cliente.query("select public.siguiente_codigo('SLA') as c");
    const slap = await db.cliente.query("select public.siguiente_codigo('SLAP') as c");
    expect(sla.rows[0].c).toBe("SLA005");
    expect(slap.rows[0].c).toBe("SLAP038");
  });

  it("el código es único salvo en la papelera", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA100");
    await expect(crearProducto("SLA100")).rejects.toThrow();
    await db.cliente.query("update public.productos set eliminado_en = now() where id = $1", [id]);
    await expect(crearProducto("SLA100")).resolves.toBeTruthy();
  });
});

describe("historial de precios y auditoría", () => {
  it("registra los precios iniciales y cada cambio", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA200", { precio_base: 40000, precio_publico: 118900 });
    await db.cliente.query("update public.productos set precio_publico = 129900 where id = $1", [id]);
    await db.cliente.query("update public.productos set nombre = 'Otro nombre' where id = $1", [id]);
    const h = await db.cliente.query(
      "select tipo, valor_anterior, valor_nuevo, cambiado_por from public.precio_historial where producto_id = $1 order by id",
      [id],
    );
    expect(h.rows.map((x) => [x.tipo, x.valor_anterior, x.valor_nuevo])).toEqual([
      ["base", null, 40000],
      ["publico", null, 118900],
      ["publico", 118900, 129900],
    ]);
    expect(h.rows[2].cambiado_por).toBe(propietaria);
  });

  it("la auditoría distingue crear, editar, borrar y restaurar", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA201");
    await db.cliente.query("update public.productos set nombre = 'Editado' where id = $1", [id]);
    await db.cliente.query("update public.productos set eliminado_en = now() where id = $1", [id]);
    await db.cliente.query("update public.productos set eliminado_en = null where id = $1", [id]);
    const a = await db.cliente.query(
      "select accion, usuario_id from public.auditoria where tabla = 'productos' and registro_id = $1 order by id",
      [id],
    );
    expect(a.rows.map((x) => x.accion)).toEqual(["crear", "editar", "borrar", "restaurar"]);
    expect(a.rows.every((x) => x.usuario_id === propietaria)).toBe(true);
  });
});

describe("papelera y permisos", () => {
  it("la ayudante no puede borrar ni restaurar", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA300");
    await db.iniciarSesion(ayudante);
    await expect(
      db.cliente.query("update public.productos set eliminado_en = now() where id = $1", [id]),
    ).rejects.toThrow(/SIN_PERMISO/);
    // pero sí puede editar otros campos
    await db.cliente.query("update public.productos set color = 'dorado' where id = $1", [id]);
  });

  it("purgar_papelera borra solo lo que lleva más de 30 días", async () => {
    await db.iniciarSesion(propietaria);
    const viejo = await crearProducto("SLA301");
    const reciente = await crearProducto("SLA302");
    await db.cliente.query("update public.productos set eliminado_en = now() - interval '31 days' where id = $1", [viejo]);
    await db.cliente.query("update public.productos set eliminado_en = now() - interval '2 days' where id = $1", [reciente]);
    const n = await db.cliente.query("select public.purgar_papelera(30) as n");
    expect(n.rows[0].n).toBeGreaterThanOrEqual(1);
    const quedan = await db.cliente.query("select id from public.productos where id = any($1)", [[viejo, reciente]]);
    expect(quedan.rows.map((x) => x.id)).toEqual([reciente]);
  });

  it("la vista papelera lista lo borrado", async () => {
    const r = await db.cliente.query("select tabla, descripcion from public.papelera where descripcion like 'SLA302%'");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].tabla).toBe("productos");
  });
});

describe("políticas RLS", () => {
  it("una persona sin perfil activo no ve productos; la ayudante sí", async () => {
    await db.iniciarSesion(propietaria);
    await crearProducto("SLA400");
    await db.cliente.query("set role authenticated");
    try {
      await db.iniciarSesion(null);
      let r = await db.cliente.query("select count(*)::int as n from public.productos");
      expect(r.rows[0].n).toBe(0);

      await db.iniciarSesion(ayudante);
      r = await db.cliente.query("select count(*)::int as n from public.productos where codigo = 'SLA400'");
      expect(r.rows[0].n).toBe(1);

      // la ayudante no ve la auditoría ni el historial de precios
      r = await db.cliente.query("select count(*)::int as n from public.auditoria");
      expect(r.rows[0].n).toBe(0);
      r = await db.cliente.query("select count(*)::int as n from public.precio_historial");
      expect(r.rows[0].n).toBe(0);

      // la ayudante no puede editar ajustes
      const antes = await db.cliente.query("select nombre_negocio from public.ajustes");
      await db.cliente.query("update public.ajustes set nombre_negocio = 'Hackeado' where id = 1");
      const despues = await db.cliente.query("select nombre_negocio from public.ajustes");
      expect(despues.rows[0].nombre_negocio).toBe(antes.rows[0].nombre_negocio);

      // la propietaria sí
      await db.iniciarSesion(propietaria);
      await db.cliente.query("update public.ajustes set nombre_negocio = 'Luz Vélez Accesorios' where id = 1");
      r = await db.cliente.query("select count(*)::int as n from public.auditoria");
      expect(r.rows[0].n).toBeGreaterThan(0);
    } finally {
      await db.cliente.query("reset role");
    }
  });

  it("el catálogo público solo muestra lo visible y cuando está activo", async () => {
    await db.iniciarSesion(propietaria);
    const id = await crearProducto("SLA500");
    await db.cliente.query("update public.productos set visible_catalogo = true where id = $1", [id]);

    await db.cliente.query("set role anon");
    try {
      let r = await db.cliente.query("select count(*)::int as n from public.catalogo_publico");
      expect(r.rows[0].n).toBe(0);
      await db.cliente.query("reset role");
      await db.cliente.query("update public.ajustes set catalogo_publico_activo = true where id = 1");
      await db.cliente.query("set role anon");
      r = await db.cliente.query("select codigo, precio_publico from public.catalogo_publico");
      expect(r.rows).toEqual([{ codigo: "SLA500", precio_publico: 118900 }]);
      // anon no puede leer productos directamente
      r = await db.cliente.query("select count(*)::int as n from public.productos");
      expect(r.rows[0].n).toBe(0);
    } finally {
      await db.cliente.query("reset role");
    }
  });
});
