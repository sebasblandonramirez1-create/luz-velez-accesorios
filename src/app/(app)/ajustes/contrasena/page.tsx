import { Encabezado, Tarjeta } from "@/components/ui";
import { FormularioContrasena } from "./formulario";

export const metadata = { title: "Cambiar contraseña" };

export default function PaginaContrasena() {
  return (
    <div className="space-y-4">
      <Encabezado titulo="Cambiar contraseña" volver="/ajustes" />
      <Tarjeta>
        <FormularioContrasena />
      </Tarjeta>
    </div>
  );
}
