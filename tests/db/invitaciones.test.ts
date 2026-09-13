import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarPostgresDePruebas, type PostgresDePruebas } from "./postgres_de_pruebas";

let db: PostgresDePruebas;

beforeAll(async () => {
  db = await iniciarPostgresDePruebas();
});
afterAll(async () => {
  await db?.detener();
});

describe("invitaciones y roles al registrarse", () => {
  it("la primera cuenta es propietaria sin invitación", async () => {
    const id = await db.crearUsuaria("luz@ejemplo.com", "Luz");
    const r = await db.cliente.query("select rol from public.perfiles where id = $1", [id]);
    expect(r.rows[0].rol).toBe("propietaria");
  });

  it("sin invitación, el registro se rechaza", async () => {
    await expect(db.crearUsuaria("intruso@ejemplo.com", "", { invitar: false })).rejects.toThrow(/SIN_INVITACION/);
    const r = await db.cliente.query("select count(*)::int as n from auth.users");
    expect(r.rows[0].n).toBe(1);
  });

  it("con invitación de propietaria, la nueva cuenta es propietaria y la invitación queda usada", async () => {
    const [{ id: luz }] = (await db.cliente.query("select id from public.perfiles where rol = 'propietaria'")).rows;
    await db.iniciarSesion(luz);
    await db.cliente.query("insert into public.invitaciones (correo, rol, nombre, creada_por) values ('Socia@Ejemplo.com', 'propietaria', 'Socia', $1)", [luz]);
    const id = await db.crearUsuaria("socia@ejemplo.com", "", { invitar: false }); // distinta capitalización, sin nombre en metadatos
    const p = await db.cliente.query("select rol, nombre from public.perfiles where id = $1", [id]);
    expect(p.rows[0]).toEqual({ rol: "propietaria", nombre: "Socia" });
    const inv = await db.cliente.query("select usada_por, usada_en is not null as usada from public.invitaciones where lower(correo) = 'socia@ejemplo.com'");
    expect(inv.rows[0]).toEqual({ usada_por: id, usada: true });
    // la invitación usada no sirve de nuevo
    await expect(db.crearUsuaria("socia@ejemplo.com", "", { invitar: false })).rejects.toThrow(/SIN_INVITACION/);
  });

  it("con invitación de ayudante, entra como ayudante", async () => {
    const [{ id: luz }] = (await db.cliente.query("select id from public.perfiles where correo = 'luz@ejemplo.com'")).rows;
    await db.cliente.query("insert into public.invitaciones (correo, rol, creada_por) values ('ayuda@ejemplo.com', 'ayudante', $1)", [luz]);
    const id = await db.crearUsuaria("ayuda@ejemplo.com", "Ayudante", { invitar: false });
    const p = await db.cliente.query("select rol, nombre from public.perfiles where id = $1", [id]);
    expect(p.rows[0]).toEqual({ rol: "ayudante", nombre: "Ayudante" });
  });

  it("la ayudante no ve ni crea invitaciones; solo hay una pendiente por correo", async () => {
    const [{ id: ayudante }] = (await db.cliente.query("select id from public.perfiles where correo = 'ayuda@ejemplo.com'")).rows;
    const [{ id: luz }] = (await db.cliente.query("select id from public.perfiles where correo = 'luz@ejemplo.com'")).rows;
    await db.cliente.query("set role authenticated");
    try {
      await db.iniciarSesion(ayudante);
      const r = await db.cliente.query("select count(*)::int as n from public.invitaciones");
      expect(r.rows[0].n).toBe(0);
      await expect(db.cliente.query("insert into public.invitaciones (correo) values ('x@ejemplo.com')")).rejects.toThrow();
      await db.iniciarSesion(luz);
      await db.cliente.query("insert into public.invitaciones (correo, creada_por) values ('nueva@ejemplo.com', $1)", [luz]);
      await expect(db.cliente.query("insert into public.invitaciones (correo, creada_por) values ('NUEVA@ejemplo.com', $1)", [luz])).rejects.toThrow(/duplicate/);
    } finally {
      await db.cliente.query("reset role");
    }
  });
});
