import { urlFoto } from "@/lib/urls";

/** Miniatura cuadrada de producto con marcador cuando no hay foto. */
export function MiniaturaProducto({ ruta, nombre, tamano = 56, className = "" }: { ruta?: string | null; nombre: string; tamano?: number; className?: string }) {
  const url = urlFoto(ruta);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-borde bg-fondo ${className}`}
      style={{ width: tamano, height: tamano }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={nombre} width={tamano} height={tamano} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden className="text-xl text-texto-suave/50">
          ◈
        </span>
      )}
    </span>
  );
}
