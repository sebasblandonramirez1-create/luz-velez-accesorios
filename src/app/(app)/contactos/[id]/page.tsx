import { notFound } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { TIPOS_CONTACTO } from "@/lib/tipos";
import { fecha } from "@/lib/formato";
import { FormularioContacto } from "../formulario-contacto";
import { enviarContactoAPapelera } from "../acciones";

export default async function PaginaContacto({ params }: PageProps<"/contactos/[id]">) {
  const { id } = await params;
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();
  const { data: contacto } = await supabase.from("contactos").select("*").eq("id", id).is("eliminado_en", null).maybeSingle();
  if (!contacto) notFound();

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
      <Tarjeta titulo="Consignaciones y saldo">
        <p className="text-texto-suave">
          El histórico de entregas y el saldo por cobrar de este contacto estarán disponibles en la Fase 2. <Etiqueta>Próximamente</Etiqueta>
        </p>
      </Tarjeta>
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
