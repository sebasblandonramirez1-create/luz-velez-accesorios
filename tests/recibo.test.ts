import { describe, expect, it } from "vitest";
import {
  asuntoRecibo,
  codigoVerificacion,
  enlaceCorreo,
  enlacesParaCompartir,
  mensajeErrorFirma,
  nombreArchivoRecibo,
  parrafosCondiciones,
  quienRecibe,
  textoRecibo,
  totalesRecibo,
  validarDatosFirma,
  type DatosRecibo,
} from "@/lib/recibo";
import { crearPdfRecibo, partirEnRenglones, textoPdf } from "@/lib/recibo-pdf";
import { fecha, sumarDias } from "@/lib/formato";

const FIRMA = "data:image/png;base64," + "A".repeat(400);
// PNG real de 1×1 para comprobar que la imagen se incrusta.
const PNG_1X1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function recibo(extra: Partial<DatosRecibo> = {}): DatosRecibo {
  return {
    negocio: { nombre: "Luzazul Accesorios", documento: "900.123.456-7", telefono: "3001234567", direccion: "Cra 43A # 1-50", ciudad: "Medellín", correo: "hola@luzazul.co" },
    condiciones: "1. La mercancía sigue siendo del negocio.\n\n2. Se liquida en la fecha límite.",
    consignacion: { id: "c1", numero: 7, fecha_entrega: "2026-10-01T15:00:00Z", fecha_limite: "2026-10-31", nota: "", total_entregado: 145000 },
    contacto: { nombre: "Marcela Ríos", documento: "", telefono: "300 111 2233", direccion: "", ciudad: "", correo: "" },
    lineas: [
      { codigo: "SLA013", nombre: "Aretas perla", cantidad: 2, valor_unitario: 40000 },
      { codigo: "SLA030", nombre: "Collar perla", cantidad: 1, valor_unitario: 65000 },
    ],
    ...extra,
  };
}

describe("fechas", () => {
  it("un día suelto no cambia por la zona horaria", () => {
    expect(fecha("2026-10-31")).toBe("31/10/2026");
    expect(sumarDias("2026-10-01", 30)).toBe("2026-10-31");
    expect(sumarDias("2026-12-20", 15)).toBe("2027-01-04");
  });
});

describe("datos del recibo", () => {
  it("suma piezas, referencias y total", () => {
    expect(totalesRecibo(recibo().lineas)).toEqual({ piezas: 3, referencias: 2, total: 145000 });
  });

  it("sin firma usa la ficha del contacto; con firma, lo que escribió quien firmó", () => {
    expect(quienRecibe(recibo())).toMatchObject({ nombre: "Marcela Ríos", documento: "", telefono: "300 111 2233" });
    const firmado = recibo({
      receptor: { nombre: "Marcela Ríos Gómez", documento: "43.123.456", telefono: "", direccion: "Calle 10", ciudad: "Envigado", correo: "m@ejemplo.com" },
      firma: { imagen: FIRMA, firmado_en: "2026-10-02T14:30:00Z", huella: "ab12cd34ef56ab12cd34" },
    });
    expect(quienRecibe(firmado)).toEqual({ nombre: "Marcela Ríos Gómez", documento: "43.123.456", telefono: "300 111 2233", direccion: "Calle 10", ciudad: "Envigado", correo: "m@ejemplo.com" });
  });

  it("código de verificación, párrafos y nombre de archivo", () => {
    expect(codigoVerificacion("ab12cd34ef56ab12cd34")).toBe("AB12-CD34-EF56");
    expect(parrafosCondiciones(recibo().condiciones)).toHaveLength(2);
    expect(nombreArchivoRecibo(recibo())).toBe("Recibo-C-0007-Marcela-Rios.pdf");
  });
});

