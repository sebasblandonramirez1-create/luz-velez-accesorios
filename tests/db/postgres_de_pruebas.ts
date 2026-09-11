/**
 * Levanta un Postgres embebido, le aplica el entorno simulado de Supabase y
 * todas las migraciones de supabase/migrations, y devuelve un cliente `pg`.
 *
 * Se usa en las pruebas de la lógica que vive en la base de datos: cuadre de
 * stock con movimientos, permisos por rol, papelera, historial de precios.
 */
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import { readdirSync, readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const RAIZ = join(__dirname, "..", "..");

export async function iniciarPostgresDePruebas() {
  const dataDir = mkdtempSync(join(tmpdir(), "lva-pg-"));
  const port = 54400 + Math.floor(Math.random() * 500);
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("pruebas");

  const cliente = new Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: "postgres",
    database: "pruebas",
  });
  await cliente.connect();

  await cliente.query(readFileSync(join(RAIZ, "tests", "db", "entorno_supabase_simulado.sql"), "utf8"));
  const migraciones = readdirSync(join(RAIZ, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const archivo of migraciones) {
    await cliente.query(readFileSync(join(RAIZ, "supabase", "migrations", archivo), "utf8"));
  }

  async function detener() {
    await cliente.end();
    await pg.stop();
  }

  /** Crea una usuaria en auth.users (dispara la creación del perfil) y devuelve su id. */
  async function crearUsuaria(correo: string, nombre = "") {
    const r = await cliente.query(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [correo, JSON.stringify({ nombre })],
    );
    return r.rows[0].id as string;
  }

  /** «Inicia sesión» como una usuaria para que auth.uid() la devuelva. */
  async function iniciarSesion(id: string | null) {
    await cliente.query("select set_config('app.uid', $1, false)", [id ?? ""]);
  }

  return { cliente, detener, crearUsuaria, iniciarSesion, port };
}

export type PostgresDePruebas = Awaited<ReturnType<typeof iniciarPostgresDePruebas>>;
