"use server";

import { informeProyecto, pedirReactivacion, refDelProyecto } from "@/lib/supabase/proyecto";

/**
 * Pide a Supabase que reactive el proyecto dormido. No requiere sesión: cuando
 * el proyecto duerme nadie puede ingresar. Solo actúa si de verdad está dormido,
 * así que no se puede usar para nada más.
 */
export async function reactivarAplicacion(): Promise<{ ok: boolean; mensaje: string }> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = refDelProyecto(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!token || !ref) {
    return { ok: false, mensaje: "La app no tiene el token de gestión de Supabase. Reactívala desde el panel de Supabase (enlace abajo)." };
  }
  const informe = await informeProyecto();
  if (informe.estado === "activa") return { ok: true, mensaje: "La aplicación ya está activa. Puedes ingresar." };
  if (informe.estado === "despertando") return { ok: true, mensaje: "La aplicación ya se está reactivando. Espera un momento." };
  return pedirReactivacion(ref, token);
}