describe("textos para compartir", () => {
  it("relación de entrega con total, fecha límite y enlace de firma", () => {
    const t = textoRecibo(recibo(), "https://app.test/firmar/abc");
    expect(t).toContain("*Luzazul Accesorios*");
    expect(t).toContain("Recibo de entrega en consignación C-0007");
    expect(t).toContain("• 2 × Aretas perla (SLA013) a $40.000 = $80.000");
    expect(t).toContain("*Total entregado: 3 piezas por $145.000*");
    expect(t).toContain("Fecha límite para liquidar: 31/10/2026");
    expect(t).toContain("Marcela, por favor revisa el recibo");
    expect(t).toContain("https://app.test/firmar/abc");
  });

  it("si ya está firmado, lo dice y no pide firmar", () => {
    const firmado = recibo({ receptor: { ...recibo().contacto, documento: "43123456" }, firma: { imagen: FIRMA, firmado_en: "2026-10-02T14:30:00Z", huella: "ab12cd34ef56" } });
    const t = textoRecibo(firmado, "https://app.test/firmar/abc");
    expect(t).toContain("Firmado electrónicamente el 02/10/2026 09:30");
    expect(t).toContain("Código AB12-CD34-EF56");
    expect(t).not.toContain("por favor revisa");
    expect(asuntoRecibo(firmado)).toBe("Recibo firmado C-0007 · Luzazul Accesorios");
  });

  it("arma los enlaces de WhatsApp y correo", () => {
    const e = enlacesParaCompartir(recibo(), "https://app.test/firmar/abc");
    expect(e.whatsapp).toMatch(/^https:\/\/wa\.me\/573001112233\?text=/);
    expect(e.correo).toMatch(/^mailto:\?subject=Recibo%20de%20entrega/);
    expect(decodeURIComponent(e.correo)).not.toContain("*");
    expect(enlaceCorreo("a@b.co", "Hola", "Texto")).toBe("mailto:a%40b.co?subject=Hola&body=Texto");
  });
});

describe("validación de la firma", () => {
  const base = { nombre: "Marcela Ríos", documento: "43.123.456", telefono: "", direccion: "", ciudad: "", correo: "", firma: FIRMA, acepta: true };
  it("acepta datos completos", () => {
    expect(validarDatosFirma(base)).toBeNull();
  });
  it("explica qué falta", () => {
    expect(validarDatosFirma({ ...base, nombre: "M" })).toMatch(/nombre/);
    expect(validarDatosFirma({ ...base, documento: "12" })).toMatch(/cédula/);
    expect(validarDatosFirma({ ...base, correo: "malo" })).toMatch(/correo/);
    expect(validarDatosFirma({ ...base, firma: "" })).toMatch(/firma/);
    expect(validarDatosFirma({ ...base, acepta: false })).toMatch(/casilla/);
  });
  it("traduce los errores de la base de datos", () => {
    expect(mensajeErrorFirma("RECIBO_VENCIDO: el enlace venció")).toMatch(/venció/);
    expect(mensajeErrorFirma("RECIBO_YA_FIRMADO: x")).toMatch(/ya está firmado/);
    expect(mensajeErrorFirma("otra cosa")).toMatch(/Inténtalo/);
  });
});

describe("PDF del recibo", () => {
  it("limpia lo que las fuentes del PDF no pueden escribir y conserva las tildes", () => {
    expect(textoPdf("Señora «Ríos» – 3 × ✨ piezas…")).toBe('Señora "Ríos" - 3 ×  piezas...');
  });
  it("parte renglones largos", () => {
    expect(partirEnRenglones("uno dos tres cuatro", (t) => t.length, 8)).toEqual(["uno dos", "tres", "cuatro"]);
  });
  it("genera un PDF válido, sin firma y con firma", async () => {
    const sinFirma = await crearPdfRecibo(recibo());
    expect(new TextDecoder().decode(sinFirma.slice(0, 5))).toBe("%PDF-");
    expect(sinFirma.length).toBeGreaterThan(1500);
    const conFirma = await crearPdfRecibo(
      recibo({ receptor: { ...recibo().contacto, documento: "43123456" }, firma: { imagen: PNG_1X1, firmado_en: "2026-10-02T14:30:00Z", huella: "ab".repeat(32) } }),
    );
    expect(conFirma.length).toBeGreaterThan(sinFirma.length);
    // Una firma ilegible no impide generar el archivo.
    const rota = await crearPdfRecibo(recibo({ receptor: recibo().contacto, firma: { imagen: FIRMA, firmado_en: "2026-10-02T14:30:00Z", huella: "ab".repeat(32) } }));
    expect(new TextDecoder().decode(rota.slice(0, 5))).toBe("%PDF-");
  });
  it("pagina las entregas largas", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const lineas = Array.from({ length: 90 }, (_, i) => ({ codigo: `SLA${String(i).padStart(3, "0")}`, nombre: `Aretas modelo ${i}`, cantidad: 1, valor_unitario: 40000 }));
    const pdf = await PDFDocument.load(await crearPdfRecibo(recibo({ lineas })));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
