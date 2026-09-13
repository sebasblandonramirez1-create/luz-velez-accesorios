import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database, Perfil } from "@/lib/tipos";
import { entornoSupabase } from "./entorno";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Se crea uno nuevo por petición; las cookies de sesión las gestiona @supabase/ssr.
 */
export async function clienteServidor() {
  const almacen = await cookies();
  const { url, clave } = entornoSupabase();
  return createServerClient<Database>(url, clave, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy
          // (src/proxy.ts) se encarga de refrescar la sesión.
        }
      },
    },
  });
}

/**
 * Cliente con la clave de servicio: salta las políticas RLS. Solo para tareas
 * del servidor que lo necesiten de verdad (respaldos, invitaciones). Nunca se
 * expone al navegador.
 */
export function clienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return createClient<Database>(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Usuaria autenticada y su perfil, o null. Se memoriza por petición. */
export const sesionActual = cache(async (): Promise<{ id: string; correo: string; perfil: Perfil } | null> => {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    if (process.env.NODE_ENV !== "production" && error) console.error("[sesion] getUser:", error.message);
    return null;
  }
  const { data: perfil, error: errorPerfil } = await supabase.from("perfiles").select("*").eq("id", data.user.id).maybeSingle();
  if (errorPerfil && process.env.NODE_ENV !== "production") console.error("[sesion] perfil:", errorPerfil.message);
  if (!perfil || !perfil.activo) return null;
  return { id: data.user.id, correo: data.user.email ?? "", perfil };
});
