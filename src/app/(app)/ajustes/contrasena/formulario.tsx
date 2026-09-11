"use client";

import { useActionState } from "react";
import { Aviso, Campo, BotonEnviar } from "@/components/ui";
import { cambiarContrasena, type EstadoAjustes } from "../acciones";

export function FormularioContrasena() {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(cambiarContrasena, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.exito && <Aviso tipo="exito">{estado.exito}</Aviso>}
      <Campo etiqueta="Nueva contraseña" name="contrasena" type="password" autoComplete="new-password" minLength={8} required ayuda="Mínimo 8 caracteres." />
      <Campo etiqueta="Repite la contraseña" name="confirmar" type="password" autoComplete="new-password" minLength={8} required />
      <BotonEnviar>Cambiar contraseña</BotonEnviar>
    </form>
  );
}
