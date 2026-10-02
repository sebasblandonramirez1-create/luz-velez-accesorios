import { Encabezado, Tarjeta } from "@/components/ui";
import { BotonVerTutorial } from "@/components/tutorial";

export const metadata = { title: "Ayuda" };

export default function PaginaAyuda() {
  return (
    <div className="space-y-4">
      <Encabezado titulo="Ayuda" volver="/ajustes" />
      <div className="flex flex-wrap gap-2">
        <BotonVerTutorial />
        <a href="/guia-propietaria.pdf" target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-xl bg-primario px-4 font-semibold text-white">
          📄 Guía rápida en PDF
        </a>
      </div>
      <Tarjeta titulo="Cómo empezar">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Añade tus productos</strong> desde «Productos → Añadir»: toma la foto, revisa el código sugerido, escribe el precio base y el precio al público, y la cantidad que tienes. También puedes importar tu catálogo desde Excel («Productos → Importar»).
          </li>
          <li>
            <strong>Registra las entradas</strong> cuando compres mercancía: «Inventario → Registrar movimiento → Entrada por compra». El stock se calcula solo.
          </li>
          <li>
            <strong>Añade tus contactos</strong>: vendedoras en consignación, clientas frecuentes y proveedores.
          </li>
          <li>
            <strong>Ventas y consignaciones</strong>: en «Ventas» registras la venta directa; en «Consignación» la entrega a una vendedora (con buscador y filtros para ubicar las piezas) y, cuando te trae la cuenta, la liquidación con las hojas de VENTAS, DEVOLUCIONES y PENDIENTE DE PAGO. Si la vendedora se lleva más piezas o devuelve algunas antes de liquidar, usa «Modificar entrega»: el cambio queda en el historial de la consignación. El recibo de entrega se imprime, se comparte como PDF por WhatsApp o correo, o se envía un enlace para que la vendedora lo firme desde su celular.
          </li>
          <li>
            <strong>Compras, gastos, caja y reportes</strong> (solo propietaria): en «Más». Cada compra entra al inventario y actualiza el costo; la caja del día muestra lo que debe haber en efectivo; los reportes se exportan a Excel o PDF.
          </li>
        </ol>
      </Tarjeta>
      <Tarjeta titulo="Instalar en el celular">
        <p>
          En Android (Chrome): abre el menú ⋮ y elige <strong>«Añadir a pantalla de inicio»</strong> o «Instalar aplicación». En iPhone (Safari): toca el botón de compartir y luego <strong>«Añadir a pantalla de inicio»</strong>.
        </p>
      </Tarjeta>
      <Tarjeta titulo="Si algo sale mal">
        <ul className="list-disc space-y-1 pl-5">
          <li>Si borraste algo por error, la propietaria puede restaurarlo desde «Ajustes → Papelera» durante 30 días.</li>
          <li>Si el stock no cuadra, revisa los movimientos del producto: cada entrada y salida queda registrada con fecha.</li>
          <li>Si no puedes entrar, usa «Olvidé mi contraseña» o «Entrar con un enlace al correo».</li>
        </ul>
      </Tarjeta>
    </div>
  );
}
