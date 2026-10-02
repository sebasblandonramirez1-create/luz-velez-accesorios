import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsignacionRecibo, Database } from "./tipos";
import type { DatosRecibo, PersonaRecibo } from "./recibo";

/**
 * Arma los datos del recibo de una consignación para las pantallas con sesión
 * (detalle e impresión). Devuelve también la fila del recibo: enlace de firma,
 * vencimiento y, si ya firmaron, la evidencia.
 */
export async function cargarRecibo(supabase: SupabaseClient<Database>, id: string): Promise<{ datos: DatosRecibo; recibo: ConsignacionRecibo | null } | null> {
  const [{ data: c }, { data: lineas }, { data: ajustes }, { data: recibo }, { data: modificaciones }] = await Promise.all([
    supabase.from("consignaciones").select("id, numero, fecha_entrega, fecha_limite, nota, total_entregado, contactos(nombre, telefono, documento, direccion, ciudad, correo)").eq("id", id).is("eliminado_en", null).maybeSingle(),
    supabase.from("consignacion_lineas").select("cantidad_entregada, valor_unitario, creado_en, productos(codigo, nombre)").eq("consignacion_id", id).order("creado_en"),
    supabase.from("ajustes").select("nombre_negocio, telefono_negocio, documento_negocio, direccion_negocio, ciudad_negocio, correo_negocio, consignacion_condiciones").eq("id", 1).single(),
    supabase.from("consignacion_recibos").select("*").eq("consignacion_id", id).maybeSingle(),
    supabase.from("consignacion_modificaciones").select("fecha").eq("consignacion_id", id).order("fecha", { ascending: false }),
  ]);
  if (!c) return null;
  const contacto = c.contactos as unknown as PersonaRecibo;
  const firmado = Boolean(recibo?.firmado_en && recibo.firma_imagen);
  const datos: DatosRecibo = {
    negocio: {
      nombre: ajustes?.nombre_negocio ?? "",
      telefono: ajustes?.telefono_negocio ?? "",
      documento: ajustes?.documento_negocio ?? "",
      direccion: ajustes?.direccion_negocio ?? "",
      ciudad: ajustes?.ciudad_negocio ?? "",
      correo: ajustes?.correo_negocio ?? "",
    },
    condiciones: ajustes?.consignacion_condiciones ?? "",
    consignacion: { id: c.id, numero: c.numero, fecha_entrega: c.fecha_entrega, fecha_limite: c.fecha_limite, nota: c.nota, total_entregado: c.total_entregado },
    contacto,
    lineas: (lineas ?? []).map((l) => {
      const p = l.productos as unknown as { codigo: string; nombre: string };
      return { codigo: p.codigo, nombre: p.nombre, cantidad: l.cantidad_entregada, valor_unitario: l.valor_unitario };
    }),
    receptor: firmado
      ? {
          nombre: recibo!.receptor_nombre,
          documento: recibo!.receptor_documento,
          telefono: recibo!.receptor_telefono,
          direccion: recibo!.receptor_direccion,
          ciudad: recibo!.receptor_ciudad,
          correo: recibo!.receptor_correo,
        }
      : null,
    firma: firmado ? { imagen: recibo!.firma_imagen!, firmado_en: recibo!.firmado_en!, huella: recibo!.firma_huella } : null,
    estado: firmado ? "firmado" : recibo ? (new Date(recibo.token_vence) < new Date() ? "vencido" : "pendiente") : undefined,
    vence: recibo?.token_vence,
    modificaciones: { cantidad: modificaciones?.length ?? 0, ultima: modificaciones?.[0]?.fecha ?? null },
  };
  return { datos, recibo: recibo ?? null };
}

/** Dirección pública de la app, para armar el enlace de firma. */
export async function urlDeLaApp(): Promise<string> {
  const fija = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const h = await headers();
  const anfitrion = h.get("x-forwarded-host") ?? h.get("host");
  // En desarrollo y en vistas previas manda la dirección real de la petición.
  if (anfitrion && (!fija || /localhost|127\.0\.0\.1/.test(anfitrion))) {
    const protocolo = h.get("x-forwarded-proto") ?? (/localhost|127\.0\.0\.1/.test(anfitrion) ? "http" : "https");
    return `${protocolo}://${anfitrion}`;
  }
  return fija ?? "";
}
