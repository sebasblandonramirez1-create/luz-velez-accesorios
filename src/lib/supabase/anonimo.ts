import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/tipos";
import { entornoSupabase } from "./entorno";

/**
 * Cliente sin sesión (rol anon) para las páginas públicas: el catálogo y la
 * firma del recibo. Solo alcanza lo que la base de datos concede a anon.
 */
export function clienteAnonimo() {
  const { url, clave } = entornoSupabase();
  return createClient<Database>(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
