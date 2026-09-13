/**
 * Formato de moneda, fechas y números para Colombia.
 * Moneda: pesos sin decimales y con punto de miles (118.900).
 * Fechas: dd/mm/aaaa en la zona horaria America/Bogota.
 */

export const ZONA_HORARIA = "America/Bogota";

const formatoPesos = new Intl.NumberFormat("es-CO", {
  style: "decimal",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  useGrouping: true,
});

/** 118900 → «118.900». Valores nulos → «0». */
export function pesos(valor: number | null | undefined): string {
  const n = Math.round(Number(valor ?? 0)) || 0; // «|| 0» convierte -0 en 0
  // es-CO usa punto de miles; se normaliza por si el entorno usa otro separador.
  return formatoPesos.format(n).replace(/,/g, ".").replace(/ /g, "");
}

/** 118900 → «$ 118.900». */
export function pesosConSigno(valor: number | null | undefined): string {
  return `$ ${pesos(valor)}`;
}

/** «118.900» o «118900» → 118900. Texto vacío o inválido → null. */
export function leerPesos(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  const limpio = String(texto).replace(/[^\d-]/g, "");
  if (limpio === "" || limpio === "-") return null;
  const n = Number.parseInt(limpio, 10);
  return Number.isNaN(n) ? null : n;
}

/** 40000 → «40» (precio en miles, como en las hojas y en la etiqueta). */
export function enMiles(valor: number | null | undefined): string {
  const n = Number(valor ?? 0);
  const miles = n / 1000;
  return Number.isInteger(miles) ? String(miles) : miles.toFixed(1).replace(".", ",");
}

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatoFechaHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Fecha en dd/mm/aaaa. */
export function fecha(valor: string | Date | null | undefined): string {
  if (!valor) return "";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "";
  return formatoFecha.format(d);
}

/** Fecha y hora en dd/mm/aaaa hh:mm. */
export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return "";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return "";
  return formatoFechaHora.format(d).replace(",", "");
}

/** Fecha de hoy en Bogotá como aaaa-mm-dd (para <input type="date">). */
export function hoyIso(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

/** «hace 3 días», «hoy», «ayer», para listas y alertas. */
export function haceCuanto(valor: string | Date | null | undefined, ahora: Date = new Date()): string {
  if (!valor) return "";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  const dias = Math.floor((ahora.getTime() - d.getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
  const anios = Math.floor(dias / 365);
  return anios === 1 ? "hace 1 año" : `hace ${anios} años`;
}

/** Horas transcurridas desde una fecha (para el aviso de respaldo). */
export function horasDesde(valor: string | Date | null | undefined, ahora: Date = new Date()): number | null {
  if (!valor) return null;
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return null;
  return (ahora.getTime() - d.getTime()) / 3_600_000;
}

/** Días que le quedan a un registro en la papelera antes de borrarse (30 en total). */
export function diasRestantesEnPapelera(eliminadoEn: string | Date, ahora: Date = new Date(), dias = 30): number {
  const d = typeof eliminadoEn === "string" ? new Date(eliminadoEn) : eliminadoEn;
  return Math.max(0, dias - Math.floor((ahora.getTime() - d.getTime()) / 86_400_000));
}
