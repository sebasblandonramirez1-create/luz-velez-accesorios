/**
 * Estado del proyecto de Supabase que respalda la app.
 *
 * El plan gratuito de Supabase «duerme» (pausa) el proyecto tras 7 días sin
 * consultas. Los datos no se pierden: quedan guardados y vuelven intactos al
 * reactivarlo (Supabase permite reactivar hasta un año después de la pausa).
 * Mientras duerme, la API no responde y la app no puede ingresar.
 *
 * Este módulo solo se usa en el servidor: sondea la API y, si hay un token de
 * gestión (SUPABASE_ACCESS_TOKEN), consulta el estado exacto y pide la
 * reactivación a la API de gestión de Supabase.
 */

export type EstadoProyecto = "activa" | "dormida" | "despertando" | "desconocido";

export interface InformeProyecto {
  estado: EstadoProyecto;
  /** Estado crudo que devuelve Supabase, si se pudo consultar. */
  estadoSupabase: string | null;
  /** Hay token de gestión: la app puede reactivar por sí misma. */
  puedeReactivar: boolean;
  /** Página del proyecto en el panel de Supabase, para reactivar a mano. */
  enlacePanel: string | null;
}

/** «https://abcd.supabase.co» → «abcd». */
export function refDelProyecto(url: string | undefined): string | null {
  if (!url) return null;
  const m = /^https?:\/\/([a-z0-9-]+)\.supabase\.(?:co|in)(?:\/|$)/i.exec(url.trim());
  return m ? m[1].toLowerCase() : null;
}

export function enlacePanelSupabase(ref: string | null): string | null {
  return ref ? `https://supabase.com/dashboard/project/${ref}` : null;
}

/** Traduce el estado de la API de gestión a los cuatro estados de la app. */
export function interpretarEstado(estadoSupabase: string | null | undefined): EstadoProyecto {
  switch ((estadoSupabase ?? "").toUpperCase()) {
    case "ACTIVE_HEALTHY":
      return "activa";
    case "INACTIVE":
    case "PAUSED":
    case "PAUSE_FAILED":
      return "dormida";
    case "RESTORING":
    case "COMING_UP":
    case "RESTARTING":
    case "PAUSING":
    case "UPGRADING":
    case "RESTORE_FAILED":
    case "ACTIVE_UNHEALTHY":
    case "INIT_FAILED":
    case "UNKNOWN":
      return "despertando";
    default:
      return "desconocido";
  }
}

/**
 * Sondea la API REST del proyecto. Un proyecto dormido no responde en absoluto
 * (ni siquiera con un error HTTP), así que «responde algo» significa activo.
 */
export async function sondearApi(url: string, clave: string, milisegundos = 5000, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), milisegundos);
  try {
    const r = await fetchFn(`${url.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` },
      signal: control.signal,
      cache: "no-store",
    });
    return r.status > 0 && r.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(temporizador);
  }
}

const API_GESTION = "https://api.supabase.com/v1/projects";

export async function estadoEnGestion(ref: string, token: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await fetchFn(`${API_GESTION}/${ref}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!r.ok) return null;
    const datos = (await r.json()) as { status?: string };
    return datos.status ?? null;
  } catch {
    return null;
  }
}

/** Pide a Supabase que reactive el proyecto. Devuelve un mensaje para la pantalla. */
export async function pedirReactivacion(ref: string, token: string, fetchFn: typeof fetch = fetch): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const r = await fetchFn(`${API_GESTION}/${ref}/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (r.ok) return { ok: true, mensaje: "Supabase está reactivando la aplicación. Suele tardar entre uno y tres minutos." };
    if (r.status === 401 || r.status === 403) return { ok: false, mensaje: "El token de gestión guardado en Vercel no es válido o no tiene permiso para este proyecto." };
    if (r.status === 429) return { ok: false, mensaje: "Supabase recibió demasiadas solicitudes. Espera un minuto y vuelve a intentarlo." };
    return { ok: false, mensaje: `Supabase respondió con el código ${r.status}. Reactívala desde el panel de Supabase.` };
  } catch {
    return { ok: false, mensaje: "No se pudo contactar a Supabase. Revisa el internet e inténtalo de nuevo." };
  }
}

/** Estado actual del proyecto, con el mejor método disponible. */
export async function informeProyecto(): Promise<InformeProyecto> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = refDelProyecto(url);
  const enlacePanel = enlacePanelSupabase(ref);
  const puedeReactivar = Boolean(token && ref);
  if (!url || !clave) return { estado: "desconocido", estadoSupabase: null, puedeReactivar, enlacePanel };

  if (token && ref) {
    const estadoSupabase = await estadoEnGestion(ref, token);
    if (estadoSupabase) return { estado: interpretarEstado(estadoSupabase), estadoSupabase, puedeReactivar, enlacePanel };
  }
  const responde = await sondearApi(url, clave);
  return { estado: responde ? "activa" : "dormida", estadoSupabase: null, puedeReactivar, enlacePanel };
}

/** Comprobación rápida para la pantalla de ingreso: ¿responde la base de datos? */
export async function baseDeDatosResponde(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) return true; // sin configuración, la pantalla de ingreso ya avisa
  return sondearApi(url, clave, 4000);
}
