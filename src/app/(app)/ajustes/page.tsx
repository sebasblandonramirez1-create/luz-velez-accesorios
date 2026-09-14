import Link from "next/link";
import { clienteServidor, sesionActual } from "@/lib/supabase/servidor";
import { Encabezado, Tarjeta } from "@/components/ui";
import { FormulariosAjustes, FormularioPerfil } from "./formularios";
import { TamanoLetra } from "./tamano-letra";

export const metadata = { title: "Ajustes" };

export default async function PaginaAjustes() {
  const sesion = (await sesionActual())!;
  const supabase = await clienteServidor();
  const { data: ajustes } = await supabase.from("ajustes").select("*").eq("id", 1).single();
  if (!ajustes) throw new Error("No se pudieron cargar los ajustes.");
  const esPropietaria = sesion.perfil.rol === "propietaria";
  const urlApp = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-4">
      <Encabezado titulo="Ajustes" subtitulo={`${sesion.perfil.nombre || sesion.correo} · ${esPropietaria ? "Propietaria" : "Ayudante"}`} />

      <nav aria-label="Secciones" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["/inventario", "☰ Inventario", true],
          ["/contactos", "☺ Contactos", true],
          ["/cuentas", "$ Cuentas por cobrar", true],
          ["/compras", "⇩ Compras", esPropietaria],
          ["/gastos", "− Gastos", esPropietaria],
          ["/caja", "▤ Caja del día", esPropietaria],
          ["/reportes", "≣ Reportes", esPropietaria],
          ["/ajustes/usuarios", "👥 Usuarias", esPropietaria],
          ["/ajustes/respaldos", "💾 Copias de seguridad", esPropietaria],
          ["/ajustes/papelera", "🗑️ Papelera", esPropietaria],
          ["/ajustes/contrasena", "🔑 Contraseña", true],
          ["/ajustes/ayuda", "📖 Ayuda", true],
        ]
          .filter(([, , ver]) => ver)
          .map(([href, texto]) => (
            <Link key={String(href)} href={String(href)} className="flex min-h-14 items-center justify-center rounded-xl border border-borde bg-superficie px-3 text-center font-semibold hover:bg-primario-claro">
              {texto}
            </Link>
          ))}
      </nav>

      <Tarjeta titulo="Tu cuenta">
        <FormularioPerfil nombre={sesion.perfil.nombre} correo={sesion.correo} />
      </Tarjeta>

      <Tarjeta titulo="Tamaño de letra">
        <TamanoLetra />
      </Tarjeta>

      {esPropietaria ? (
        <FormulariosAjustes ajustes={ajustes} urlApp={urlApp} />
      ) : (
        <Tarjeta>
          <p className="text-texto-suave">Los ajustes del negocio (precios, etiqueta, catálogo, respaldos) solo los cambia la propietaria.</p>
        </Tarjeta>
      )}

      <form action="/auth/salir" method="post" className="md:hidden">
        <button type="submit" className="min-h-12 w-full rounded-xl border border-borde bg-superficie font-semibold text-texto-suave">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
