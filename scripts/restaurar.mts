#!/usr/bin/env node
/**
 * Restaura un respaldo (.zip creado por scripts/respaldo.mts o por el botón
 * «Descargar respaldo completo» de la app) en un proyecto de Supabase que ya
 * tenga las migraciones aplicadas (`npx supabase db push`).
 *
 *   SUPABASE_DB_URL=... node scripts/restaurar.mts respaldos/respaldo-2026-09-13.zip --confirmar
 *
 * Sin --confirmar solo muestra qué haría. Con --sin-fotos no sube las fotos.
 * Para subir las fotos hacen falta NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 *
 * Reemplaza TODO el contenido de las tablas de la app por el del respaldo.
 * Las cuentas de usuarias (auth) no se restauran: la primera que se cree
 * después será propietaria.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { leerZip, restaurarTablas } from "../src/lib/respaldo.ts";

function exigir(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return v;
}

async function subirFotos(fotos: { ruta: string; bytes: Uint8Array }[]) {
  const base = exigir("NEXT_PUBLIC_SUPABASE_URL");
  const clave = exigir("SUPABASE_SERVICE_ROLE_KEY");
  let ok = 0;
  for (const f of fotos) {
    const r = await fetch(`${base}/storage/v1/object/fotos/${f.ruta}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, apikey: clave, "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: f.bytes as unknown as BodyInit,
    });
    if (r.ok) ok++;
    else console.warn(`  · no se pudo subir ${f.ruta}: ${r.status} ${await r.text()}`);
  }
  console.log(`  fotos subidas: ${ok} de ${fotos.length}`);
}

async function main() {
  const archivo = process.argv[2];
  if (!archivo || archivo.startsWith("--")) {
    console.error("Uso: node scripts/restaurar.mts <respaldo.zip> [--confirmar] [--sin-fotos]");
    process.exit(2);
  }
  const confirmar = process.argv.includes("--confirmar");
  const contenido = leerZip(new Uint8Array(readFileSync(archivo)));
  console.log(`Respaldo del ${contenido.meta.fecha} (versión ${contenido.meta.version})`);
  for (const [t, n] of Object.entries(contenido.meta.conteos)) console.log(`  ${t.padEnd(24)} ${n}`);
  console.log(`  fotos: ${contenido.fotos.length}`);
  if (!confirmar) {
    console.log("\nNada se ha cambiado. Añade --confirmar para reemplazar los datos actuales por los del respaldo.");
    return;
  }

  const cliente = new pg.Client({ connectionString: exigir("SUPABASE_DB_URL"), ssl: process.env.PGSSL === "off" ? undefined : { rejectUnauthorized: false } });
  await cliente.connect();
  try {
    console.log("\nRestaurando tablas…");
    const conteos = await restaurarTablas(cliente, contenido.tablas);
    console.log(`  ${Object.values(conteos).reduce((s, n) => s + n, 0)} filas restauradas.`);
  } finally {
    await cliente.end();
  }
  if (!process.argv.includes("--sin-fotos") && contenido.fotos.length) {
    console.log("Subiendo fotos…");
    await subirFotos(contenido.fotos);
  }
  console.log("Listo. Crea o verifica las cuentas de usuarias en Supabase (Authentication → Users).");
}

main().catch((e) => {
  console.error("ERROR en la restauración:", e.message ?? e);
  process.exit(1);
});
