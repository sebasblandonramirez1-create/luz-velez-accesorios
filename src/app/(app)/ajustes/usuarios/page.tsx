import { redirect } from "next/navigation";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Aviso, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { fecha } from "@/lib/formato";
import { borrarInvitacion, cambiarRolUsuaria } from "../acciones";
import { FormularioInvitar } from "./invitar";

export const metadata = { title: "Usuarias" };

export default async function PaginaUsuarios({ searchParams }: PageProps<"/ajustes/usuarios">) {
  const sesion = (await sesionActual())!;
  if (sesion.perfil.rol !== "propietaria") redirect("/ajustes");
  const p = await searchParams;
  const aviso = typeof p.aviso === "string" ? p.aviso : null;
  const error = typeof p.error === "string" ? p.error : null;
  const supabase = await clienteServidor();
  const [{ data: perfiles }, { data: invitaciones }] = await Promise.all([
    supabase.from("perfiles").select("*").order("creado_en"),
    supabase.from("invitaciones").select("*").is("usada_en", null).order("creada_en", { ascending: false }),
  ]);
  const urlApp = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-4">
      <Encabezado titulo="Usuarias" volver="/ajustes" subtitulo="Puede haber varias propietarias. La ayudante registra ventas y consulta inventario, pero no borra ni ve contabilidad." />
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta titulo="Cuentas">
        <ul className="divide-y divide-borde">
          {(perfiles ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {u.nombre || u.correo} {u.id === sesion.id && <span className="text-sm font-normal text-texto-suave">(tú)</span>}
                </span>
                <span className="block text-sm text-texto-suave">
                  {u.correo} · desde {fecha(u.creado_en)}
                </span>
              </span>
              <Etiqueta tono={u.activo ? (u.rol === "propietaria" ? "primario" : "neutro") : "peligro"}>
                {!u.activo ? "Desactivada" : u.rol === "propietaria" ? "Propietaria" : "Ayudante"}
              </Etiqueta>
              {u.id !== sesion.id && (
                <form action={cambiarRolUsuaria} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="rol" defaultValue={u.rol} className="campo !min-h-10 w-auto !py-1" aria-label="Rol">
                    <option value="ayudante">Ayudante</option>
                    <option value="propietaria">Propietaria</option>
                  </select>
                  <select name="activo" defaultValue={String(u.activo)} className="campo !min-h-10 w-auto !py-1" aria-label="Estado">
                    <option value="true">Activa</option>
                    <option value="false">Desactivada</option>
                  </select>
                  <button type="submit" className="min-h-10 rounded-lg bg-primario px-3 text-sm font-semibold text-white">
                    Aplicar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Invitar a una persona">
        <FormularioInvitar />
        <p className="mt-3 text-sm text-texto-suave">
          Cómo entra la persona invitada: abre {urlApp || "la app"}, pulsa <strong>«Crear cuenta con invitación»</strong>, escribe el mismo correo y una contraseña, y confirma el correo que le llega. Entrará con el rol que elegiste.
        </p>
      </Tarjeta>

      {invitaciones && invitaciones.length > 0 && (
        <Tarjeta titulo="Invitaciones pendientes">
          <ul className="divide-y divide-borde">
            {invitaciones.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{i.nombre || i.correo}</span>
                  <span className="block text-sm text-texto-suave">
                    {i.correo} · creada el {fecha(i.creada_en)}
                  </span>
                </span>
                <Etiqueta tono={i.rol === "propietaria" ? "primario" : "neutro"}>{i.rol === "propietaria" ? "Propietaria" : "Ayudante"}</Etiqueta>
                <form action={borrarInvitacion}>
                  <input type="hidden" name="id" value={i.id} />
                  <button type="submit" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-peligro hover:bg-peligro-claro">
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
