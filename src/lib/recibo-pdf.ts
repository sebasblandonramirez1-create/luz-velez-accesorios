/**
 * Genera el recibo de entrega en consignación como archivo PDF (tamaño carta),
 * en el navegador o en Node, con pdf-lib. Sirve para compartirlo como archivo
 * por WhatsApp o correo y para guardarlo.
 *
 * Mismo contenido que el recibo impreso: datos del negocio, datos de quien
 * recibe (en blanco lo que falte, para llenarlo a mano), piezas, condiciones y
 * firmas. Si hay firma electrónica se incrusta la imagen con su evidencia.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { fecha, fechaHora, pesos } from "./formato";
import { CAMPOS_RECEPTOR, codigoVerificacion, leyendaModificaciones, parrafosCondiciones, quienRecibe, totalesRecibo, type DatosRecibo } from "./recibo";
import { numeroDocumento } from "./ventas";

const ANCHO = 612;
const ALTO = 792;
const MARGEN = 46;
const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.42, 0.42, 0.42);
const LINEA = rgb(0.72, 0.72, 0.72);
const ORO = rgb(0.54, 0.42, 0.18);

/** Las fuentes estándar del PDF solo cubren WinAnsi: se sustituye lo demás. */
export function textoPdf(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "");
}

/** Parte un texto en renglones que quepan en `ancho`. */
export function partirEnRenglones(texto: string, anchoDe: (t: string) => number, ancho: number): string[] {
  const renglones: string[] = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (anchoDe(candidato) <= ancho || !actual) actual = candidato;
    else {
      renglones.push(actual);
      actual = palabra;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

function bytesDeDataUrl(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export async function crearPdfRecibo(d: DatosRecibo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const numero = numeroDocumento("C", d.consignacion.numero);
  pdf.setTitle(textoPdf(`Recibo de entrega en consignación ${numero}`));
  pdf.setAuthor(textoPdf(d.negocio.nombre));
  pdf.setSubject(textoPdf(`Entrega a ${d.contacto.nombre}`));

  let pagina: PDFPage = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;
  const util = ANCHO - MARGEN * 2;

  const escribir = (texto: string, x: number, yy: number, tam = 9.5, fuente: PDFFont = normal, color = NEGRO) => pagina.drawText(textoPdf(texto), { x, y: yy, size: tam, font: fuente, color });
  const derecha = (texto: string, xDerecha: number, yy: number, tam = 9.5, fuente: PDFFont = normal, color = NEGRO) => {
    const t = textoPdf(texto);
    pagina.drawText(t, { x: xDerecha - fuente.widthOfTextAtSize(t, tam), y: yy, size: tam, font: fuente, color });
  };
  const raya = (x1: number, x2: number, yy: number, grosor = 0.6, color = LINEA) => pagina.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: grosor, color });
  const asegurar = (alto: number) => {
    if (y - alto < MARGEN + 16) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - MARGEN;
      escribir(`${d.negocio.nombre} · Recibo ${numero} (continuación)`, MARGEN, y, 8.5, normal, GRIS);
      y -= 18;
    }
  };
  const titulo = (texto: string) => {
    asegurar(30);
    escribir(texto.toUpperCase(), MARGEN, y, 9, negrita, ORO);
    y -= 4;
    raya(MARGEN, ANCHO - MARGEN, y, 0.8, ORO);
    y -= 14;
  };

  // --- Encabezado -----------------------------------------------------------
  escribir(d.negocio.nombre, MARGEN, y - 6, 17, negrita);
  derecha("RECIBO DE ENTREGA EN CONSIGNACIÓN", ANCHO - MARGEN, y, 10.5, negrita);
  derecha(`N.º ${numero}`, ANCHO - MARGEN, y - 15, 13, negrita, ORO);
  const datosNegocio = [d.negocio.documento && `NIT / C.C. ${d.negocio.documento}`, d.negocio.telefono && `Tel. ${d.negocio.telefono}`, d.negocio.correo].filter(Boolean).join("  ·  ");
  const lugarNegocio = [d.negocio.direccion, d.negocio.ciudad].filter(Boolean).join(", ");
  let yIzq = y - 22;
  for (const renglon of [datosNegocio, lugarNegocio].filter(Boolean)) {
    escribir(renglon, MARGEN, yIzq, 8.5, normal, GRIS);
    yIzq -= 11;
  }
  derecha(`Fecha de entrega: ${fecha(d.consignacion.fecha_entrega)}`, ANCHO - MARGEN, y - 30, 9.5);
  derecha(`Fecha límite para liquidar: ${d.consignacion.fecha_limite ? fecha(d.consignacion.fecha_limite) : "____ / ____ / ________"}`, ANCHO - MARGEN, y - 42, 9.5, negrita);
  y = Math.min(yIzq, y - 50) - 8;
  raya(MARGEN, ANCHO - MARGEN, y, 1.2, NEGRO);
  const modificada = leyendaModificaciones(d);
  if (modificada) {
    y -= 12;
    escribir(modificada, MARGEN, y, 8, negrita);
  }
  y -= 20;

  // --- Datos de quien recibe ------------------------------------------------
  titulo("Datos de quien recibe la mercancía");
  const persona = quienRecibe(d);
  const columna = util / 2;
  CAMPOS_RECEPTOR.forEach((campo, i) => {
    const x = MARGEN + (i % 2) * columna;
    if (i % 2 === 0) asegurar(26);
    const etiqueta = `${campo.etiqueta}:`;
    escribir(etiqueta, x, y, 8, normal, GRIS);
    const valor = textoPdf(persona[campo.clave] ?? "");
    const xValor = x + normal.widthOfTextAtSize(textoPdf(etiqueta), 8) + 5;
    const xFin = x + columna - (i % 2 === 0 ? 14 : 0);
    if (valor) {
      let tam = 10;
      while (tam > 7 && negrita.widthOfTextAtSize(valor, tam) > xFin - xValor) tam -= 0.5;
      escribir(valor, xValor, y, tam, negrita);
    }
    raya(xValor, xFin, y - 3);
    if (i % 2 === 1 || i === CAMPOS_RECEPTOR.length - 1) y -= 22;
  });
  y -= 4;

  // --- Piezas ---------------------------------------------------------------
  titulo("Mercancía entregada");
  const col = { codigo: MARGEN, descripcion: MARGEN + 78, cantidad: MARGEN + util - 190, valor: MARGEN + util - 95, total: ANCHO - MARGEN };
  const cabecera = () => {
    escribir("Código", col.codigo, y, 8.5, negrita);
    escribir("Descripción", col.descripcion, y, 8.5, negrita);
    derecha("Cant.", col.cantidad, y, 8.5, negrita);
    derecha("Valor unitario", col.valor, y, 8.5, negrita);
    derecha("Total", col.total, y, 8.5, negrita);
    y -= 5;
    raya(MARGEN, ANCHO - MARGEN, y, 0.9, NEGRO);
    y -= 13;
  };
  cabecera();
  const anchoDescripcion = col.cantidad - 36 - col.descripcion;
  for (const l of d.lineas) {
    const renglones = partirEnRenglones(textoPdf(l.nombre.toUpperCase()), (t) => normal.widthOfTextAtSize(t, 9), anchoDescripcion);
    const alto = Math.max(1, renglones.length) * 11 + 5;
    if (y - alto < MARGEN + 16) {
      asegurar(alto + 30);
      cabecera();
    }
    escribir(l.codigo, col.codigo, y, 9, negrita);
    renglones.forEach((r, i) => escribir(r, col.descripcion, y - i * 11, 9));
    derecha(String(l.cantidad), col.cantidad, y, 9.5, negrita);
    derecha(`$ ${pesos(l.valor_unitario)}`, col.valor, y, 9);
    derecha(`$ ${pesos(l.cantidad * l.valor_unitario)}`, col.total, y, 9);
    y -= alto - 3;
    raya(MARGEN, ANCHO - MARGEN, y + 6, 0.4);
    y -= 3;
  }
  const t = totalesRecibo(d.lineas);
  asegurar(34);
  raya(MARGEN, ANCHO - MARGEN, y + 8, 0.9, NEGRO);
  y -= 6;
  escribir(`${t.referencias} ${t.referencias === 1 ? "referencia" : "referencias"} · ${t.piezas} ${t.piezas === 1 ? "pieza" : "piezas"}`, MARGEN, y, 9.5);
  derecha(`TOTAL ENTREGADO   $ ${pesos(t.total)}`, ANCHO - MARGEN, y, 11.5, negrita);
  y -= 18;
  if (d.consignacion.nota) {
    for (const r of partirEnRenglones(textoPdf(`Observaciones: ${d.consignacion.nota}`), (x) => normal.widthOfTextAtSize(x, 9), util)) {
      asegurar(12);
      escribir(r, MARGEN, y, 9);
      y -= 12;
    }
  } else {
    asegurar(14);
    escribir("Observaciones:", MARGEN, y, 8, normal, GRIS);
    raya(MARGEN + 62, ANCHO - MARGEN, y - 3);
    y -= 14;
  }
  y -= 8;

  // --- Condiciones ----------------------------------------------------------
  const condiciones = parrafosCondiciones(d.condiciones);
  if (condiciones.length > 0) {
    titulo("Condiciones de la consignación");
    for (const parrafo of condiciones) {
      const renglones = partirEnRenglones(textoPdf(parrafo), (x) => normal.widthOfTextAtSize(x, 8.5), util);
      asegurar(renglones.length * 10.5 + 4);
      for (const r of renglones) {
        escribir(r, MARGEN, y, 8.5);
        y -= 10.5;
      }
      y -= 3;
    }
    y -= 6;
  }

  // --- Firmas ---------------------------------------------------------------
  asegurar(132);
  titulo("Firmas");
  const anchoFirma = (util - 30) / 2;
  const xEntrega = MARGEN;
  const xRecibe = MARGEN + anchoFirma + 30;
  const yLinea = y - 58;
  if (d.firma) {
    try {
      const imagen = await pdf.embedPng(bytesDeDataUrl(d.firma.imagen));
      const escala = Math.min((anchoFirma - 10) / imagen.width, 54 / imagen.height);
      pagina.drawImage(imagen, { x: xRecibe + 4, y: yLinea + 2, width: imagen.width * escala, height: imagen.height * escala });
    } catch {
      // Si la imagen no se puede leer, el recibo sale sin ella; la evidencia va en texto.
    }
  }
  raya(xEntrega, xEntrega + anchoFirma, yLinea, 0.8, NEGRO);
  raya(xRecibe, xRecibe + anchoFirma, yLinea, 0.8, NEGRO);
  escribir("ENTREGA", xEntrega, yLinea - 11, 8.5, negrita);
  escribir(d.negocio.nombre, xEntrega, yLinea - 22, 8.5);
  if (d.negocio.documento) escribir(`NIT / C.C. ${d.negocio.documento}`, xEntrega, yLinea - 32, 8, normal, GRIS);
  escribir("RECIBE CONFORME", xRecibe, yLinea - 11, 8.5, negrita);
  escribir(persona.nombre ? persona.nombre : "Nombre: ______________________________", xRecibe, yLinea - 22, 8.5);
  escribir(persona.documento ? `C.C. / NIT ${persona.documento}` : "C.C. / NIT: ____________________________", xRecibe, yLinea - 32, 8, normal, persona.documento ? GRIS : NEGRO);
  y = yLinea - 46;
  if (d.firma) {
    asegurar(24);
    escribir(`Firmado electrónicamente el ${fechaHora(d.firma.firmado_en)} (hora de Colombia). Código de verificación ${codigoVerificacion(d.firma.huella)}.`, MARGEN, y, 8, negrita);
    y -= 10;
    escribir(`Huella SHA-256: ${d.firma.huella}`, MARGEN, y, 6.5, normal, GRIS);
    y -= 10;
  } else {
    escribir("Fecha de la firma: ____ / ____ / ________", xRecibe, y, 8);
    y -= 12;
  }

  // --- Pie con numeración ---------------------------------------------------
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    const pie = textoPdf(`${d.negocio.nombre} · Recibo ${numero} · Página ${i + 1} de ${paginas.length}`);
    p.drawText(pie, { x: MARGEN, y: MARGEN - 18, size: 7.5, font: normal, color: GRIS });
  });

  return pdf.save();
}
