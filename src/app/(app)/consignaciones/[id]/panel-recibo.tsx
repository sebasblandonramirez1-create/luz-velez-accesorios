"use client";

import { Aviso, BotonEnlace, Etiqueta } from "@/components/ui";
import { BotonConfirmar } from "@/components/confirmar";
import { BotonCopiar } from "@/components/copiar";
import { BotonEnviar } from "@/components/boton-enviar";
import { BotonesPdfRecibo } from "@/components/compartir-recibo";
import { fecha, fechaHora } from "@/lib/formato";
import { codigoVerificacion, enlacesParaCompartir, quienRecibe, type DatosRecibo } from "@/lib/recibo";
import { anularFirmaConsignacion, pedirFirmaConsignacion } from "../acciones";

const claseEnlace = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold";

/**
 * Todo lo que se puede hacer con el recibo de entrega: imprimirlo, compartirlo
 * como PDF, enviarlo por WhatsApp o correo y pedir la firma electrónica.
 */
export function PanelRecibo({ datos, enlaceFirma, esPropietaria }: { datos: DatosRecibo; enlaceFirma: string | null; esPropietaria: boolean }) {
  const id = datos.consignacion.id;
  const persona = quienRecibe(datos);
  const firmado = Boolean(datos.firma);
  const vigente = datos.estado === "pendiente" && enlaceFirma;
  const compartir = enlacesParaCompartir(datos, vigente || firmado ? (enlaceFirma ?? undefined) : undefined);
  const faltan = [!persona.documento && "cédula", !persona.direccion && "dirección", !persona.ciudad && "ciudad"].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <BotonEnlace href={`/imprimir/consignaciones/${id}?hoja=entrega`} variante="secundario">
          🖨️ Imprimir recibo
        </BotonEnlace>
        <BotonesPdfRecibo datos={datos} texto={compartir.texto} />
        <a href={compartir.whatsapp} target="_blank" rel="noopener" className={`${claseEnlace} bg-exito text-white`}>
          WhatsApp
        </a>
        <a href={compartir.correo} className={`${claseEnlace} border border-borde bg-superficie text-texto hover:bg-primario-claro`}>
          Correo
        </a>
      </div>
      <p className="text-sm text-texto-suave">
        «Compartir PDF» adjunta el archivo del recibo desde el celular. «WhatsApp» y «Correo» envían la relación de piezas como texto{vigente || firmado ? " con el enlace del recibo" : ""}.
      </p>

      <div className="rounded-xl border border-borde bg-fondo p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="font-bold">Firma electrónica</h3>
          {firmado ? <Etiqueta tono="exito">Firmado</Etiqueta> : vigente ? <Etiqueta tono="alerta">Pendiente de firma</Etiqueta> : datos.estado === "vencido" ? <Etiqueta tono="peligro">Enlace vencido</Etiqueta> : <Etiqueta>Sin pedir</Etiqueta>}
        </div>

        {firmado && datos.firma && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- la firma es una imagen incrustada (data URL) */}
              <img src={datos.firma.imagen} alt={`Firma de ${persona.nombre}`} className="h-16 rounded-lg border border-borde bg-white px-2" />
              <p className="text-sm">
                <strong>{persona.nombre}</strong>
                {persona.documento ? ` · C.C. / NIT ${persona.documento}` : ""}
                <br />
                Firmó el {fechaHora(datos.firma.firmado_en)} · Código {codigoVerificacion(datos.firma.huella)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {enlaceFirma && (
                <a href={enlaceFirma} target="_blank" rel="noopener" className={`${claseEnlace} border border-borde bg-superficie text-texto hover:bg-primario-claro`}>
                  Ver recibo firmado
                </a>
              )}
              {enlaceFirma && <BotonCopiar texto={enlaceFirma} etiqueta="Copiar enlace" />}
              {esPropietaria && (
                <BotonConfirmar accion={anularFirmaConsignacion} campos={{ id }} titulo="¿Anular la firma?" texto="Se borran la firma y los datos que escribió quien recibió. El enlace anterior deja de funcionar y podrás pedir la firma de nuevo." confirmar="Sí, anular la firma">
                  Anular firma
                </BotonConfirmar>
              )}
            </div>
          </div>
        )}

        {!firmado && vigente && enlaceFirma && (
          <div className="space-y-2">
            <p className="text-sm">
              Envía este enlace a {persona.nombre.split(" ")[0] || "quien recibe"}. Al abrirlo ve el recibo, completa sus datos y firma con el dedo. Sirve hasta el {fecha(datos.vence)}.
            </p>
            <p className="break-all rounded-lg border border-borde bg-superficie px-3 py-2 font-mono text-xs">{enlaceFirma}</p>
            <div className="flex flex-wrap gap-2">
              <a href={compartir.whatsapp} target="_blank" rel="noopener" className={`${claseEnlace} bg-exito text-white`}>
                Enviar por WhatsApp
              </a>
              <a href={compartir.correo} className={`${claseEnlace} bg-primario text-white`}>
                Enviar por correo
              </a>
              <BotonCopiar texto={enlaceFirma} etiqueta="Copiar enlace" />
              {esPropietaria && (
                <BotonConfirmar accion={anularFirmaConsignacion} campos={{ id }} titulo="¿Anular el enlace?" texto="El enlace enviado deja de funcionar. Podrás generar uno nuevo." confirmar="Sí, anular el enlace">
                  Anular enlace
                </BotonConfirmar>
              )}
            </div>
            {!persona.telefono && <Aviso tipo="alerta">Este contacto no tiene celular guardado: WhatsApp te pedirá elegir a quién enviarlo.</Aviso>}
          </div>
        )}

        {!firmado && !vigente && (
          <form action={pedirFirmaConsignacion} className="space-y-2">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm">
              {datos.estado === "vencido"
                ? "El enlace anterior venció sin firma. Genera uno nuevo para enviarlo."
                : "Genera un enlace para que quien recibe complete sus datos y firme desde su celular, sin instalar nada ni crear cuenta."}
              {faltan.length > 0 ? ` Al firmar llenará lo que falta en su ficha: ${faltan.join(", ")}.` : ""}
            </p>
            <BotonEnviar grande={false} className="sm:w-auto">
              {datos.estado === "vencido" ? "Generar enlace nuevo" : "Pedir firma electrónica"}
            </BotonEnviar>
          </form>
        )}
      </div>
    </div>
  );
}
