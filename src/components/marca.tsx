/**
 * Marca de Luzazul: la palabra LUZAZUL en Cinzel con el aro del logo colgado
 * de la A central, dentro de un marco redondeado dorado, y «accesorios» debajo
 * en letra fina espaciada. Sin imágenes: tipografía y un SVG mínimo.
 */
export function Aro({ tamano = 18, className = "" }: { tamano?: number; className?: string }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" transform="translate(1.5 1.5)" />
    </svg>
  );
}

export function Marca({
  tamano = "md",
  conMarco = true,
  claro = false,
  className = "",
}: {
  tamano?: "sm" | "md" | "lg";
  conMarco?: boolean;
  claro?: boolean;
  className?: string;
}) {
  const t = {
    sm: { titulo: "text-base", sub: "text-[0.55rem]", aro: 9, pad: "px-2.5 py-1", desplaz: "-right-1 -bottom-0.5" },
    md: { titulo: "text-2xl", sub: "text-[0.7rem]", aro: 14, pad: "px-4 py-2", desplaz: "-right-1.5 -bottom-1" },
    lg: { titulo: "text-4xl", sub: "text-sm", aro: 20, pad: "px-6 py-3", desplaz: "-right-2 -bottom-1.5" },
  }[tamano];
  const color = claro ? "text-white" : "text-oro";
  return (
    <span className={`inline-flex flex-col items-center ${color} ${className}`}>
      <span className={`marca-titulo inline-flex items-baseline leading-none ${t.titulo} ${conMarco ? `rounded-lg border-2 ${claro ? "border-white/80" : "border-oro"} ${t.pad}` : ""}`}>
        <span>LUZ</span>
        <span className="relative inline-block">
          A
          <Aro tamano={t.aro} className={`absolute ${t.desplaz} rounded-full bg-transparent`} />
        </span>
        <span>ZUL</span>
      </span>
      <span className={`marca-sub mt-1 ${t.sub} ${claro ? "text-white/90" : "text-texto-suave"}`}>accesorios</span>
    </span>
  );
}
