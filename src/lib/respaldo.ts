/**
 * Copias de seguridad: exportar toda la base a un .zip legible (JSON y CSV por
 * tabla, más las fotos) y restaurarla en una base vacía.
 *
 * - `exportarTablas` y `restaurarTablas` reciben un cliente `pg` conectado
 *   (con permisos de administración: postgres en Supabase). Los usa el script
 *   diario (GitHub Actions), el script de restauración y la prueba automática.
 * - `armarZip` / `leerZip` son puros (fflate) y también los usa el navegador
 *   para la exportación manual desde la app.
 *
 * Formato del zip (versión 1):
 *   meta.json                 versión, fecha, conteos por tabla
 *   datos/<tabla>.json        filas tal cual (JSON)
 *   datos/<tabla>.csv         las mismas filas, para abrir en Excel
 *   fotos/<ruta en el bucket> archivos del bucket «fotos»
 */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { escribirCsv } from "./csv.ts";

/** Tablas en orden de dependencias (padres primero). Las cuentas de usuarias (auth) no se incluyen. */
export const TABLAS_RESPALDO = [
  "perfiles",
  "invitaciones",
  "ajustes",
  "contactos",
  "productos",
  "producto_fotos",
  "precio_historial",
  "movimientos_inventario",
  "ventas",
  "venta_lineas",
  "consignaciones",
  "consignacion_lineas",
  "consignacion_recibos",
  "consignacion_modificaciones",
  "liquidaciones",
  "liquidacion_lineas",
  "cuentas_por_cobrar",
  "abonos",
  "compras",
  "compra_lineas",
  "gastos",
  "cierres_caja",
  "auditoria",
] as const;

export type TablaRespaldo = (typeof TABLAS_RESPALDO)[number];

/** Secuencias que hay que dejar apuntando al siguiente número tras restaurar. */
export const SECUENCIAS_RESPALDO: { secuencia: string; tabla: TablaRespaldo; columna: string }[] = [
  { secuencia: "public.ventas_numero_seq", tabla: "ventas", columna: "numero" },
  { secuencia: "public.consignaciones_numero_seq", tabla: "consignaciones", columna: "numero" },
  { secuencia: "public.compras_numero_seq", tabla: "compras", columna: "numero" },
];

export const VERSION_RESPALDO = 1;

export interface MetaRespaldo {
  version: number;
  fecha: string;
  aplicacion: string;
  conteos: Record<string, number>;
  fotos: number;
}

export interface ContenidoRespaldo {
  meta: MetaRespaldo;
  tablas: Record<string, Record<string, unknown>[]>;
  fotos: { ruta: string; bytes: Uint8Array }[];
}

