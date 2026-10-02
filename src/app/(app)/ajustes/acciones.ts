"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";

export interface EstadoAjustes {
  error?: string;
  exito?: string;
}

async function exigirPropietaria() {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  if (sesion.perfil.rol !== "propietaria") return { error: "Solo la propietaria puede cambiar los ajustes." };
  return { sesion };
}

const esquemaNegocio = z.object({
  nombre_negocio: z.string().trim().min(1, "Escribe el nombre del negocio."),
  telefono_negocio: z.string().trim().default(""),
  documento_negocio: z.string().trim().max(40).default(""),
  correo_negocio: z.string().trim().toLowerCase().max(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Revisa el correo del negocio.").default(""),
  direccion_negocio: z.string().trim().max(200).default(""),
  ciudad_negocio: z.string().trim().max(80).default(""),
  prefijo_general: z.string().trim().toUpperCase().regex(/^[A-Z]{1,6}$/, "El prefijo general debe tener de 1 a 6 letras."),
  prefijo_pulsera: z.string().trim().toUpperCase().regex(/^[A-Z]{1,6}$/, "El prefijo de pulseras debe tener de 1 a 6 letras."),
  stock_minimo_predeterminado: z.coerce.number().int().min(0),
});

export async function guardarNegocio(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const p = await exigirPropietaria();
  if ("error" in p) return p;
  const datos = esquemaNegocio.safeParse(Object.fromEntries(fd));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("ajustes").update(datos.data).eq("id", 1);
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/", "layout");
  return { exito: "Datos del negocio guardados." };
}

const esquemaConsignacion = z.object({
  consignacion_dias_plazo: z.coerce.number().int("El plazo debe ser un número entero de días.").min(1, "El plazo mínimo es 1 día.").max(365, "El plazo máximo es 365 días."),
  consignacion_condiciones: z.string().trim().max(4000, "Las condiciones son demasiado largas."),
});

export async function guardarConsignacion(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const p = await exigirPropietaria();
  if ("error" in p) return p;
  const datos = esquemaConsignacion.safeParse(Object.fromEntries(fd));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("ajustes").update(datos.data).eq("id", 1);
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/", "layout");
  return { exito: "Recibo de consignación guardado. Aplica a los recibos sin firmar." };
}

const esquemaPrecios = z.object({
  regla_precio_publico: z.enum(["manual", "multiplicador"]),
  factor_precio_publico: z.coerce.number().positive("El factor debe ser mayor que cero."),
  redondeo_precio_publico: z.enum(["ninguno", "centena", "mil", "terminacion_900"]),
});

export async function guardarPrecios(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const p = await exigirPropietaria();
  if ("error" in p) return p;
  const datos = esquemaPrecios.safeParse({
    regla_precio_publico: fd.get("regla_precio_publico"),
    factor_precio_publico: String(fd.get("factor_precio_publico") ?? "").replace(",", "."),
    redondeo_precio_publico: fd.get("redondeo_precio_publico"),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("ajustes").update(datos.data).eq("id", 1);
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/ajustes");
  return { exito: "Regla de precios guardada." };
}

const esquemaEtiqueta = z.object({
  impresora_modelo: z.string().trim().default(""),
  etiqueta_ancho_mm: z.coerce.number().positive("El ancho debe ser mayor que cero."),
  etiqueta_alto_mm: z.coerce.number().positive("El alto debe ser mayor que cero."),
  etiqueta_dpi: z.coerce.number().int().positive(),
  etiqueta_mostrar_precio_miles: z.boolean(),
  etiqueta_lineas: z.array(z.enum(["negocio", "descripcion", "codigo_precio", "precio_publico"])).min(1, "Deja al menos una línea en la etiqueta."),
});

export async function guardarEtiqueta(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const p = await exigirPropietaria();
  if ("error" in p) return p;
  const datos = esquemaEtiqueta.safeParse({
    impresora_modelo: fd.get("impresora_modelo"),
    etiqueta_ancho_mm: String(fd.get("etiqueta_ancho_mm") ?? "").replace(",", "."),
    etiqueta_alto_mm: String(fd.get("etiqueta_alto_mm") ?? "").replace(",", "."),
    etiqueta_dpi: fd.get("etiqueta_dpi") ?? 203,
    etiqueta_mostrar_precio_miles: fd.get("etiqueta_mostrar_precio_miles") === "on",
    etiqueta_lineas: fd.getAll("etiqueta_lineas").map(String),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("ajustes").update(datos.data).eq("id", 1);
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/ajustes");
  return { exito: "Ajustes de etiqueta guardados." };
}

const esquemaCatalogo = z.object({
  catalogo_publico_activo: z.boolean(),
  catalogo_slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/, "La dirección solo puede tener letras minúsculas, números y guiones (3 a 40)."),
});

export async function guardarCatalogo(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const p = await exigirPropietaria();
  if ("error" in p) return p;
  const datos = esquemaCatalogo.safeParse({ catalogo_publico_activo: fd.get("catalogo_publico_activo") === "on", catalogo_slug: fd.get("catalogo_slug") });
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("ajustes").update(datos.data).eq("id", 1);
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/ajustes");
  revalidatePath("/catalogo");
  return { exito: datos.data.catalogo_publico_activo ? "Catálogo público activado." : "Catálogo público desactivado." };
}

export async function guardarRespaldo(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const p = await exigirPropietaria();
  if ("error" in p) return p;
  const destino = String(fd.get("respaldo_destino") ?? "ninguno");
  if (!["ninguno", "r2", "drive"].includes(destino)) return { error: "Destino no válido." };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("ajustes").update({ respaldo_destino: destino as "ninguno" | "r2" | "drive" }).eq("id", 1);
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/ajustes");
  revalidatePath("/");
  return { exito: "Preferencia de respaldo guardada. La copia automática se configura en la Fase 5." };
}

export async function guardarPerfil(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const nombre = String(fd.get("nombre") ?? "").trim();
  if (!nombre) return { error: "Escribe tu nombre." };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("perfiles").update({ nombre }).eq("id", sesion.id);
  if (error) return { error: mensajeDeError(error) };
  revalidatePath("/", "layout");
  return { exito: "Nombre guardado." };
}

export async function cambiarRolUsuaria(fd: FormData) {
  const p = await exigirPropietaria();
  if ("error" in p) redirect(`/ajustes/usuarios?error=${encodeURIComponent(p.error!)}`);
  const id = String(fd.get("id") ?? "");
  const rol = String(fd.get("rol") ?? "");
  const activo = String(fd.get("activo") ?? "true") === "true";
  if (id === p.sesion!.id) redirect(`/ajustes/usuarios?error=${encodeURIComponent("No puedes cambiar tu propio rol ni desactivarte.")}`);
  if (!["propietaria", "ayudante"].includes(rol)) redirect("/ajustes/usuarios");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("perfiles").update({ rol: rol as "propietaria" | "ayudante", activo }).eq("id", id);
  if (error) redirect(`/ajustes/usuarios?error=${encodeURIComponent(mensajeDeError(error))}`);
  revalidatePath("/ajustes/usuarios");
  redirect("/ajustes/usuarios?aviso=" + encodeURIComponent("Cuenta actualizada."));
}

/**
 * Invita a una nueva usuaria con el rol elegido. Siempre deja una invitación
 * registrada (la persona puede crear su cuenta desde «Crear cuenta con
 * invitación» en la pantalla de ingreso). Si el servidor tiene la clave de
 * servicio, además le envía el correo de invitación de Supabase.
 */
export async function invitarUsuaria(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const p = await exigirPropietaria();
  if ("error" in p) return p;
  const correo = String(fd.get("correo") ?? "").trim().toLowerCase();
  const nombre = String(fd.get("nombre") ?? "").trim();
  const rol = String(fd.get("rol") ?? "ayudante") === "propietaria" ? "propietaria" : "ayudante";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return { error: "Escribe un correo válido." };
  const supabase = await clienteServidor();
  const { data: existente } = await supabase.from("perfiles").select("id").ilike("correo", correo).maybeSingle();
  if (existente) return { error: "Ese correo ya tiene cuenta. Cambia su rol en la lista de arriba." };
  const { error } = await supabase.from("invitaciones").insert({ correo, nombre, rol, creada_por: p.sesion!.id });
  if (error) return { error: /duplicate/.test(error.message) ? "Ese correo ya tiene una invitación pendiente." : mensajeDeError(error) };
  revalidatePath("/ajustes/usuarios");

  const rolTexto = rol === "propietaria" ? "propietaria" : "ayudante";
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { clienteServicio } = await import("@/lib/supabase/servidor");
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const { error: e2 } = await clienteServicio().auth.admin.inviteUserByEmail(correo, {
      data: { nombre },
      redirectTo: `${base}/auth/callback?siguiente=${encodeURIComponent("/ajustes/contrasena")}`,
    });
    if (!e2) return { exito: `Invitación enviada por correo a ${correo}. Entrará como ${rolTexto}.` };
  }
  return {
    exito: `Invitación creada para ${correo} como ${rolTexto}. Dile que entre a la app, pulse «Crear cuenta con invitación» y use ese mismo correo.`,
  };
}

export async function borrarInvitacion(fd: FormData) {
  const p = await exigirPropietaria();
  if ("error" in p) redirect(`/ajustes/usuarios?error=${encodeURIComponent(p.error!)}`);
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  await supabase.from("invitaciones").delete().eq("id", id).is("usada_en", null);
  revalidatePath("/ajustes/usuarios");
  redirect("/ajustes/usuarios?aviso=" + encodeURIComponent("Invitación eliminada."));
}

export async function cambiarContrasena(_e: EstadoAjustes, fd: FormData): Promise<EstadoAjustes> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const c1 = String(fd.get("contrasena") ?? "");
  const c2 = String(fd.get("confirmar") ?? "");
  if (c1.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (c1 !== c2) return { error: "Las dos contraseñas no coinciden." };
  const supabase = await clienteServidor();
  const { error } = await supabase.auth.updateUser({ password: c1 });
  if (error) return { error: mensajeDeError(error) };
  return { exito: "Contraseña cambiada." };
}

export async function restaurarDePapelera(fd: FormData) {
  const p = await exigirPropietaria();
  if ("error" in p) redirect(`/ajustes/papelera?error=${encodeURIComponent(p.error!)}`);
  const tabla = String(fd.get("tabla") ?? "");
  const id = String(fd.get("id") ?? "");
  const tablas = ["productos", "contactos", "movimientos_inventario", "ventas", "consignaciones", "liquidaciones", "abonos", "compras", "gastos"] as const;
  if (!(tablas as readonly string[]).includes(tabla)) redirect("/ajustes/papelera");
  const supabase = await clienteServidor();
  const { error } = await supabase
    .from(tabla as (typeof tablas)[number])
    .update({ eliminado_en: null })
    .eq("id", id);
  if (error) redirect(`/ajustes/papelera?error=${encodeURIComponent(mensajeDeError(error))}`);
  revalidatePath("/", "layout");
  redirect("/ajustes/papelera?aviso=" + encodeURIComponent("Registro restaurado."));
}
