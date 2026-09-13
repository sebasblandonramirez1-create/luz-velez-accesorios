import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { BotonCopiar } from "@/components/copiar";
import { fecha, fechaHora, pesos } from "@/lib/formato";
import { MEDIOS_PAGO } from "@/lib/tipos";
import { enlaceWhatsApp, numeroDocumento, textoRecordatorioSaldo } from "@/lib/ventas";
import { FormularioAbono } from "../formulario-abono";
import { anularAbono } from "../acciones";

export default async function PaginaCuentasContacto({ params, searchParams }: PageProps<"/cuentas/[contactoId]">) {
  const { contactoId } = await params;
  const sp = await searchParams;
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();

  const [{ data: contacto }, { data: cuentas }, { data: ajustes }] = await Promise.all([
    supabase.from("contactos").select("id, nombre, telefono").eq("id", contactoId).maybeSingle(),
    supabase.from("cuentas_por_cobrar").select("*, abonos(id, fecha, valor, medio_pago, nota, eliminado_en)").eq("contacto_id", contactoId).is("eliminado_en", null).order("fecha", { ascending: false }),
    supabase.from("ajustes").select("nombre_negocio").eq("id", 1).single(),
  ]);
  if (!contacto) notFound();

  // Descripción legible de cada cuenta (venta o consignación).
  const ventasIds = (cuentas ?? []).filter((c) => c.origen_tipo === "venta").map((c) => c.origen_id);
  const consIds = (cuentas ?? []).filter((c) => c.origen_tipo === "consignacion").map((c) => c.origen_id);
  const [{ data: ventas }, { data: consignaciones }] = await Promise.all([
    ventasIds.length ? supabase.from("ventas").select("id, numero, fecha").in("id", ventasIds) : Promise.resolve({ data: [] as { id: string; numero: number; fecha: string }[] }),
    consIds.length ? supabase.from("consignaciones").select("id, numero, fecha_entrega").in("id", consIds) : Promise.resolve({ data: [] as { id: string; numero: number; fecha_entrega: string }[] }),
  ]);
  const describir = (c: { origen_tipo: string; origen_id: string }) => {
    if (c.origen_tipo === "venta") {
      const v = (ventas ?? []).find((x) => x.id === c.origen_id);
      return { texto: v ? `Venta ${numeroDocumento("V", v.numero)} del ${fecha(v.fecha)}` : "Venta", href: `/ventas/${c.origen_id}` };
    }
    const k = (consignaciones ?? []).find((x) => x.id === c.origen_id);
    return { texto: k ? `Consignación ${numeroDocumento("C", k.numero)} del ${fecha(k.fecha_entrega)}` : "Consignación", href: `/consignaciones/${c.origen_id}` };
  };

  const abiertas = (cuentas ?? []).filter((c) => c.saldo > 0);
  const saldo = abiertas.reduce((s, c) => s + c.saldo, 0);
  const negocio = ajustes?.nombre_negocio ?? "Luz Vélez Accesorios";
  const recordatorio = textoRecordatorioSaldo(negocio, contacto.nombre, saldo, abiertas.map((c) => ({ descripcion: describir(c).texto, saldo: c.saldo })));
  const volver = `/cuentas/${contactoId}`;

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={contacto.nombre}
        subtitulo={saldo > 0 ? `Debe ${pesos(saldo)}` : "Al día"}
        volver="/cuentas"
        acciones={
          saldo > 0 ? (
            <a href={enlaceWhatsApp(contacto.telefono, recordatorio)} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-exito px-5 font-semibold text-white">
              Recordar por WhatsApp
            </a>
          ) : undefined
        }
      />
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      {(cuentas ?? []).map((c) => {
        const d = describir(c);
        const abonos = ((c.abonos as unknown as { id: string; fecha: string; valor: number; medio_pago: keyof typeof MEDIOS_PAGO; nota: string; eliminado_en: string | null }[]) ?? []).filter((a) => !a.eliminado_en);
        return (
          <Tarjeta key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={d.href} className="font-semibold text-primario hover:underline">
                {d.texto}
              </Link>
              <span>
                {c.saldo > 0 ? <Etiqueta tono="alerta">Saldo {pesos(c.saldo)}</Etiqueta> : <Etiqueta tono="exito">Pagada</Etiqueta>}
              </span>
            </div>
            <p className="mt-1 text-sm text-texto-suave">
              Total {pesos(c.valor_total)} · abonado {pesos(c.abonado)}
            </p>
            {abonos.length > 0 && (
              <ul className="mt-2 divide-y divide-borde text-sm">
                {abonos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>
                      {fechaHora(a.fecha)} · {MEDIOS_PAGO[a.medio_pago]}
                      {a.nota ? ` · ${a.nota}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{pesos(a.valor)}</span>
                      {sesion.perfil.rol === "propietaria" && (
                        <BotonConfirmar accion={anularAbono} campos={{ id: a.id, volver }} titulo="¿Anular este abono?" texto="El saldo volverá a subir. Podrás restaurarlo desde la papelera." confirmar="Sí, anular" className="!min-h-8 !px-2 text-xs">
                          Anular
                        </BotonConfirmar>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {c.saldo > 0 && (
              <div className="mt-3">
                <FormularioAbono cuentaId={c.id} saldo={c.saldo} volver={volver} />
              </div>
            )}
          </Tarjeta>
        );
      })}
      {(cuentas ?? []).length === 0 && <p className="text-texto-suave">Este contacto no tiene cuentas.</p>}

      {saldo > 0 && (
        <Tarjeta titulo="Recordatorio para WhatsApp">
          <pre className="whitespace-pre-wrap rounded-xl bg-fondo p-3 text-sm">{recordatorio}</pre>
          <div className="mt-2">
            <BotonCopiar texto={recordatorio} />
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
