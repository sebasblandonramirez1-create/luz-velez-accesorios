/**
 * Recibo de entrega en consignación: tipos y lógica pura (totales, textos para
 * WhatsApp y correo, validación de los datos de quien firma). Sin acceso a la
 * base de datos; se prueba en tests/recibo.test.ts.
 */
import { fecha, fechaHora, pesos } from "./formato";
import { enlaceWhatsApp, numeroDocumento } from "./ventas";

export interface PersonaRecibo {
  nombre: string;
  documento: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  correo: string;
}

export interface LineaRecibo {
  codigo: string;
  nombre: string;
  cantidad: number;
  valor_unitario: number;
}

export interface FirmaRecibo {
  imagen: string;
  firmado_en: string;
  huella: string;
}

export interface DatosRecibo {
  negocio: PersonaRecibo;
  condiciones: string;
  consignacion: { id: string; numero: number; fecha_entrega: string; fecha_limite: string | null; nota: string; total_entregado: number };
  /** Ficha del contacto en la app. */
  contacto: PersonaRecibo;
  lineas: LineaRecibo[];
  /** Datos que escribió quien firmó (solo si hay firma). */
  receptor?: PersonaRecibo | null;
  firma?: FirmaRecibo | null;
  estado?: "pendiente" | "firmado" | "vencido";
  vence?: string;
}

export const PERSONA_VACIA: PersonaRecibo = { nombre: "", documento: "", telefono: "", direccion: "", ciudad: "", correo: "" };

/** Campos de «quien recibe», en el orden en que aparecen en el recibo. */
export const CAMPOS_RECEPTOR: { clave: keyof PersonaRecibo; etiqueta: string }[] = [
  { clave: "nombre", etiqueta: "Nombre completo" },
  { clave: "documento", etiqueta: "Cédula o NIT" },
  { clave: "telefono", etiqueta: "Celular / WhatsApp" },
  { clave: "correo", etiqueta: "Correo electrónico" },
  { clave: "direccion", etiqueta: "Dirección" },
  { clave: "ciudad", etiqueta: "Ciudad y barrio" },
];

/**
 * Datos de quien recibe: si firmó, los que escribió al firmar; si no, la ficha
 * del contacto. Lo que falte queda en blanco para llenarlo a mano en el papel.
 */
export function quienRecibe(d: Pick<DatosRecibo, "contacto" | "receptor" | "firma">): PersonaRecibo {
  if (d.firma && d.receptor) {
    const r = d.receptor;
    const c = d.contacto;
    return {
      nombre: r.nombre || c.nombre,
      documento: r.documento || c.documento,
      telefono: r.telefono || c.telefono,
      direccion: r.direccion || c.direccion,
      ciudad: r.ciudad || c.ciudad,
      correo: r.correo || c.correo,
    };
  }
  return { ...PERSONA_VACIA, ...d.contacto };
}

export function totalesRecibo(lineas: LineaRecibo[]) {
  return {
    piezas: lineas.reduce((s, l) => s + l.cantidad, 0),
    referencias: lineas.length,
    total: lineas.reduce((s, l) => s + l.cantidad * l.valor_unitario, 0),
  };
}

/** Código corto para citar la firma: los primeros 12 caracteres de la huella. */
export function codigoVerificacion(huella: string): string {
  const h = huella.replace(/[^0-9a-f]/gi, "").slice(0, 12).toUpperCase();
  return h.replace(/(.{4})(?=.)/g, "$1-");
}

