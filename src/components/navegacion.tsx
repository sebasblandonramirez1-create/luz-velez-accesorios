"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", texto: "Inicio", icono: "⌂" },
  { href: "/ventas", texto: "Ventas", icono: "▣" },
  { href: "/consignaciones", texto: "Consignación", icono: "⇄" },
  { href: "/productos", texto: "Productos", icono: "◈" },
  { href: "/ajustes", texto: "Más", icono: "⋯" },
];

/** Enlaces secundarios, solo en el menú lateral (en el celular viven en «Más»). */
const SECUNDARIOS = [
  { href: "/inventario", texto: "Inventario", icono: "☰" },
  { href: "/contactos", texto: "Contactos", icono: "☺" },
  { href: "/cuentas", texto: "Cuentas por cobrar", icono: "$" },
];

/** Contabilidad: solo la propietaria. */
const CONTABILIDAD = [
  { href: "/compras", texto: "Compras", icono: "⇩" },
  { href: "/gastos", texto: "Gastos", icono: "−" },
  { href: "/caja", texto: "Caja del día", icono: "▤" },
  { href: "/reportes", texto: "Reportes", icono: "≣" },
];

function activo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/ajustes") return pathname.startsWith("/ajustes") || [...SECUNDARIOS, ...CONTABILIDAD].some((s) => pathname.startsWith(s.href));
  return pathname.startsWith(href);
}

/** Barra inferior en pantallas pequeñas. */
export function BarraInferior() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="no-imprimir fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-superficie/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {ENLACES.map((e) => {
          const esActivo = activo(pathname, e.href);
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={esActivo ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  esActivo ? "text-primario" : "text-texto-suave"
                }`}
              >
                <span aria-hidden className="text-2xl leading-none">
                  {e.icono}
                </span>
                {e.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Menú lateral en pantallas grandes. */
export function MenuLateral({ nombreNegocio, nombreUsuaria, rol }: { nombreNegocio: string; nombreUsuaria: string; rol: string }) {
  const pathname = usePathname();
  return (
    <aside className="no-imprimir hidden w-64 shrink-0 flex-col border-r border-borde bg-superficie md:flex">
      <div className="border-b border-borde p-5">
        <div className="text-lg font-bold leading-tight">{nombreNegocio}</div>
        <div className="mt-1 text-sm text-texto-suave">
          {nombreUsuaria} · {rol === "propietaria" ? "Propietaria" : "Ayudante"}
        </div>
      </div>
      <nav aria-label="Principal" className="flex-1 p-3">
        <ul className="space-y-1">
          {[...ENLACES.slice(0, 4), ...SECUNDARIOS, ...(rol === "propietaria" ? CONTABILIDAD : []), ENLACES[4]].map((e) => {
            const esActivo = e.href === "/ajustes" ? pathname.startsWith("/ajustes") : activo(pathname, e.href);
            return (
              <li key={e.href}>
                <Link
                  href={e.href}
                  aria-current={esActivo ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-4 font-semibold ${
                    esActivo ? "bg-primario-claro text-primario-oscuro" : "text-texto hover:bg-fondo"
                  }`}
                >
                  <span aria-hidden className="w-6 text-center text-xl">
                    {e.icono}
                  </span>
                  {e.texto === "Más" ? "Ajustes" : e.texto}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <form action="/auth/salir" method="post" className="border-t border-borde p-3">
        <button type="submit" className="min-h-12 w-full rounded-xl px-4 text-left font-semibold text-texto-suave hover:bg-fondo">
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
