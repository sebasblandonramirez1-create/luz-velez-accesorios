"use client";

import { useActionState } from "react";
import { Aviso, Campo, Selector, BotonEnviar } from "@/components/ui";
import { invitarUsuaria, type EstadoAjustes } from "../acciones";

export function FormularioInvitar() {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(invitarUsuaria, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.exito && <Aviso tipo="exito">{estado.exito}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Nombre" name="nombre" required />
        <Campo etiqueta="Correo" name="correo" type="email" inputMode="email" required />
        <Selector etiqueta="Rol" name="rol" defaultValue="ayudante" ayuda="La propietaria puede todo, incluida la contabilidad.">
          <option value="ayudante">Ayudante</option>
          <option value="propietaria">Propietaria</option>
        </Selector>
      </div>
      <BotonEnviar grande={false} className="sm:w-auto" cargando="Creando invitación…">
        Invitar
      </BotonEnviar>
    </form>
  );
}
