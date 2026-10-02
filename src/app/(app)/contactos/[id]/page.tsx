import { notFound } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { ESTADOS_CONSIGNACION, TIPOS_CONTACTO } from "@/lib/tipos";
import { fecha, pesos } from "@/lib/formato";
import { numeroDocumento } from "@/lib/ventas";
import Link from "next/link";
import { FormularioContacto } from "../formulario-contacto";
import { enviarContactoAPapelera } from "../acciones";

export default async function PaginaContacto({ params }: PageProps<"/contactos/[id]">) {
  const { id } = await params;
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();
  const { data: contacto } = await supabase.from("contactos").select("*").eq("id", id).is("eliminado_en", null).maybeSingle();
  if (!contacto) notFound();
  const [{ data: consignaciones }, { data: ventas }, { data: saldo }] = await Promise.all([
    supabase.from("consignaciones").select("id, numero, fecha_entrega, estado, total_entregado, total_vendido, total_pendiente").eq("contacto_id", id).is("eliminado_en", null).order("fecha_entrega", { ascending: false }).limit(20),
    supabase.from("ventas").select("id, numero, fecha, total").eq("contacto_id", id).is("eliminado_en", null).order("fecha", { ascending: false }).limit(10),
    supabase.from("saldos_por_contacto").select("saldo, dias").eq("contacto_id", id).maybeSingle(),
  ]);

  const enlaceWhatsApp = contacto.telefono ? `https://wa.me/57${contacto.telefono.replace(/\D/g, "").replace(/^57/, "")}` : null;

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={contacto.nombre}
        subtitulo={`${TIPOS_CONTACTO[contacto.tipo]} · desde ${fecha(contacto.creado_en)}`}
        volver="/contactos"
        acciones={
          enlaceWhatsApp ? (
            <a href={enlaceWhatsApp} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-exito px-5 font-semibold text-white">
              WhatsApp
            </a>
          ) : undefined
        }
      />
      {(contacto.documento || contacto.correo || contacto.direccion || contacto.ciudad || contacto.telefono) && (
        <p className="text-sm text-texto-suave">
          {[contacto.documento && `C.C. / NIT ${contacto.documento}`, contacto.telefono, contacto.correo, [contacto.direccion, contacto.ciudad].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-borde bg-superficie p-3">
          <p className="text-xs text-texto-suave">Saldo por cobrar</p>
          <p className={`text-xl font-bold ${saldo?.saldo ? "text-alerta" : ""}`}>{pesos(saldo?.saldo ?? 0)}</p>
          {saldo?.saldo ? (
            <Link href={`/cuentas/${contacto.id}`} className="text-xs font-semibold text-primario">
              Ver cuentas y abonar
            </Link>
          ) : null}
        </div>
        <div className="rounded-2xl border border-borde bg-superficie p-3">
          <p className="text-xs text-texto-suave">Consignaciones</p>
          <p className="text-xl font-bold">{consignaciones?.length ?? 0}</p>
          <Link href={`/consignaciones/nueva?contacto=${contacto.id}`} className="text-xs font-semibold text-primario">
            Nueva entrega
          </Link>
        </div>
        <div className="rounded-2xl border border-borde bg-superficie p-3">
          <p className="text-xs text-texto-suave">Ventas directas</p>
          <p className="text-xl font-bold">{ventas?.length ?? 0}</p>
        </div>
      </div>

      {consignaciones && consignaciones.length > 0 && (
        <Tarjeta titulo="Histórico de consignaciones">
          <ul className="divide-y divide-borde">
            {consignaciones.map((c) => (
              <li key={c.id}>
                <Link href={`/consignaciones/${c.id}`} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="block font-semibold">
                      {numeroDocumento("C", c.numero)} · {fecha(c.fecha_entrega)}
                    </span>
                    <span className="block text-sm text-texto-suave">
                      Entregado {pesos(c.total_entregado)} · vendido {pesos(c.total_vendido)} · pendiente {pesos(c.total_pendiente)}
                    </span>
                  </span>
                  <Etiqueta tono={c.estado === "cerrada" ? "neutro" : c.estado === "parcial" ? "primario" : "alerta"}>{ESTADOS_CONSIGNACION[c.estado]}</Etiqueta>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      {ventas && ventas.length > 0 && (
        <Tarjeta titulo="Ventas directas">
          <ul className="divide-y divide-borde">
            {ventas.map((v) => (
              <li key={v.id}>
                <Link href={`/ventas/${v.id}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-semibold">
                    {numeroDocumento("V", v.numero)} · {fecha(v.fecha)}
                  </span>
                  <span className="font-bold">{pesos(v.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      <h2 className="text-lg font-bold">Editar datos</h2>
      <FormularioContacto contacto={contacto} />
      {sesion.perfil.rol === "propietaria" && (
        <div className="flex justify-end">
          <BotonConfirmar
            accion={enviarContactoAPapelera}
            campos={{ id: contacto.id }}
            titulo="¿Enviar a la papelera?"
            texto="El contacto dejará de aparecer en las listas. Podrás restaurarlo durante 30 días."
            confirmar="Sí, enviar a la papelera"
          >
            Enviar a la papelera
          </BotonConfirmar>
        </div>
      )}
    </div>
  );
}
