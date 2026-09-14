#!/usr/bin/env node
/**
 * Genera public/guia-propietaria.pdf: una guía de dos páginas con capturas de
 * la app tomadas en formato celular. Usa el Chrome instalado en el equipo
 * (puppeteer-core, sin descargar navegadores).
 *
 *   GUIA_CORREO=... GUIA_CONTRASENA=... node scripts/guia.mts [http://localhost:3000]
 *
 * Requiere la app corriendo (npm run dev) y una cuenta de propietaria.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:3000";
const correo = process.env.GUIA_CORREO;
const contrasena = process.env.GUIA_CONTRASENA;
if (!correo || !contrasena) {
  console.error("Faltan GUIA_CORREO y GUIA_CONTRASENA.");
  process.exit(2);
}
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const CAPTURAS: { archivo: string; ruta: string; titulo: string; preparar?: (p: import("puppeteer-core").Page) => Promise<void> }[] = [
  { archivo: "inicio", ruta: "/", titulo: "Inicio" },
  { archivo: "venta", ruta: "/ventas/nueva", titulo: "Registrar venta", preparar: async (p) => { await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("SLA013")); b?.click(); }); await new Promise((r) => setTimeout(r, 600)); } },
  { archivo: "consignacion", ruta: "/consignaciones", titulo: "Consignaciones" },
  { archivo: "productos", ruta: "/productos", titulo: "Productos" },
  { archivo: "etiquetas", ruta: "/etiquetas", titulo: "Imprimir etiquetas", preparar: async (p) => { await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("SLA013")); b?.click(); }); await new Promise((r) => setTimeout(r, 600)); } },
  { archivo: "mas", ruta: "/ajustes", titulo: "Más" },
];

async function main() {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  const carpeta = join(process.cwd(), "docs", "capturas");
  mkdirSync(carpeta, { recursive: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 760, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${base}/ingresar`, { waitUntil: "networkidle0" });
    await page.type("input[type=email]", correo!);
    await page.type("input[type=password]", contrasena!);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60_000 }), page.click("main button[type=submit]")]);
    // Cerrar el tutorial de primer uso.
    await page.evaluate(() => localStorage.setItem("tutorial-visto", "1"));

    const imagenes: Record<string, string> = {};
    for (const c of CAPTURAS) {
      await page.goto(`${base}${c.ruta}`, { waitUntil: "networkidle0", timeout: 60_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      if (c.preparar) await c.preparar(page);
      const png = (await page.screenshot({ type: "png" })) as Uint8Array;
      writeFileSync(join(carpeta, `${c.archivo}.png`), png);
      imagenes[c.archivo] = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
      console.log(`captura ${c.archivo}`);
    }

    const html = plantilla(imagenes, base);
    const pagina = await browser.newPage();
    await pagina.setContent(html, { waitUntil: "load" });
    await pagina.evaluate(() => document.fonts.ready);
    const pdf = await pagina.pdf({ format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" } });
    const salida = join(process.cwd(), "public", "guia-propietaria.pdf");
    writeFileSync(salida, pdf);
    console.log(`PDF: ${salida} (${(pdf.byteLength / 1024).toFixed(0)} KB)`);
  } finally {
    await browser.close();
  }
}

function plantilla(img: Record<string, string>, url: string): string {
  const fig = (clave: string, pie: string) => `<figure><img src="${img[clave]}" alt="${pie}"><figcaption>${pie}</figcaption></figure>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Josefin+Sans:wght@300&display=swap"><style>
    @page { size: A4; margin: 12mm; }
    body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #3a2f22; font-size: 10.5pt; line-height: 1.35; margin: 0; }
    h1 { color: #8a6a2d; font-size: 20pt; margin: 0 0 2mm; }
    h2 { color: #8a6a2d; font-size: 13pt; margin: 5mm 0 2mm; border-bottom: 2px solid #b08d57; padding-bottom: 1mm; }
    .sub { color: #6b5c64; margin: 0 0 4mm; }
    .fila { display: flex; gap: 5mm; align-items: flex-start; }
    .texto { flex: 1; }
    figure { margin: 0; width: 44mm; flex: none; }
    figure img { width: 44mm; border: 1px solid #e6dcdf; border-radius: 3mm; }
    figcaption { font-size: 8pt; color: #6b5c64; text-align: center; margin-top: 1mm; }
    ol, ul { margin: 1mm 0 2mm; padding-left: 5mm; }
    li { margin-bottom: 1.2mm; }
    .salto { break-before: page; }
    .caja { background: #dff3ef; border-radius: 3mm; padding: 3mm 4mm; margin: 3mm 0; }
    .pie { font-size: 8pt; color: #6b5c64; margin-top: 4mm; }
    b { color: #6c5121; }
  </style></head><body>
  <h1 style="font-family: Cinzel, Georgia, serif; letter-spacing: 0.12em">LUZAZUL <span style="font-family: 'Josefin Sans', sans-serif; font-weight: 300; letter-spacing: 0.3em; font-size: 12pt; color:#7a6a58">accesorios</span> · Guía rápida</h1>
  <p class="sub">Tu inventario, ventas y consignaciones en el celular. Dirección: <b>${url}</b></p>

  <h2>Entrar e instalar en el celular</h2>
  <div class="fila"><div class="texto">
    <ol>
      <li>Abre la dirección en <b>Chrome</b> (Android) o <b>Safari</b> (iPhone) y entra con tu correo y contraseña.</li>
      <li>Para tenerla como una app: en Android, menú ⋮ → <b>Añadir a pantalla de inicio</b>; en iPhone, botón de compartir → <b>Añadir a pantalla de inicio</b>.</li>
      <li>La barra de abajo tiene cinco botones: <b>Inicio, Ventas, Consignación, Productos y Más</b>.</li>
      <li>Si olvidas la contraseña, en la pantalla de entrada pulsa «Olvidé mi contraseña» o «Entrar con un enlace al correo».</li>
    </ol>
    <div class="caja">El <b>Inicio</b> muestra las ventas de hoy y del mes, cuánto te deben, qué productos se están agotando y accesos directos a lo más usado.</div>
  </div>${fig("inicio", "Inicio")}</div>

  <h2>Registrar una venta en tres toques</h2>
  <div class="fila"><div class="texto">
    <ol>
      <li>Pulsa <b>Ventas → Registrar venta</b>. Busca la pieza por código o nombre, o tócala en la cuadrícula de fotos.</li>
      <li>Ajusta la cantidad con − y +. El precio al público sale solo; puedes cambiarlo o poner un descuento.</li>
      <li>Elige el medio de pago (efectivo, Nequi, transferencia…) y si queda pagada, con abono o pendiente. Pulsa <b>Confirmar venta</b>.</li>
    </ol>
    <p>El inventario se descuenta solo. En la venta puedes enviar el <b>comprobante por WhatsApp</b> o guardarlo en PDF. Si te equivocas, «Anular venta» devuelve las piezas.</p>
    <p>Sin internet, la venta se guarda en el celular y se envía sola cuando vuelva la señal.</p>
  </div>${fig("venta", "Registrar venta")}</div>

  <h2>Productos y etiquetas</h2>
  <div class="fila"><div class="texto">
    <ul>
      <li><b>Productos → Añadir</b>: foto con la cámara, código sugerido (SLA… o SLAP… para pulseras), precio base y precio al público, cantidad inicial. Menos de un minuto.</li>
      <li><b>Importar</b> carga tu catálogo desde Excel; <b>Exportar</b> lo descarga.</li>
      <li><b>Imprimir etiquetas</b> (en Inicio o en Más): elige piezas y cuántas etiquetas; imprime por Bluetooth en la NIIMBOT, descarga el PNG para la app NIIMBOT o una hoja para imprimir.</li>
    </ul>
  </div>${fig("productos", "Productos")}${fig("etiquetas", "Etiquetas")}</div>

  <h2 class="salto">Consignación: las hojas de siempre, sin papel</h2>
  <div class="fila"><div class="texto">
    <ol>
      <li><b>Consignación → Nueva entrega</b>: elige la vendedora y las piezas que se lleva (a precio base, como en las hojas). Imprime o envía la relación de entrega.</li>
      <li>Cuando te traiga la cuenta, abre la entrega y en <b>Liquidar</b> escribe por cada pieza cuántas <b>vendió</b> y cuántas <b>devuelve</b>, y cuánto te paga hoy.</li>
      <li>Las hojas <b>VENTAS</b>, <b>DEVOLUCIONES</b> y <b>PENDIENTE DE PAGO</b> se ven en pantalla y se imprimen igual que las de papel (botón «Hojas / PDF»).</li>
    </ol>
    <p>Lo devuelto vuelve al inventario solo. Lo vendido queda en <b>Cuentas por cobrar</b> hasta que ella pague; con «Recordar saldo» le envías el mensaje por WhatsApp.</p>
  </div>${fig("consignacion", "Consignaciones")}</div>

  <h2>Todo lo demás está en «Más»</h2>
  <div class="fila"><div class="texto">
    <ul>
      <li><b>Inventario</b>: entradas por compra, ajustes, pérdidas y obsequios. El stock nunca se edita a mano: siempre queda el movimiento.</li>
      <li><b>Contactos</b>: vendedoras, clientas, mayoristas y proveedores.</li>
      <li><b>Cuentas por cobrar</b>: quién debe, desde cuándo, abonos y recordatorios.</li>
      <li><b>Compras</b>: la mercancía que compras entra al inventario y actualiza el costo.</li>
      <li><b>Gastos, Caja del día y Reportes</b> (solo propietaria): gastos por categoría con foto del recibo, cuánto efectivo debe haber al cerrar, y reportes por día, semana, mes o año con exportación a Excel y PDF.</li>
      <li><b>Ajustes</b>: precios, etiqueta e impresora, catálogo público para compartir por WhatsApp, usuarias (invita a otra propietaria o a una ayudante), copias de seguridad y <b>Papelera</b>: lo borrado se recupera durante 30 días.</li>
    </ul>
    <div class="caja">Ante cualquier duda: <b>Más → Ayuda</b> tiene el tutorial y esta guía. La app es un control interno del negocio y no reemplaza la contabilidad legal.</div>
  </div>${fig("mas", "Más")}</div>
  <p class="pie">Generada automáticamente desde la aplicación. Las capturas pueden diferir ligeramente de la versión actual.</p>
  </body></html>`;
}

main().catch((e) => {
  console.error("ERROR generando la guía:", e.message ?? e);
  process.exit(1);
});
