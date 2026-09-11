import { Encabezado, EstadoVacio, BotonEnlace } from "@/components/ui";

export const metadata = { title: "Registrar venta" };

/** Página provisional: este módulo se construye en la Fase 2. */
export default function Pagina() {
  return (
    <div>
      <Encabezado titulo="Registrar venta" volver="/" />
      <EstadoVacio
        titulo="Disponible en la Fase 2"
        texto="Aquí irán las ventas directas, con comprobante en PDF y mensaje para WhatsApp. Mientras tanto puedes cargar productos, registrar entradas y añadir contactos."
        accion={<BotonEnlace href="/productos">Ir a productos</BotonEnlace>}
      />
    </div>
  );
}
