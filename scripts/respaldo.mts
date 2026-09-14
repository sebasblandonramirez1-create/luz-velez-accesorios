#!/usr/bin/env node
/**
 * Copia de seguridad completa: base de datos (JSON y CSV por tabla) y fotos, en
 * un .zip, subida a un destino distinto de Supabase. Lo corre GitHub Actions
 * cada día (.github/workflows/respaldo.yml) y se puede correr a mano:
 *
 *   node scripts/respaldo.mts --destino local --carpeta ./respaldos
 *   node scripts/respaldo.mts --destino r2
 *   node scripts/respaldo.mts --destino drive
 *
 * Variables de entorno:
 *   SUPABASE_DB_URL              cadena de conexión (pooler, puerto 5432 o 6543)
 *   NEXT_PUBLIC_SUPABASE_URL     para descargar las fotos del bucket público
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET   (destino r2)
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID (destino drive)
 *
 * Retención: 30 copias diarias y la primera de cada mes durante 12 meses.
 */
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { armarZip, copiasParaBorrar, exportarTablas, listarFotos, nombreRespaldo } from "../src/lib/respaldo.ts";

interface Destino {
  nombre: string;
  listar(): Promise<string[]>;
  subir(nombre: string, bytes: Uint8Array): Promise<string>;
  borrar(nombre: string): Promise<void>;
}

function arg(nombre: string, porDefecto = ""): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}

function exigir(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return v;
}

function destinoLocal(carpeta: string): Destino {
  mkdirSync(carpeta, { recursive: true });
  return {
    nombre: `carpeta ${carpeta}`,
    async listar() {
      return readdirSync(carpeta);
    },
    async subir(nombre, bytes) {
      const ruta = join(carpeta, nombre);
      writeFileSync(ruta, bytes);
      return ruta;
    },
    async borrar(nombre) {
      unlinkSync(join(carpeta, nombre));
    },
  };
}

async function destinoR2(): Promise<Destino> {
  const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const cuenta = exigir("R2_ACCOUNT_ID");
  const bucket = exigir("R2_BUCKET");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${cuenta}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: exigir("R2_ACCESS_KEY_ID"), secretAccessKey: exigir("R2_SECRET_ACCESS_KEY") },
  });
  return {
    nombre: `Cloudflare R2 (${bucket})`,
    async listar() {
      const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "respaldo-" }));
      return (r.Contents ?? []).map((o) => o.Key!).filter(Boolean);
    },
    async subir(nombre, bytes) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: nombre, Body: bytes, ContentType: "application/zip" }));
      return `r2://${bucket}/${nombre}`;
    },
    async borrar(nombre) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: nombre }));
    },
  };
}

async function tokenGoogle(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: exigir("GOOGLE_CLIENT_ID"),
      client_secret: exigir("GOOGLE_CLIENT_SECRET"),
      refresh_token: exigir("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error(`Google no entregó el token: ${r.status} ${await r.text()}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

async function destinoDrive(): Promise<Destino> {
  const carpeta = exigir("GOOGLE_DRIVE_FOLDER_ID");
  const token = await tokenGoogle();
  const cab = { Authorization: `Bearer ${token}` };
  const ids = new Map<string, string>();
  return {
    nombre: "Google Drive",
    async listar() {
      const q = encodeURIComponent(`'${carpeta}' in parents and trashed = false and name contains 'respaldo-'`);
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1000`, { headers: cab });
      if (!r.ok) throw new Error(`Drive no listó los archivos: ${r.status} ${await r.text()}`);
      const j = (await r.json()) as { files: { id: string; name: string }[] };
      for (const f of j.files) ids.set(f.name, f.id);
      return j.files.map((f) => f.name);
    },
    async subir(nombre, bytes) {
      const limite = "==limite==";
      const meta = JSON.stringify({ name: nombre, parents: [carpeta], mimeType: "application/zip" });
      const cuerpo = new Blob([
        `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: application/zip\r\n\r\n`,
        bytes as unknown as BlobPart,
        `\r\n--${limite}--`,
      ]);
      const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
        method: "POST",
        headers: { ...cab, "Content-Type": `multipart/related; boundary=${limite}` },
        body: cuerpo,
      });
      if (!r.ok) throw new Error(`Drive no aceptó el archivo: ${r.status} ${await r.text()}`);
      const j = (await r.json()) as { id: string };
      return `drive://${j.id}`;
    },
    async borrar(nombre) {
      const id = ids.get(nombre);
      if (!id) return;
      await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, { method: "DELETE", headers: cab });
    },
  };
}

async function descargarFotos(rutas: string[]): Promise<{ ruta: string; bytes: Uint8Array }[]> {
  const base = exigir("NEXT_PUBLIC_SUPABASE_URL");
  const salida: { ruta: string; bytes: Uint8Array }[] = [];
  let fallidas = 0;
  for (const ruta of rutas) {
    const r = await fetch(`${base}/storage/v1/object/public/fotos/${ruta}`);
    if (!r.ok) {
      fallidas++;
      console.warn(`  · no se pudo descargar ${ruta}: ${r.status}`);
      continue;
    }
    salida.push({ ruta, bytes: new Uint8Array(await r.arrayBuffer()) });
  }
  if (fallidas) console.warn(`  ${fallidas} fotos no se pudieron descargar.`);
  return salida;
}

async function main() {
  const tipo = arg("destino", process.env.RESPALDO_DESTINO || "local");
  const inicio = Date.now();
  console.log(`Respaldo → destino: ${tipo}`);

  const cliente = new pg.Client({ connectionString: exigir("SUPABASE_DB_URL"), ssl: process.env.PGSSL === "off" ? undefined : { rejectUnauthorized: false } });
  await cliente.connect();
  try {
    console.log("Leyendo tablas…");
    const tablas = await exportarTablas(cliente);
    const rutas = await listarFotos(cliente);
    console.log(`  ${Object.values(tablas).reduce((s, f) => s + f.length, 0)} filas en ${Object.keys(tablas).length} tablas · ${rutas.length} fotos`);
    const fotos = arg("sin-fotos") ? [] : await descargarFotos(rutas);
    const zip = armarZip(tablas, fotos);
    const nombre = nombreRespaldo();
    console.log(`  zip ${nombre}: ${(zip.byteLength / 1024 / 1024).toFixed(2)} MB`);

    const destino = tipo === "r2" ? await destinoR2() : tipo === "drive" ? await destinoDrive() : destinoLocal(arg("carpeta", "./respaldos"));
    const ubicacion = await destino.subir(nombre, zip);
    console.log(`  subido a ${destino.nombre}: ${ubicacion}`);

    const existentes = await destino.listar();
    const borrar = copiasParaBorrar(existentes);
    for (const n of borrar) {
      await destino.borrar(n);
      console.log(`  retención: borrada ${n}`);
    }

    await cliente.query("update public.ajustes set ultimo_respaldo_en = now(), ultimo_respaldo_detalle = $1 where id = 1", [
      `${nombre} → ${destino.nombre} (${(zip.byteLength / 1024 / 1024).toFixed(2)} MB, ${fotos.length} fotos)`,
    ]);
    console.log(`Listo en ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
  } finally {
    await cliente.end();
  }
}

main().catch((e) => {
  console.error("ERROR en el respaldo:", e.message ?? e);
  process.exit(1);
});
