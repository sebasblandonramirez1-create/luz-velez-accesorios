"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { mensajeDeError } from "@/lib/errores";
import { leerPesos } from "@/lib/formato";
import { normalizarCodigo } from "@/lib/codigos";
import type { CategoriaProducto } from "@/lib/tipos";

export interface EstadoFormulario {
  error?: string;
  exito?: string;
}

const esquemaProducto = z.object({
  codigo: z.string().min(2, "El código debe tener al menos 2 caracteres.").max(20).regex(/^[A-Z0-9-]+$/, "El código solo puede tener letras, números y guiones."),
  nombre: z.string().trim().min(1, "Escribe el nombre o descripción."),
  categoria: z.enum(["areta", "collar", "pulsera", "anillo", "otro"]),
  subcategoria: z.string().trim().default(""),
  material: z.string().trim().default(""),
  color: z.string().trim().default(""),
  precio_base: z.number().int().min(0, "El precio base no puede ser negativo."),
  precio_publico: z.number().int().min(0, "El precio al público no puede ser negativo."),
  precio_mayorista: z.number().int().min(0).nullable(),
  costo_compra: z.number().int().min(0).nullable(),
  stock_minimo: z.number().int().min(0),
  proveedor_id: z.string().uuid().nullable(),
  activo: z.boolean(),
  visible_catalogo: z.boolean(),
  notas: z.string().trim().default(""),
});

function leerFormulario(fd: FormData) {
  const texto = (k: string) => String(fd.get(k) ?? "");
  const entero = (k: string, porDefecto = 0) => leerPesos(texto(k)) ?? porDefecto;
  const opcional = (k: string) => (texto(k).trim() === "" ? null : leerPesos(texto(k)));
  return esquemaProducto.safeParse({
    codigo: normalizarCodigo(texto("codigo")),
    nombre: texto("nombre"),
    categoria: texto("categoria") as CategoriaProducto,
    subcategoria: texto("subcategoria"),
    material: texto("material"),
    color: texto("color"),
    precio_base: entero("precio_base"),
    precio_publico: entero("precio_publico"),
    precio_mayorista: opcional("precio_mayorista"),
    costo_compra: opcional("costo_compra"),
    stock_minimo: entero("stock_minimo", 2),
    proveedor_id: texto("proveedor_id") || null,
    activo: fd.get("activo") !== "false",
    visible_catalogo: fd.get("visible_catalogo") === "on",
    notas: texto("notas"),
  });
}

function primerError(r: z.ZodSafeParseError<unknown>): string {
  return r.error.issues[0]?.message ?? "Revisa los datos del formulario.";
}

/** Crea el producto y, si hay stock inicial, registra la entrada correspondiente. */
export async function crearProducto(_estado: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const datos = leerFormulario(fd);
  if (!datos.success) return { error: primerError(datos) };

  // El navegador genera el id de antemano para poder subir las fotos antes de guardar.
  const idPrevio = String(fd.get("id") ?? "");
  const id = /^[0-9a-f-]{36}$/.test(idPrevio) ? idPrevio : undefined;

  const supabase = await clienteServidor();
  const { data: producto, error } = await supabase
    .from("productos")
    .insert({ ...datos.data, ...(id ? { id } : {}), creado_por: sesion.id })
    .select("id")
    .single();
  if (error || !producto) return { error: mensajeDeError(error) };

  const stockInicial = leerPesos(String(fd.get("stock_inicial") ?? "")) ?? 0;
  if (stockInicial > 0) {
    const { error: e2 } = await supabase.from("movimientos_inventario").insert({
      tipo: "entrada_compra",
      producto_id: producto.id,
      cantidad: stockInicial,
      valor_unitario: datos.data.costo_compra ?? datos.data.precio_base,
      nota: "Inventario inicial",
      registrado_por: sesion.id,
    });
    if (e2) return { error: `El producto se creó, pero no se pudo registrar el inventario inicial: ${mensajeDeError(e2)}` };
  }

  // Fotos subidas desde el navegador antes de guardar (rutas en el bucket).
  const fotos = fd.getAll("foto_ruta").map(String).filter(Boolean);
  const miniaturas = fd.getAll("foto_miniatura").map(String);
  if (fotos.length) {
    const { error: e3 } = await supabase.from("producto_fotos").insert(
      fotos.map((ruta, i) => ({
        producto_id: producto.id,
        ruta,
        ruta_miniatura: miniaturas[i] ?? ruta,
        principal: i === 0,
        orden: i,
        creado_por: sesion.id,
      })),
    );
    if (e3) return { error: `El producto se creó, pero no se pudieron guardar las fotos: ${mensajeDeError(e3)}` };
  }

  revalidatePath("/productos");
  revalidatePath("/");
  const seguir = fd.get("seguir") === "si";
  redirect(seguir ? `/productos/nuevo?creado=${encodeURIComponent(datos.data.codigo)}` : `/productos/${producto.id}`);
}

