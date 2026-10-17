/**
 * Ayuda en lenguaje sencillo: qué se hace en cada pantalla y los pasos de las
 * tareas de cada día. La usan el botón «Ayuda» que acompaña todas las
 * pantallas, el inicio y la página de ayuda. Sin dependencias; se prueba en
 * tests/ayuda.test.ts.
 */

export interface EnlaceAyuda {
  href: string;
  texto: string;
}

export interface AyudaPantalla {
  patron: RegExp;
  titulo: string;
  pasos: string[];
  enlaces?: EnlaceAyuda[];
}

/** Tareas frecuentes, en el orden en que suelen ocurrir en el día. */
export const TAREAS_DEL_DIA: { emoji: string; titulo: string; detalle: string; href: string }[] = [
  { emoji: "⇧", titulo: "Llegó mercancía", detalle: "Ingresa al stock los productos que ya existen: busca cada uno y escribe cuántos llegaron.", href: "/inventario/entrada" },
  { emoji: "➕", titulo: "Tengo una pieza nueva", detalle: "Crea el producto con foto, clasificación y precio, y di cuántos ejemplares entran.", href: "/productos/nuevo" },
  { emoji: "🛍️", titulo: "Vendí una pieza", detalle: "Registra la venta: elige las piezas, el medio de pago y listo. El inventario baja solo.", href: "/ventas/nueva" },
  { emoji: "📦", titulo: "Entregué a una vendedora", detalle: "Registra la consignación, imprime o envía el recibo y, si quieres, pide la firma por WhatsApp.", href: "/consignaciones/nueva" },
  { emoji: "✅", titulo: "Me trajeron la cuenta", detalle: "Abre la consignación y liquida: marca lo vendido y lo devuelto, y anota el abono.", href: "/consignaciones" },
  { emoji: "🏷️", titulo: "Necesito etiquetas", detalle: "Elige los productos y cuántas etiquetas de cada uno; imprime por Bluetooth o en hoja.", href: "/etiquetas" },
];

