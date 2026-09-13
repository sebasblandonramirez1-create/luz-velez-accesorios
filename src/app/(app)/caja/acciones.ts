"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { leerPesos } from "@/lib/formato";

export interface EstadoCierre {
  error?: string;
}

export async function cerrarCajaAccion(_e: EstadoCierre, fd: FormData): Promise<EstadoCierre> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  if (sesion.perfil.rol !== "propietaria") return { error: "Solo la propietaria cierra la caja." };
  const dia = String(fd.get("dia") ?? "");
  const contado = leerPesos(String(fd.get("efectivo_contado") ?? ""));
  const nota = String(fd.get("nota") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { error: "Falta el día." };
  if (contado == null || contado < 0) return { error: "Escribe cuánto efectivo contaste (puede ser 0)." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("cerrar_caja", { p_dia: dia, p_efectivo_contado: contado, p_nota: nota });
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/caja");
  revalidatePath("/reportes");
  redirect(`/caja?dia=${dia}&aviso=${encodeURIComponent("Caja cerrada.")}`);
}
