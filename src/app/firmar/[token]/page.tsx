import type { Metadata } from "next";
import { Marca } from "@/components/marca";
import { ReciboConsignacion } from "@/components/recibo-consignacion";
import { BotonesPdfRecibo } from "@/components/compartir-recibo";
import { BotonImprimir } from "@/components/copiar";
import { Aviso } from "@/components/ui";
import { clienteAnonimo } from "@/lib/supabase/anonimo";
import { fecha, fechaHora } from "@/lib/formato";
import { codigoVerificacion, quienRecibe, type DatosRecibo } from "@/lib/recibo";
import { numeroDocumento } from "@/lib/ventas";
import { FormularioFirma } from "./formulario-firma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recibo de entrega en consignación", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Respuesta = (DatosRecibo & { estado: "pendiente" | "firmado" }) | { estado: "vencido"; negocio: DatosRecibo["negocio"] } | null;

async function cargar(token: string): Promise<Respuesta | "error"> {
  if (!UUID.test(token)) return null;
  try {
    const { data, error } = await clienteAnonimo().rpc("recibo_para_firmar", { p_token: token });
    if (error) return "error";
    return (data as unknown as Respuesta) ?? null;
  } catch {
    return "error";
  }
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-fondo print:bg-white">
      <header className="acuarela no-imprimir border-b border-borde px-4 py-5 text-center">
        <Marca tamano="md" />
      </header>
      <div className="mx-auto max-w-3xl space-y-4 p-4 print:max-w-none print:p-0">{children}</div>
    </main>
  );
}

/**
 * Página pública del recibo. Quien recibe la mercancía entra con el enlace que
 * le envían por WhatsApp o correo, revisa el recibo, completa sus datos y firma
 * con el dedo. Después de firmar, el mismo enlace muestra el recibo firmado.
 */
export default async function PaginaFirmar({ params }: PageProps<"/firmar/[token]">) {
  const { token } = await params;
  const r = await cargar(token);

  if (r === "error") {
    return (
      <Marco>
        <Aviso tipo="alerta">No se pudo cargar el recibo en este momento. Revisa el internet y vuelve a abrir el enlace en unos minutos.</Aviso>
      </Marco>
    );
  }
  if (!r) {
    return (
      <Marco>
        <Aviso tipo="error">Este enlace no es válido o la entrega fue anulada. Pide a quien te lo envió que lo genere de nuevo.</Aviso>
      </Marco>
    );
  }
  if (r.estado === "vencido") {
    return (
      <Marco>
        <Aviso tipo="alerta">
          El enlace para firmar venció. Escribe a {r.negocio.nombre}
          {r.negocio.telefono ? ` (${r.negocio.telefono})` : ""} para que te envíe uno nuevo.
        </Aviso>
      </Marco>
    );
  }

  const numero = numeroDocumento("C", r.consignacion.numero);
  const primerNombre = r.contacto.nombre.trim().split(/\s+/)[0] || "";

  if (r.estado === "firmado" && r.firma) {
    return (
      <Marco>
        <div className="no-imprimir space-y-3">
          <Aviso tipo="exito">
            <p className="font-semibold">Recibo {numero} firmado.</p>
            <p>
              Firmado el {fechaHora(r.firma.firmado_en)}. Código de verificación {codigoVerificacion(r.firma.huella)}. Guarda una copia: este enlace sigue mostrando el recibo firmado.
            </p>
          </Aviso>
          <div className="flex flex-wrap gap-2">
            <BotonesPdfRecibo datos={r} />
            <BotonImprimir etiqueta="Imprimir" />
          </div>
        </div>
        <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <ReciboConsignacion datos={r} />
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <div className="no-imprimir">
        <h1 className="text-2xl font-bold">
          {primerNombre ? `Hola, ${primerNombre}` : "Hola"}
        </h1>
        <p className="mt-1 text-texto-suave">
          {r.negocio.nombre} te entregó mercancía en consignación el {fecha(r.consignacion.fecha_entrega)}. Revisa el recibo {numero}, completa tus datos y fírmalo aquí mismo.
          {r.vence ? ` El enlace sirve hasta el ${fecha(r.vence)}.` : ""}
        </p>
      </div>
      <div className="rounded-2xl border border-borde bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <ReciboConsignacion datos={r} />
      </div>
      <section className="no-imprimir rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Tus datos y tu firma</h2>
        <FormularioFirma token={token} inicial={quienRecibe(r)} />
      </section>
      <p className="no-imprimir pb-6 text-center text-sm text-texto-suave">
        ¿Algo no coincide con lo que recibiste? No firmes y escribe a {r.negocio.nombre}
        {r.negocio.telefono ? ` al ${r.negocio.telefono}` : ""}.
      </p>
    </Marco>
  );
}
