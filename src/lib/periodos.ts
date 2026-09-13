/**
 * Períodos de los reportes: día, semana, mes, año o rango, en fechas de
 * Bogotá (aaaa-mm-dd). Sin dependencias; se prueba en tests/periodos.test.ts.
 */
import { hoyIso } from "./formato";

export type TipoPeriodo = "dia" | "semana" | "mes" | "anio" | "rango";

export interface Periodo {
  tipo: TipoPeriodo;
  desde: string;
  hasta: string;
  etiqueta: string;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function partes(iso: string): { a: number; m: number; d: number } {
  const [a, m, d] = iso.split("-").map(Number);
  return { a, m, d };
}

function iso(a: number, m: number, d: number): string {
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Suma días a una fecha aaaa-mm-dd (aritmética en UTC para no depender de la zona del servidor). */
export function sumarDias(fecha: string, dias: number): string {
  const { a, m, d } = partes(fecha);
  const t = Date.UTC(a, m - 1, d) + dias * 86_400_000;
  const x = new Date(t);
  return iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

export function ultimoDiaDelMes(a: number, m: number): number {
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function fechaLarga(fecha: string): string {
  const { a, m, d } = partes(fecha);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/**
 * Calcula el período pedido. `referencia` es una fecha dentro del período
 * (por defecto hoy); para «rango» se usan desde y hasta explícitos.
 */
export function calcularPeriodo(tipo: TipoPeriodo, referencia: string = hoyIso(), rango?: { desde?: string; hasta?: string }): Periodo {
  const { a, m, d } = partes(referencia);
  switch (tipo) {
    case "dia":
      return { tipo, desde: referencia, hasta: referencia, etiqueta: fechaLarga(referencia) };
    case "semana": {
      // Lunes a domingo.
      const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
      const desde = sumarDias(referencia, diaSemana === 0 ? -6 : 1 - diaSemana);
      const hasta = sumarDias(desde, 6);
      return { tipo, desde, hasta, etiqueta: `Semana del ${fechaLarga(desde)} al ${fechaLarga(hasta)}` };
    }
    case "mes":
      return { tipo, desde: iso(a, m, 1), hasta: iso(a, m, ultimoDiaDelMes(a, m)), etiqueta: `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} de ${a}` };
    case "anio":
      return { tipo, desde: iso(a, 1, 1), hasta: iso(a, 12, 31), etiqueta: `Año ${a}` };
    case "rango": {
      const desde = rango?.desde && /^\d{4}-\d{2}-\d{2}$/.test(rango.desde) ? rango.desde : iso(a, m, 1);
      let hasta = rango?.hasta && /^\d{4}-\d{2}-\d{2}$/.test(rango.hasta) ? rango.hasta : referencia;
      if (hasta < desde) hasta = desde;
      return { tipo, desde, hasta, etiqueta: `Del ${fechaLarga(desde)} al ${fechaLarga(hasta)}` };
    }
  }
}

/** Período anterior o siguiente del mismo tamaño (para los botones ‹ ›). */
export function desplazarPeriodo(p: Periodo, direccion: -1 | 1): { tipo: TipoPeriodo; referencia: string; desde?: string; hasta?: string } {
  const { a, m } = partes(p.desde);
  switch (p.tipo) {
    case "dia":
      return { tipo: "dia", referencia: sumarDias(p.desde, direccion) };
    case "semana":
      return { tipo: "semana", referencia: sumarDias(p.desde, 7 * direccion) };
    case "mes": {
      const mm = m + direccion;
      const aa = mm < 1 ? a - 1 : mm > 12 ? a + 1 : a;
      const mes = mm < 1 ? 12 : mm > 12 ? 1 : mm;
      return { tipo: "mes", referencia: iso(aa, mes, 1) };
    }
    case "anio":
      return { tipo: "anio", referencia: iso(a + direccion, 1, 1) };
    case "rango": {
      const dias = Math.round((Date.parse(p.hasta) - Date.parse(p.desde)) / 86_400_000) + 1;
      const desde = sumarDias(p.desde, dias * direccion);
      const hasta = sumarDias(p.hasta, dias * direccion);
      return { tipo: "rango", referencia: desde, desde, hasta };
    }
  }
}
