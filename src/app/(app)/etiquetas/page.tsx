import { Encabezado, EstadoVacio, BotonEnlace } from "@/components/ui";

export const metadata = { title: "Imprimir etiquetas" };

/** Página provisional: este módulo se construye en la Fase 4. */
export default function Pagina() {
  return (
    <div>
      <Encabezado titulo="Imprimir etiquetas" volver="/" />
      <EstadoVacio
        titulo="Disponible en la Fase 4"
        texto="Aquí irá la impresión de etiquetas en la NIIMBOT y la exportación en PNG y PDF. Mientras tanto puedes registrar ventas, entregas en consignación y abonos."
        accion={<BotonEnlace href="/productos">Ir a productos</BotonEnlace>}
      />
    </div>
  );
}
