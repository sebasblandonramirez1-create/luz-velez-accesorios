"use client";

import { useActionState } from "react";
import { Aviso, Campo, BotonEnviar } from "@/components/ui";
import { invitarUsuaria, type EstadoAjustes } from "../acciones";

export function FormularioInvitar() {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(invitarUsuaria, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.exito && <Aviso tipo="exito">{estado.exito}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" required />
        <Campo etiqueta="Correo" name="correo" type="email" inputMode="email" required />
      </div>
      <p className="text-sm text-texto-suave">Recibirá un correo con un enlace para crear su contraseña. Entra como ayudante.</p>
      <BotonEnviar grande={false} className="sm:w-auto" cargando="Enviando…">
        Enviar invitación
      </BotonEnviar>
    </form>
  );
}
