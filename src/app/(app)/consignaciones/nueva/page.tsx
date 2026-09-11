import { Encabezado, EstadoVacio, BotonEnlace } from "@/components/ui";

export const metadata = { title: "Entregar en consignación" };

/** Página provisional: este módulo se construye en la Fase 2. */
export default function Pagina() {
  return (
    <div>
      <Encabezado titulo="Entregar en consignación" volver="/" />
      <EstadoVacio
        titulo="Disponible en la Fase 2"
        texto="Aquí irán las entregas en consignación, con las hojas de VENTAS, DEVOLUCIONES y PENDIENTE DE PAGO. Mientras tanto puedes cargar productos, registrar entradas y añadir contactos."
        accion={<BotonEnlace href="/productos">Ir a productos</BotonEnlace>}
      />
    </div>
  );
}
