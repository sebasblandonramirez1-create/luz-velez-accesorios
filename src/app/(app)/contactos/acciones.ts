"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";

export interface EstadoContacto {
  error?: string;
}

const esquema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre."),
  telefono: z.string().trim().default(""),
  tipo: z.enum(["cliente", "vendedora", "mayorista", "proveedor"]),
  direccion: z.string().trim().default(""),
  notas: z.string().trim().default(""),
});

function leer(fd: FormData) {
  const t = (k: string) => String(fd.get(k) ?? "");
  return esquema.safeParse({ nombre: t("nombre"), telefono: t("telefono"), tipo: t("tipo"), direccion: t("direccion"), notas: t("notas") });
}

export async function guardarContacto(_estado: EstadoContacto, fd: FormData): Promise<EstadoContacto> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const datos = leer(fd);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const id = String(fd.get("id") ?? "");
  const volver = String(fd.get("volver") ?? "");
  const supabase = await clienteServidor();

  if (id) {
    const { error } = await supabase.from("contactos").update(datos.data).eq("id", id);
    if (error) return { error: mensajeDeError(error) };
  } else {
    const { error } = await supabase.from("contactos").insert({ ...datos.data, creado_por: sesion.id });
    if (error) return { error: mensajeDeError(error) };
  }
  revalidatePath("/contactos");
  redirect(volver.startsWith("/") ? volver : "/contactos");
}

export async function enviarContactoAPapelera(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("contactos").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/contactos?error=${encodeURIComponent(mensajeDeError(error))}`);
  revalidatePath("/contactos");
  redirect("/contactos?aviso=" + encodeURIComponent("Contacto enviado a la papelera."));
}
