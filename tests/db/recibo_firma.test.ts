import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let db: PostgresDePruebas;
let propietaria: string;
let ayudante: string;
let vendedora: string;
let aretas: string;
let consignacion: string;
let token: string;

const FIRMA = "data:image/png;base64," + "A".repeat(400);

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.cliente.query(sql, params);
  return r.rows as T[];
}

/** Ejecuta como el rol anon (sin sesión) y vuelve al rol normal. */
async function comoAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.iniciarSesion(null);
  await db.cliente.query("set role anon");
  try {
    return await fn();
  } finally {
    await db.cliente.query("reset role");
  }
}

async function nuevaConsignacion(extra: Record<string, unknown> = {}) {
  await db.iniciarSesion(ayudante);
  const p = { contacto_id: vendedora, lineas: [{ producto_id: aretas, cantidad: 2, valor_unitario: 40000 }], ...extra };
  return (await q<{ id: string }>("select public.registrar_consignacion($1::jsonb) as id", [JSON.stringify(p)]))[0].id;
}

async function leer(t: string) {
  return (await q<{ r: Record<string, unknown> | null }>("select public.recibo_para_firmar($1) as r", [t]))[0].r;
}

async function firmar(t: string, p: Record<string, unknown>) {
  return (await q<{ r: { firmado_en: string; huella: string } }>("select public.firmar_recibo_consignacion($1, $2::jsonb) as r", [t, JSON.stringify(p)]))[0].r;
}

beforeAll(async () => {
  db = await iniciarPostgresDePruebas();
  propietaria = await db.crearUsuaria("luz@ejemplo.com", "Luz");
  ayudante = await db.crearUsuaria("ayuda@ejemplo.com", "Ayudante");
  await db.iniciarSesion(propietaria);
  vendedora = (await q<{ id: string }>("insert into public.contactos (nombre, tipo, telefono) values ('Marcela Ríos', 'vendedora', '3001112233') returning id"))[0].id;
  aretas = (await q<{ id: string }>("insert into public.productos (codigo, nombre, categoria, precio_base, precio_publico) values ('SLA013', 'Aretas perla', 'areta', 40000, 118900) returning id"))[0].id;
  await q("insert into public.movimientos_inventario (tipo, producto_id, cantidad) values ('entrada_compra', $1, 50)", [aretas]);
  await q("update public.ajustes set documento_negocio = '900.123.456-7', ciudad_negocio = 'Medellín' where id = 1");
});

afterAll(async () => {
  await db?.detener();
});

describe("fecha límite de la consignación", () => {
  it("por defecto es la entrega más el plazo de Ajustes", async () => {
    consignacion = await nuevaConsignacion({ fecha_entrega: "2026-10-01T15:00:00Z" });
    const [c] = await q<{ limite: string }>("select fecha_limite::text as limite from public.consignaciones where id = $1", [consignacion]);
    expect(c.limite).toBe("2026-10-31");
  });

  it("respeta la fecha indicada y rechaza una anterior a la entrega", async () => {
    const id = await nuevaConsignacion({ fecha_entrega: "2026-10-01T15:00:00Z", fecha_limite: "2026-10-15" });
    const [c] = await q<{ limite: string }>("select fecha_limite::text as limite from public.consignaciones where id = $1", [id]);
    expect(c.limite).toBe("2026-10-15");
    await expect(nuevaConsignacion({ fecha_entrega: "2026-10-01T15:00:00Z", fecha_limite: "2026-09-20" })).rejects.toThrow(/FECHA_LIMITE_INVALIDA/);
  });
});

