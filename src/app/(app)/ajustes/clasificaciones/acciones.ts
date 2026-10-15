"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { codigoClasificacionValido, normalizarCodigoClasificacion } from "@/lib/clasificaciones";

const RUTA = "/ajustes/clasificaciones";

function volver(tipo: "aviso" | "error", texto: string): never {
  redirect(`${RUTA}?${tipo}=${encodeURIComponent(texto)}`);
}

async function propietaria() {
  const sesion = await sesionActual();
  if (!sesion) volver("error", "Tu sesión venció. Vuelve a entrar.");
  if (sesion.perfil.rol !== "propietaria") volver("error", "Solo la propietaria puede cambiar las clasificaciones.");
  return sesion;
}

function refrescar() {
  revalidatePath(RUTA);
  revalidatePath("/productos");
  revalidatePath("/", "layout");
}

/** Crea una clasificación nueva (código de 1 a 6 letras y nombre). */
export async function crearClasificacion(fd: FormData) {
  await propietaria();
  const codigo = normalizarCodigoClasificacion(String(fd.get("codigo") ?? ""));
  const nombre = String(fd.get("nombre") ?? "").trim();
  if (!codigoClasificacionValido(codigo)) volver("error", "El código debe tener de 1 a 6 letras, por ejemplo CP o PLM.");
  if (!nombre) volver("error", "Escribe el nombre de la clasificación.");
  const supabase = await clienteServidor();
  const { data: ultima } = await supabase.from("clasificaciones_producto").select("orden").order("orden", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("clasificaciones_producto").insert({ codigo, nombre, orden: (ultima?.orden ?? 0) + 1 });
  if (error) volver("error", /duplicate/.test(error.message) ? `Ya existe una clasificación con el código ${codigo}.` : mensajeDeError(error));
  refrescar();
  volver("aviso", `Clasificación ${codigo} · ${nombre} creada.`);
}

/** Cambia el nombre, el orden o el código de una clasificación. */
export async function editarClasificacion(fd: FormData) {
  await propietaria();
  const codigoActual = String(fd.get("codigo_actual") ?? "");
  const codigo = normalizarCodigoClasificacion(String(fd.get("codigo") ?? codigoActual));
  const nombre = String(fd.get("nombre") ?? "").trim();
  const orden = Number.parseInt(String(fd.get("orden") ?? "0"), 10);
  if (!codigoClasificacionValido(codigo)) volver("error", "El código debe tener de 1 a 6 letras.");
  if (!nombre) volver("error", "Escribe el nombre de la clasificación.");
  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("clasificaciones_producto")
    .update({ codigo, nombre, orden: Number.isFinite(orden) ? orden : 0 })
    .eq("codigo", codigoActual);
  if (error) volver("error", /duplicate/.test(error.message) ? `Ya existe una clasificación con el código ${codigo}.` : mensajeDeError(error));
  refrescar();
  volver("aviso", `Clasificación ${codigo} guardada.${codigo !== codigoActual ? " Los productos que la tenían ya usan el código nuevo." : ""}`);
}

/** Activa o desactiva: una inactiva no se ofrece al clasificar, pero sus productos la conservan. */
export async function alternarClasificacion(fd: FormData) {
  await propietaria();
  const codigo = String(fd.get("codigo") ?? "");
  const activa = String(fd.get("activa") ?? "") === "true";
  const supabase = await clienteServidor();
  const { error } = await supabase.from("clasificaciones_producto").update({ activa }).eq("codigo", codigo);
  if (error) volver("error", mensajeDeError(error));
  refrescar();
  volver("aviso", activa ? `Clasificación ${codigo} activada.` : `Clasificación ${codigo} desactivada. Sus productos la conservan; no se ofrece para productos nuevos.`);
}

/** Borra una clasificación que ningún producto use. */
export async function borrarClasificacion(fd: FormData) {
  await propietaria();
  const codigo = String(fd.get("codigo") ?? "");
  const supabase = await clienteServidor();
  const { count } = await supabase.from("productos").select("id", { count: "exact", head: true }).eq("clasificacion", codigo);
  if ((count ?? 0) > 0) volver("error", `${codigo} está en ${count} ${count === 1 ? "producto" : "productos"}: cámbialos de clasificación antes de borrarla, o desactívala.`);
  const { error } = await supabase.from("clasificaciones_producto").delete().eq("codigo", codigo);
  if (error) volver("error", mensajeDeError(error));
  refrescar();
  volver("aviso", `Clasificación ${codigo} borrada.`);
}