export async function editarProducto(_estado: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión venció. Vuelve a entrar." };
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Falta el identificador del producto." };
  const datos = leerFormulario(fd);
  if (!datos.success) return { error: primerError(datos) };

  const supabase = await clienteServidor();
  const { error } = await supabase.from("productos").update(datos.data).eq("id", id);
  if (error) return { error: mensajeDeError(error) };

  const fotos = fd.getAll("foto_ruta").map(String).filter(Boolean);
  const miniaturas = fd.getAll("foto_miniatura").map(String);
  if (fotos.length) {
    const { count } = await supabase.from("producto_fotos").select("id", { count: "exact", head: true }).eq("producto_id", id);
    const base = count ?? 0;
    const { error: e3 } = await supabase.from("producto_fotos").insert(
      fotos.map((ruta, i) => ({
        producto_id: id,
        ruta,
        ruta_miniatura: miniaturas[i] ?? ruta,
        principal: base === 0 && i === 0,
        orden: base + i,
        creado_por: sesion.id,
      })),
    );
    if (e3) return { error: `Se guardaron los datos, pero no las fotos nuevas: ${mensajeDeError(e3)}` };
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  revalidatePath("/");
  redirect(`/productos/${id}`);
}

export async function enviarProductoAPapelera(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("productos").update({ eliminado_en: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/productos/${id}?error=${encodeURIComponent(mensajeDeError(error))}`);
  revalidatePath("/productos");
  revalidatePath("/papelera");
  redirect("/productos?aviso=" + encodeURIComponent("Producto enviado a la papelera. Puedes restaurarlo durante 30 días."));
}

export async function marcarFotoPrincipal(fd: FormData) {
  const id = String(fd.get("foto_id") ?? "");
  const productoId = String(fd.get("producto_id") ?? "");
  const supabase = await clienteServidor();
  await supabase.from("producto_fotos").update({ principal: false }).eq("producto_id", productoId);
  await supabase.from("producto_fotos").update({ principal: true }).eq("id", id);
  revalidatePath(`/productos/${productoId}`);
  revalidatePath("/productos");
}

export async function borrarFoto(fd: FormData) {
  const id = String(fd.get("foto_id") ?? "");
  const productoId = String(fd.get("producto_id") ?? "");
  const supabase = await clienteServidor();
  const { data: foto } = await supabase.from("producto_fotos").select("*").eq("id", id).maybeSingle();
  if (!foto) return;
  await supabase.storage.from("fotos").remove([foto.ruta, foto.ruta_miniatura]);
  await supabase.from("producto_fotos").delete().eq("id", id);
  if (foto.principal) {
    const { data: otra } = await supabase.from("producto_fotos").select("id").eq("producto_id", productoId).order("orden").limit(1).maybeSingle();
    if (otra) await supabase.from("producto_fotos").update({ principal: true }).eq("id", otra.id);
  }
  revalidatePath(`/productos/${productoId}`);
  revalidatePath("/productos");
}

/** Siguiente código libre para un prefijo (lo consulta el formulario al cambiar de categoría). */
export async function siguienteCodigoLibre(prefijo: string): Promise<string> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("siguiente_codigo", { prefijo: normalizarCodigo(prefijo) || "SLA" });
  return data ?? `${prefijo}001`;
}