describe("enlace de firma", () => {
  it("la ayudante puede pedir la firma y el enlace se conserva mientras esté vigente", async () => {
    await db.iniciarSesion(ayudante);
    token = (await q<{ t: string }>("select public.preparar_firma_consignacion($1) as t", [consignacion]))[0].t;
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const otra = (await q<{ t: string }>("select public.preparar_firma_consignacion($1, 30) as t", [consignacion]))[0].t;
    expect(otra).toBe(token);
  });

  it("sin sesión no se puede pedir la firma", async () => {
    await db.iniciarSesion(null);
    await expect(q("select public.preparar_firma_consignacion($1)", [consignacion])).rejects.toThrow(/SIN_PERMISO/);
    await comoAnon(async () => {
      await expect(q("select public.preparar_firma_consignacion($1)", [consignacion])).rejects.toThrow(/permission denied/);
    });
  });

  it("con el enlace, anon lee solo ese recibo; no tiene acceso a las tablas", async () => {
    await comoAnon(async () => {
      const r = (await leer(token))!;
      expect(r.estado).toBe("pendiente");
      expect(r.negocio).toMatchObject({ nombre: "Luzazul Accesorios", documento: "900.123.456-7", ciudad: "Medellín" });
      expect(r.contacto).toMatchObject({ nombre: "Marcela Ríos", telefono: "3001112233", documento: "" });
      expect(r.lineas).toEqual([{ codigo: "SLA013", nombre: "Aretas perla", cantidad: 2, valor_unitario: 40000 }]);
      expect((r.consignacion as { total_entregado: number; fecha_limite: string }).total_entregado).toBe(80000);
      expect((r.consignacion as { fecha_limite: string }).fecha_limite).toBe("2026-10-31");
      expect(String(r.condiciones)).toMatch(/consignación/);
      expect(r.firma).toBeNull();
      expect(await leer("00000000-0000-4000-8000-000000000000")).toBeNull();
      await expect(q("select * from public.consignacion_recibos")).rejects.toThrow(/permission denied/);
      await expect(q("select * from public.consignaciones")).rejects.toThrow(/permission denied/);
      await expect(q("select public.contenido_recibo($1)", [consignacion])).rejects.toThrow(/permission denied/);
    });
  });

  it("las usuarias leen el recibo pero no lo escriben directamente", async () => {
    await db.iniciarSesion(ayudante);
    await db.cliente.query("set role authenticated");
    try {
      const r = await q<{ n: number }>("select count(*)::int as n from public.consignacion_recibos");
      expect(r[0].n).toBe(1);
      await expect(q("update public.consignacion_recibos set receptor_nombre = 'x'")).rejects.toThrow(/permission denied/);
      await expect(q("select public.contenido_recibo($1)", [consignacion])).rejects.toThrow(/permission denied/);
    } finally {
      await db.cliente.query("reset role");
    }
  });
});

