"use client";

/**
 * Cola de operaciones hechas sin red. Cada entrada guarda el tipo de operación
 * y su carga (la misma que recibe la acción del servidor); el componente
 * SincronizarPendientes las reintenta cuando vuelve la conexión.
 * Se guarda en localStorage (pocas entradas, tamaño pequeño).
 */
export type TipoPendiente = "venta" | "consignacion" | "liquidacion" | "abono" | "movimiento" | "compra";

export interface OperacionPendiente {
  id: string;
  tipo: TipoPendiente;
  carga: unknown;
  descripcion: string;
  creada: string;
  error?: string;
}

const CLAVE = "operaciones-pendientes";
const EVENTO = "pendientes-cambiaron";

export function leerPendientes(): OperacionPendiente[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
  } catch {
    return [];
  }
}

function guardar(lista: OperacionPendiente[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

export function encolarPendiente(tipo: TipoPendiente, carga: unknown, descripcion: string): OperacionPendiente {
  const op: OperacionPendiente = { id: crypto.randomUUID(), tipo, carga, descripcion, creada: new Date().toISOString() };
  guardar([...leerPendientes(), op]);
  return op;
}

export function quitarPendiente(id: string) {
  guardar(leerPendientes().filter((o) => o.id !== id));
}

export function marcarErrorPendiente(id: string, error: string) {
  guardar(leerPendientes().map((o) => (o.id === id ? { ...o, error } : o)));
}

export function suscribirPendientes(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

/** ¿El error viene de falta de red (y no de una validación)? */
export function esErrorDeRed(mensaje: string | undefined | null): boolean {
  if (!mensaje) return false;
  return /Sin conexión|Failed to fetch|NetworkError|fetch failed|Load failed|network|ERR_INTERNET|offline/i.test(mensaje) || (typeof navigator !== "undefined" && !navigator.onLine);
}