/** Cliente mínimo compatible con pg.Client / pg.PoolClient. */
export interface ClienteSql {
  query(texto: string, valores?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

/** Lee todas las tablas con un cliente de administración. */
export async function exportarTablas(cliente: ClienteSql): Promise<Record<string, Record<string, unknown>[]>> {
  const salida: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLAS_RESPALDO) {
    const r = await cliente.query(`select * from public.${t}`);
    salida[t] = r.rows;
  }
  return salida;
}

/** Lista las fotos del bucket (ruta) consultando storage.objects. */
export async function listarFotos(cliente: ClienteSql): Promise<string[]> {
  const r = await cliente.query("select name from storage.objects where bucket_id = 'fotos' and name is not null order by name");
  return r.rows.map((x) => String(x.name));
}

function csvDeFilas(filas: Record<string, unknown>[]): string {
  if (filas.length === 0) return escribirCsv([[]]);
  const columnas = Object.keys(filas[0]);
  return escribirCsv([
    columnas,
    ...filas.map((f) =>
      columnas.map((c) => {
        const v = f[c];
        if (v == null) return "";
        if (v instanceof Date) return v.toISOString();
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      }),
    ),
  ]);
}

/** Construye el zip a partir de tablas y fotos. */
export function armarZip(tablas: Record<string, Record<string, unknown>[]>, fotos: { ruta: string; bytes: Uint8Array }[], fecha = new Date()): Uint8Array {
  const meta: MetaRespaldo = {
    version: VERSION_RESPALDO,
    fecha: fecha.toISOString(),
    aplicacion: "luz-velez-accesorios",
    conteos: Object.fromEntries(Object.entries(tablas).map(([t, f]) => [t, f.length])),
    fotos: fotos.length,
  };
  const archivos: Record<string, Uint8Array> = { "meta.json": strToU8(JSON.stringify(meta, null, 2)) };
  for (const [t, filas] of Object.entries(tablas)) {
    archivos[`datos/${t}.json`] = strToU8(JSON.stringify(filas));
    archivos[`datos/${t}.csv`] = strToU8(csvDeFilas(filas));
  }
  for (const f of fotos) archivos[`fotos/${f.ruta}`] = f.bytes;
  return zipSync(archivos, { level: 6 });
}

/** Lee un zip de respaldo y devuelve su contenido. Valida la versión. */
export function leerZip(bytes: Uint8Array): ContenidoRespaldo {
  const partes = unzipSync(bytes);
  if (!partes["meta.json"]) throw new Error("El archivo no es un respaldo válido: falta meta.json.");
  const meta = JSON.parse(strFromU8(partes["meta.json"])) as MetaRespaldo;
  if (meta.version !== VERSION_RESPALDO) throw new Error(`Versión de respaldo ${meta.version} no soportada (se esperaba ${VERSION_RESPALDO}).`);
  const tablas: Record<string, Record<string, unknown>[]> = {};
  const fotos: { ruta: string; bytes: Uint8Array }[] = [];
  for (const [nombre, contenido] of Object.entries(partes)) {
    const m = /^datos\/([a-z_]+)\.json$/.exec(nombre);
    if (m) tablas[m[1]] = JSON.parse(strFromU8(contenido));
    else if (nombre.startsWith("fotos/") && !nombre.endsWith("/")) fotos.push({ ruta: nombre.slice(6), bytes: contenido });
  }
  return { meta, tablas, fotos };
}

/**
 * Restaura las tablas en una base que ya tiene el esquema (migraciones
 * aplicadas). Vacía las tablas, inserta las filas del respaldo con los
 * disparadores desactivados (para no duplicar movimientos ni cuentas), ajusta
 * las secuencias y recalcula el stock. Todo dentro de una transacción.
 */
export async function restaurarTablas(cliente: ClienteSql, tablas: Record<string, Record<string, unknown>[]>): Promise<Record<string, number>> {
  const conteos: Record<string, number> = {};
  await cliente.query("begin");
  try {
    await cliente.query("set local session_replication_role = replica");
    // Vaciar en orden inverso.
    for (const t of [...TABLAS_RESPALDO].reverse()) {
      await cliente.query(`delete from public.${t}`);
    }
    for (const t of TABLAS_RESPALDO) {
      const filas = tablas[t] ?? [];
      conteos[t] = filas.length;
      if (filas.length === 0) continue;
      // Solo columnas reales (no generadas); las identity se insertan con su valor.
      const cols = await cliente.query(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 and is_generated = 'NEVER' order by ordinal_position",
        [t],
      );
      const columnas = cols.rows.map((c) => `"${c.column_name}"`).join(", ");
      const lote = 500;
      for (let i = 0; i < filas.length; i += lote) {
        await cliente.query(
          `insert into public.${t} (${columnas}) overriding system value select ${columnas} from jsonb_populate_recordset(null::public.${t}, $1::jsonb)`,
          [JSON.stringify(filas.slice(i, i + lote))],
        );
      }
    }
    for (const s of SECUENCIAS_RESPALDO) {
      await cliente.query(`select setval('${s.secuencia}', coalesce((select max(${s.columna}) from public.${s.tabla}), 0) + 1, false)`);
    }
    for (const t of ["precio_historial", "auditoria"]) {
      await cliente.query(`select setval(pg_get_serial_sequence('public.${t}', 'id'), coalesce((select max(id) from public.${t}), 0) + 1, false)`);
    }
    // Recalcular el stock todavía sin disparadores: así no se generan filas de auditoría nuevas.
    await cliente.query("select public.recalcular_todo_el_stock()");
    await cliente.query("set local session_replication_role = origin");
    await cliente.query("commit");
  } catch (e) {
    await cliente.query("rollback");
    throw e;
  }
  return conteos;
}

/** Nombre del archivo de una copia diaria: respaldo-aaaa-mm-dd.zip (fecha en Bogotá). */
export function nombreRespaldo(fecha = new Date()): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
  return `respaldo-${dia}.zip`;
}

/**
 * Política de retención: conserva las últimas `diarias` copias y, además, la
 * primera copia de cada mes durante `mensuales` meses. Devuelve los nombres a
 * borrar. `nombres` son archivos respaldo-aaaa-mm-dd.zip.
 */
export function copiasParaBorrar(nombres: string[], diarias = 30, mensuales = 12): string[] {
  const fechas = nombres
    .map((n) => ({ n, f: /^respaldo-(\d{4}-\d{2}-\d{2})\.zip$/.exec(n)?.[1] }))
    .filter((x): x is { n: string; f: string } => Boolean(x.f))
    .sort((a, b) => b.f.localeCompare(a.f));
  const conservar = new Set<string>(fechas.slice(0, diarias).map((x) => x.n));
  const primeraDelMes = new Map<string, { n: string; f: string }>();
  for (const x of fechas) {
    const mes = x.f.slice(0, 7);
    const actual = primeraDelMes.get(mes);
    if (!actual || x.f < actual.f) primeraDelMes.set(mes, x);
  }
  const meses = [...primeraDelMes.keys()].sort().reverse().slice(0, mensuales);
  for (const m of meses) conservar.add(primeraDelMes.get(m)!.n);
  return fechas.filter((x) => !conservar.has(x.n)).map((x) => x.n);
}