describe("firma electrónica", () => {
  const datos = { nombre: "Marcela Ríos Gómez", documento: "43.123.456", telefono: "3009998877", direccion: "Calle 10 # 20-30", ciudad: "Envigado", correo: "Marcela@Ejemplo.com", firma: FIRMA, acepta: true, ip: "190.0.0.1", agente: "Pruebas" };

  it("rechaza si falta aceptar, faltan datos o la firma no es una imagen", async () => {
    await comoAnon(async () => {
      await expect(firmar(token, { ...datos, acepta: false })).rejects.toThrow(/RECIBO_SIN_ACEPTAR/);
      await expect(firmar(token, { ...datos, nombre: "M" })).rejects.toThrow(/RECIBO_DATOS_INCOMPLETOS/);
      await expect(firmar(token, { ...datos, documento: "12" })).rejects.toThrow(/RECIBO_DATOS_INCOMPLETOS/);
      await expect(firmar(token, { ...datos, firma: "hola" })).rejects.toThrow(/RECIBO_FIRMA_INVALIDA/);
      await expect(firmar(token, { ...datos, firma: "data:image/png;base64," + "A".repeat(500000) })).rejects.toThrow(/RECIBO_FIRMA_INVALIDA/);
      await expect(firmar("00000000-0000-4000-8000-000000000000", datos)).rejects.toThrow(/RECIBO_NO_ENCONTRADO/);
    });
  });

  it("firma una sola vez, guarda la evidencia y completa la ficha del contacto", async () => {
    const r = await comoAnon(() => firmar(token, datos));
    expect(r.huella).toMatch(/^[0-9a-f]{64}$/);
    const [fila] = await q<Record<string, string>>("select receptor_nombre, receptor_documento, receptor_correo, firma_ip, firma_agente, firma_huella, firma_imagen from public.consignacion_recibos where consignacion_id = $1", [consignacion]);
    expect(fila).toMatchObject({ receptor_nombre: "Marcela Ríos Gómez", receptor_documento: "43.123.456", receptor_correo: "marcela@ejemplo.com", firma_ip: "190.0.0.1", firma_agente: "Pruebas", firma_huella: r.huella, firma_imagen: FIRMA });
    // El teléfono ya existía y se conserva; lo vacío se completa.
    const [co] = await q<Record<string, string>>("select telefono, documento, direccion, ciudad, correo from public.contactos where id = $1", [vendedora]);
    expect(co).toEqual({ telefono: "3001112233", documento: "43.123.456", direccion: "Calle 10 # 20-30", ciudad: "Envigado", correo: "marcela@ejemplo.com" });

    await comoAnon(async () => {
      const leido = (await leer(token))!;
      expect(leido.estado).toBe("firmado");
      expect(leido.receptor).toMatchObject({ nombre: "Marcela Ríos Gómez", ciudad: "Envigado" });
      expect((leido.firma as { huella: string; imagen: string }).huella).toBe(r.huella);
      await expect(firmar(token, datos)).rejects.toThrow(/RECIBO_YA_FIRMADO/);
    });
    await db.iniciarSesion(ayudante);
    await expect(q("select public.preparar_firma_consignacion($1)", [consignacion])).rejects.toThrow(/RECIBO_YA_FIRMADO/);
  });

  it("un enlace vencido no deja firmar y al pedirlo de nuevo cambia", async () => {
    const otra = await nuevaConsignacion();
    const t1 = (await q<{ t: string }>("select public.preparar_firma_consignacion($1) as t", [otra]))[0].t;
    await q("update public.consignacion_recibos set token_vence = now() - interval '1 day' where consignacion_id = $1", [otra]);
    await comoAnon(async () => {
      expect((await leer(t1))!.estado).toBe("vencido");
      await expect(firmar(t1, datos)).rejects.toThrow(/RECIBO_VENCIDO/);
    });
    await db.iniciarSesion(ayudante);
    const t2 = (await q<{ t: string }>("select public.preparar_firma_consignacion($1) as t", [otra]))[0].t;
    expect(t2).not.toBe(t1);
    await comoAnon(async () => {
      expect(await leer(t1)).toBeNull();
      expect((await leer(t2))!.estado).toBe("pendiente");
    });
  });

  it("solo la propietaria anula una firma; después se puede pedir de nuevo", async () => {
    await db.iniciarSesion(ayudante);
    await expect(q("select public.anular_firma_consignacion($1)", [consignacion])).rejects.toThrow(/SIN_PERMISO/);
    await db.iniciarSesion(propietaria);
    await q("select public.anular_firma_consignacion($1)", [consignacion]);
    expect((await q<{ n: number }>("select count(*)::int as n from public.consignacion_recibos where consignacion_id = $1", [consignacion]))[0].n).toBe(0);
    const nuevo = (await q<{ t: string }>("select public.preparar_firma_consignacion($1) as t", [consignacion]))[0].t;
    expect(nuevo).not.toBe(token);
    token = nuevo;
  });

  it("si la entrega se anula, el enlace deja de mostrar el recibo", async () => {
    await db.iniciarSesion(propietaria);
    await q("update public.consignaciones set eliminado_en = now() where id = $1", [consignacion]);
    await comoAnon(async () => {
      expect(await leer(token)).toBeNull();
      await expect(firmar(token, { nombre: "Marcela Ríos", documento: "43123456", firma: FIRMA, acepta: true })).rejects.toThrow(/RECIBO_NO_ENCONTRADO/);
    });
  });
});
