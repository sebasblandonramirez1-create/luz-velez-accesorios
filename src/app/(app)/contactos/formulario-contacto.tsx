"use client";

import { useActionState } from "react";
import { Aviso, AreaTexto, Campo, Selector, Tarjeta, BotonEnviar, BotonEnlace } from "@/components/ui";
import { TIPOS_CONTACTO, type Contacto } from "@/lib/tipos";
import { guardarContacto, type EstadoContacto } from "./acciones";

export function FormularioContacto({ contacto, volver, tipoInicial }: { contacto?: Contacto; volver?: string; tipoInicial?: string }) {
  const [estado, accion] = useActionState<EstadoContacto, FormData>(guardarContacto, {});
  return (
    <form action={accion} className="space-y-4">
      {contacto && <input type="hidden" name="id" value={contacto.id} />}
      {volver && <input type="hidden" name="volver" value={volver} />}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Tarjeta>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" name="nombre" defaultValue={contacto?.nombre ?? ""} required autoComplete="name" className="sm:col-span-2" />
          <Campo etiqueta="Teléfono" name="telefono" type="tel" inputMode="tel" defaultValue={contacto?.telefono ?? ""} placeholder="300 123 4567" autoComplete="tel" />
          <Selector etiqueta="Tipo" name="tipo" defaultValue={contacto?.tipo ?? tipoInicial ?? "cliente"}>
            {Object.entries(TIPOS_CONTACTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selector>
          <Campo etiqueta="Cédula o NIT (opcional)" name="documento" inputMode="numeric" defaultValue={contacto?.documento ?? ""} ayuda="Aparece en el recibo de consignación." />
          <Campo etiqueta="Correo (opcional)" name="correo" type="email" inputMode="email" defaultValue={contacto?.correo ?? ""} autoComplete="email" />
          <Campo etiqueta="Dirección (opcional)" name="direccion" defaultValue={contacto?.direccion ?? ""} autoComplete="street-address" />
          <Campo etiqueta="Ciudad y barrio (opcional)" name="ciudad" defaultValue={contacto?.ciudad ?? ""} autoComplete="address-level2" />
          <AreaTexto etiqueta="Notas (opcional)" name="notas" defaultValue={contacto?.notas ?? ""} className="sm:col-span-2" />
        </div>
      </Tarjeta>
      <div className="flex flex-col gap-2 sm:flex-row">
        <BotonEnviar>{contacto ? "Guardar cambios" : "Guardar contacto"}</BotonEnviar>
        <BotonEnlace href={volver ?? (contacto ? `/contactos/${contacto.id}` : "/contactos")} variante="fantasma" grande>
          Cancelar
        </BotonEnlace>
      </div>
    </form>
  );
}
