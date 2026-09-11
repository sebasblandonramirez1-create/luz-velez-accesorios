import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/* ---------------------------------------------------------------------------
 * Componentes básicos de interfaz: botones grandes, campos con etiqueta,
 * tarjetas, avisos. Sin dependencias externas.
 * ------------------------------------------------------------------------- */

type Variante = "primario" | "secundario" | "peligro" | "fantasma" | "acento";

const estilosBoton: Record<Variante, string> = {
  primario: "bg-primario text-white hover:bg-primario-oscuro shadow-sm",
  secundario: "bg-superficie text-texto border border-borde hover:bg-primario-claro",
  peligro: "bg-peligro text-white hover:brightness-90",
  fantasma: "bg-transparent text-primario hover:bg-primario-claro",
  acento: "bg-acento text-white hover:brightness-95 shadow-sm",
};

const baseBoton =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 font-semibold text-base transition disabled:opacity-50 disabled:cursor-not-allowed select-none";

export function Boton({
  variante = "primario",
  grande = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; grande?: boolean }) {
  return (
    <button
      type="button"
      className={`${baseBoton} ${estilosBoton[variante]} ${grande ? "min-h-14 text-lg" : "min-h-12"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function BotonEnlace({
  href,
  variante = "primario",
  grande = false,
  className = "",
  children,
}: {
  href: string;
  variante?: Variante;
  grande?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${baseBoton} ${estilosBoton[variante]} ${grande ? "min-h-14 text-lg" : "min-h-12"} ${className}`}>
      {children}
    </Link>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; error?: string }) {
  const idFinal = id ?? props.name;
  return (
    <label className={`block ${className}`} htmlFor={idFinal}>
      <span className="mb-1.5 block text-sm font-semibold text-texto">{etiqueta}</span>
      <input id={idFinal} className="campo" aria-invalid={Boolean(error)} {...props} />
      {ayuda && !error && <span className="mt-1 block text-sm text-texto-suave">{ayuda}</span>}
      {error && <span className="mt-1 block text-sm text-peligro">{error}</span>}
    </label>
  );
}

export function Selector({
  etiqueta,
  ayuda,
  id,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; ayuda?: string }) {
  const idFinal = id ?? props.name;
  return (
    <label className={`block ${className}`} htmlFor={idFinal}>
      <span className="mb-1.5 block text-sm font-semibold text-texto">{etiqueta}</span>
      <select id={idFinal} className="campo" {...props}>
        {children}
      </select>
      {ayuda && <span className="mt-1 block text-sm text-texto-suave">{ayuda}</span>}
    </label>
  );
}

export function AreaTexto({
  etiqueta,
  ayuda,
  id,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string; ayuda?: string }) {
  const idFinal = id ?? props.name;
  return (
    <label className={`block ${className}`} htmlFor={idFinal}>
      <span className="mb-1.5 block text-sm font-semibold text-texto">{etiqueta}</span>
      <textarea id={idFinal} className="campo" rows={3} {...props} />
      {ayuda && <span className="mt-1 block text-sm text-texto-suave">{ayuda}</span>}
    </label>
  );
}

export function Casilla({
  etiqueta,
  ayuda,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string }) {
  const idFinal = id ?? props.name;
  return (
    <label className="flex items-start gap-3 rounded-xl border border-borde bg-superficie p-3" htmlFor={idFinal}>
      <input id={idFinal} type="checkbox" className="mt-1 h-5 w-5 accent-primario" {...props} />
      <span>
        <span className="block font-semibold">{etiqueta}</span>
        {ayuda && <span className="block text-sm text-texto-suave">{ayuda}</span>}
      </span>
    </label>
  );
}

export function Tarjeta({ children, className = "", titulo }: { children: ReactNode; className?: string; titulo?: string }) {
  return (
    <section className={`rounded-2xl border border-borde bg-superficie p-4 shadow-sm ${className}`}>
      {titulo && <h2 className="mb-3 text-lg font-bold">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Aviso({
  tipo = "info",
  children,
  className = "",
}: {
  tipo?: "info" | "exito" | "alerta" | "error";
  children: ReactNode;
  className?: string;
}) {
  const estilos = {
    info: "bg-primario-claro text-primario-oscuro border-primario/20",
    exito: "bg-exito-claro text-exito border-exito/20",
    alerta: "bg-alerta-claro text-alerta border-alerta/20",
    error: "bg-peligro-claro text-peligro border-peligro/20",
  }[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-base ${estilos} ${className}`}>
      {children}
    </div>
  );
}

export function Encabezado({
  titulo,
  subtitulo,
  acciones,
  volver,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  volver?: string;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        {volver && (
          <Link href={volver} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-primario">
            ← Volver
          </Link>
        )}
        <h1 className="text-2xl font-bold leading-tight">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-texto-suave">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function EstadoVacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-borde bg-superficie/60 p-8 text-center">
      <p className="text-lg font-semibold">{titulo}</p>
      {texto && <p className="mt-1 text-texto-suave">{texto}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}

export function Etiqueta({ children, tono = "neutro" }: { children: ReactNode; tono?: "neutro" | "exito" | "alerta" | "peligro" | "primario" }) {
  const estilos = {
    neutro: "bg-fondo text-texto-suave border-borde",
    exito: "bg-exito-claro text-exito border-exito/20",
    alerta: "bg-alerta-claro text-alerta border-alerta/20",
    peligro: "bg-peligro-claro text-peligro border-peligro/20",
    primario: "bg-primario-claro text-primario-oscuro border-primario/20",
  }[tono];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${estilos}`}>{children}</span>;
}

/** Botón de envío que muestra estado de carga con useFormStatus (cliente). */
export { BotonEnviar } from "./boton-enviar";
