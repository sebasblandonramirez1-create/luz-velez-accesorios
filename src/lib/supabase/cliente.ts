"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/tipos";
import { entornoSupabase } from "./entorno";

let instancia: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente de Supabase para componentes del navegador (una sola instancia). */
export function clienteNavegador() {
  if (!instancia) {
    const { url, clave } = entornoSupabase();
    instancia = createBrowserClient<Database>(url, clave);
  }
  return instancia;
}