/** Condiciones como lista de párrafos (una por línea no vacía). */
export function parrafosCondiciones(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function nombreArchivoRecibo(d: Pick<DatosRecibo, "consignacion" | "contacto">): string {
  const nombre = d.contacto.nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `Recibo-${numeroDocumento("C", d.consignacion.numero)}${nombre ? `-${nombre}` : ""}.pdf`;
}

/** Relación de entrega como texto para WhatsApp o correo. */
export function textoRecibo(d: DatosRecibo, enlaceFirma?: string): string {
  const t = totalesRecibo(d.lineas);
  const primerNombre = d.contacto.nombre.trim().split(/\s+/)[0] || d.contacto.nombre;
  const partes = [
    `*${d.negocio.nombre}*`,
    `Recibo de entrega en consignación ${numeroDocumento("C", d.consignacion.numero)}`,
    `Entregado a ${d.contacto.nombre} el ${fecha(d.consignacion.fecha_entrega)}`,
    "",
    ...d.lineas.map((l) => `• ${l.cantidad} × ${l.nombre} (${l.codigo}) a $${pesos(l.valor_unitario)} = $${pesos(l.cantidad * l.valor_unitario)}`),
    "",
    `*Total entregado: ${t.piezas} ${t.piezas === 1 ? "pieza" : "piezas"} por $${pesos(t.total)}*`,
  ];
  if (d.consignacion.fecha_limite) partes.push(`Fecha límite para liquidar: ${fecha(d.consignacion.fecha_limite)}`);
  if (d.consignacion.nota) partes.push(`Nota: ${d.consignacion.nota}`);
  if (d.firma) {
    partes.push("", `Firmado electrónicamente el ${fechaHora(d.firma.firmado_en)}. Código ${codigoVerificacion(d.firma.huella)}.`);
    if (enlaceFirma) partes.push(`Recibo firmado: ${enlaceFirma}`);
  } else if (enlaceFirma) {
    partes.push("", `${primerNombre}, por favor revisa el recibo, completa tus datos y fírmalo desde el celular en este enlace:`, enlaceFirma);
  }
  return partes.join("\n");
}

export function asuntoRecibo(d: DatosRecibo): string {
  return `${d.firma ? "Recibo firmado" : "Recibo de entrega en consignación"} ${numeroDocumento("C", d.consignacion.numero)} · ${d.negocio.nombre}`;
}

/** Enlace mailto: con asunto y cuerpo. El correo puede ir vacío (se elige al enviar). */
export function enlaceCorreo(correo: string, asunto: string, cuerpo: string): string {
  return `mailto:${encodeURIComponent(correo.trim())}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo.replace(/\*/g, ""))}`;
}

export function enlacesParaCompartir(d: DatosRecibo, enlaceFirma?: string) {
  const texto = textoRecibo(d, enlaceFirma);
  const destino = quienRecibe(d);
  return {
    texto,
    whatsapp: enlaceWhatsApp(destino.telefono, texto),
    correo: enlaceCorreo(destino.correo, asuntoRecibo(d), texto),
  };
}

export interface DatosFirma extends PersonaRecibo {
  firma: string;
  acepta: boolean;
}

/** Mensaje en español si los datos de la firma no sirven; null si están bien. */
export function validarDatosFirma(p: DatosFirma): string | null {
  if (p.nombre.trim().length < 3) return "Escribe tu nombre completo.";
  if (p.documento.replace(/\D/g, "").length < 5) return "Escribe tu número de cédula o NIT.";
  if (p.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo.trim())) return "Revisa el correo electrónico.";
  if (!p.firma.startsWith("data:image/png;base64,") || p.firma.length < 200) return "Dibuja tu firma en el recuadro.";
  if (p.firma.length > 400000) return "La firma quedó demasiado pesada. Bórrala y fírmala de nuevo con trazos más simples.";
  if (!p.acepta) return "Marca la casilla para aceptar las condiciones.";
  return null;
}

/** Traduce los errores de las funciones de firma. */
export function mensajeErrorFirma(mensaje: string): string {
  if (/RECIBO_YA_FIRMADO/.test(mensaje)) return "Este recibo ya está firmado.";
  if (/RECIBO_VENCIDO/.test(mensaje)) return "El enlace venció. Pide a quien te lo envió que lo genere de nuevo.";
  if (/RECIBO_NO_ENCONTRADO/.test(mensaje)) return "El enlace no es válido o la entrega fue anulada.";
  if (/RECIBO_SIN_ACEPTAR/.test(mensaje)) return "Marca la casilla para aceptar las condiciones.";
  if (/RECIBO_DATOS_INCOMPLETOS/.test(mensaje)) return "Faltan tu nombre completo o tu documento.";
  if (/RECIBO_FIRMA_INVALIDA/.test(mensaje)) return "La firma no se pudo leer. Bórrala y fírmala de nuevo.";
  if (/SIN_PERMISO/.test(mensaje)) return "Solo la propietaria puede hacer esto.";
  if (/fetch failed|Failed to fetch|NetworkError/i.test(mensaje)) return "Sin conexión. Revisa el internet e inténtalo de nuevo.";
  return "No se pudo completar. Inténtalo de nuevo.";
}