export const AYUDA_POR_PANTALLA: AyudaPantalla[] = [
  {
    patron: /^\/$/,
    titulo: "Inicio",
    pasos: ["Los botones grandes de arriba son los atajos a lo que más se hace.", "Más abajo ves las ventas de hoy, lo que te deben y los productos con poco stock.", "El menú de abajo lleva a Ventas, Consignación y Productos. En «Más» están las demás secciones."],
    enlaces: [{ href: "/ajustes/ayuda", texto: "Ver la guía completa" }],
  },
  {
    patron: /^\/productos\/nuevo/,
    titulo: "Añadir un producto nuevo",
    pasos: ["Toma una foto o súbela.", "Elige la clasificación (CP, CM, PL…) y revisa el código sugerido.", "Escribe el nombre y los precios.", "En «Ingresar al stock» di cuántos ejemplares entran.", "Toca «Guardar producto», o «Guardar y añadir otro» si tienes varios."],
  },
  {
    patron: /^\/productos\/[^/]+\/editar/,
    titulo: "Editar un producto",
    pasos: ["Cambia lo que necesites y toca «Guardar cambios».", "Si llegaron más ejemplares, usa el enlace «Ingresar al stock»: no cambies el stock a mano."],
  },
  {
    patron: /^\/productos\/[^/]+$/,
    titulo: "Ficha del producto",
    pasos: ["Aquí ves fotos, precios, stock y cada movimiento del inventario.", "«Registrar movimiento» sirve para entradas, ajustes, pérdidas u obsequios.", "«Editar» cambia los datos; «Etiqueta» imprime la suya."],
  },
  {
    patron: /^\/productos/,
    titulo: "Productos",
    pasos: ["Escribe en el buscador o usa «Más filtros» (existencias, material, color, proveedor, fecha de creación).", "Marca la casilla de los productos que quieras y toca «Ingresar al stock» para registrar su entrada de una vez.", "Los productos con la marca «Sin clasificar» necesitan que les elijas la clasificación."],
    enlaces: [{ href: "/productos/nuevo", texto: "Añadir un producto" }],
  },
  {
    patron: /^\/inventario\/entrada/,
    titulo: "Ingresar productos al stock",
    pasos: ["Busca cada producto y toca «Añadir», o usa los que marcaste en Productos.", "Escribe cuántas unidades entran de cada uno. «Misma cantidad para todos» ahorra tiempo.", "Revisa el costo por unidad si es una compra, la fecha y la nota.", "Toca «Registrar la entrada»: el stock se actualiza al instante."],
  },
  {
    patron: /^\/inventario/,
    titulo: "Inventario",
    pasos: ["Cada entrada y salida queda anotada con fecha. El stock se calcula solo a partir de ellas.", "Si algo quedó mal, envía ese movimiento a la papelera y el stock se corrige.", "«Registrar movimiento» es para un solo producto; «Ingresar al stock» en el inicio, para varios."],
  },
  {
    patron: /^\/ventas\/nueva/,
    titulo: "Registrar una venta",
    pasos: ["Busca las piezas y tócalas para añadirlas.", "Revisa cantidades, precio y descuento si lo hay.", "Elige el medio de pago y si quedó algo pendiente.", "Toca «Confirmar venta». Puedes imprimir el comprobante o enviarlo por WhatsApp."],
  },
  {
    patron: /^\/ventas/,
    titulo: "Ventas",
    pasos: ["Aquí están las ventas registradas. Toca una para ver el detalle, imprimir o anular.", "«Nueva venta» registra otra."],
  },
  {
    patron: /^\/consignaciones\/nueva/,
    titulo: "Nueva entrega en consignación",
    pasos: ["Elige la vendedora y la fecha límite para liquidar.", "Busca las piezas con los filtros y toca «Añadir» en cada una.", "Revisa la lista y toca «Confirmar entrega».", "Después imprime el recibo, compártelo por WhatsApp o pide la firma electrónica."],
  },
  {
    patron: /^\/consignaciones\/[^/]+\/modificar/,
    titulo: "Modificar una entrega",
    pasos: ["Añade o retira piezas y cambia cantidades sin liquidar.", "Abajo ves la lista de cambios antes de guardar; todo queda en el historial.", "Si el recibo ya estaba firmado, la firma se anula y hay que pedirla de nuevo."],
  },
  {
    patron: /^\/consignaciones\/[^/]+$/,
    titulo: "Detalle de la consignación",
    pasos: ["«Recibo de entrega»: imprimir, compartir el PDF, enviar por WhatsApp o pedir la firma.", "«Liquidar»: marca cuántas piezas vendió y cuántas devuelve, y anota el abono.", "«Modificar entrega» si se lleva más piezas o devuelve algunas antes de liquidar."],
  },
  {
    patron: /^\/consignaciones/,
    titulo: "Consignaciones",
    pasos: ["Cada fila es una entrega a una vendedora. Toca una para liquidar, modificar o ver el recibo.", "La fecha límite en rojo significa que ya pasó y falta liquidar."],
    enlaces: [{ href: "/consignaciones/nueva", texto: "Nueva entrega" }],
  },
  {
    patron: /^\/cuentas/,
    titulo: "Cuentas por cobrar",
    pasos: ["Aquí ves quién debe y cuánto. Toca una persona para anotar un abono.", "«Recordar saldo» prepara un mensaje de WhatsApp listo para enviar."],
  },
  {
    patron: /^\/etiquetas/,
    titulo: "Imprimir etiquetas",
    pasos: ["Marca los productos y cuántas etiquetas de cada uno.", "«Imprimir por Bluetooth» con la NIIMBOT, o «Descargar PNG» / «Hoja PDF» si no conecta.", "El rollo y el modelo se cambian en Ajustes."],
  },
  {
    patron: /^\/contactos/,
    titulo: "Contactos",
    pasos: ["Vendedoras, clientas y proveedores. Toca uno para ver sus cuentas y consignaciones.", "La cédula, el correo y la dirección salen en el recibo de consignación."],
  },
  {
    patron: /^\/(compras|gastos|caja|reportes)/,
    titulo: "Contabilidad",
    pasos: ["Compras y gastos alimentan la caja del día y los reportes.", "«Cerrar caja» compara lo que debería haber en efectivo con lo que contaste.", "Los reportes se exportan a Excel."],
  },
  {
    patron: /^\/ajustes/,
    titulo: "Ajustes",
    pasos: ["Datos del negocio, precios, etiqueta, clasificaciones, usuarias y copias de seguridad.", "«Tamaño de letra» agranda toda la app.", "La papelera guarda 30 días lo que se borre."],
  },
];

/** Ayuda de la pantalla actual, o una genérica si ninguna coincide. */
export function ayudaPara(pathname: string): AyudaPantalla {
  const limpio = pathname.replace(/\/+$/, "") || "/";
  return (
    AYUDA_POR_PANTALLA.find((a) => a.patron.test(limpio)) ?? {
      patron: /.*/,
      titulo: "Ayuda",
      pasos: ["Usa el menú de abajo para ir a Ventas, Consignación o Productos.", "En «Más» están el inventario, los contactos, las cuentas y los ajustes.", "Si te pierdes, toca «Ir al inicio»."],
      enlaces: [{ href: "/ajustes/ayuda", texto: "Ver la guía completa" }],
    }
  );
}
