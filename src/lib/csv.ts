/**
 * Lectura y escritura de CSV sin dependencias. Acepta coma o punto y coma como
 * separador (Excel en español exporta con punto y coma), comillas dobles y
 * saltos de línea dentro de comillas. Al escribir usa punto y coma y BOM para
 * que Excel lo abra bien con acentos.
 */

export function detectarSeparador(texto: string): "," | ";" | "\t" {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  const cuenta = (s: string) => primera.split(s).length - 1;
  const candidatos: Array<[";" | "," | "\t", number]> = [
    [";", cuenta(";")],
    [",", cuenta(",")],
    ["\t", cuenta("\t")],
  ];
  candidatos.sort((a, b) => b[1] - a[1]);
  return candidatos[0][1] > 0 ? candidatos[0][0] : ",";
}

export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const sep = detectarSeparador(limpio);
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"';
          i++;
        } else entreComillas = false;
      } else celda += c;
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === sep) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim() !== ""));
}

export function escribirCsv(filas: (string | number | null | undefined)[][]): string {
  const escapar = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + filas.map((f) => f.map(escapar).join(";")).join("\r\n") + "\r\n";
}

/** Normaliza un encabezado: minúsculas, sin acentos ni espacios. */
export function normalizarEncabezado(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Alias aceptados para cada columna de producto al importar. */
export const COLUMNAS_PRODUCTO: Record<string, string[]> = {
  codigo: ["codigo", "cod", "referencia", "ref", "sku"],
  nombre: ["nombre", "descripcion", "producto", "articulo", "detalle"],
  categoria: ["categoria", "tipo"],
  subcategoria: ["subcategoria", "sub_categoria"],
  material: ["material", "linea"],
  color: ["color"],
  precio_base: ["precio_base", "base", "valor_unitario", "valor", "precio"],
  precio_publico: ["precio_publico", "publico", "precio_etiqueta", "etiqueta", "pvp"],
  precio_mayorista: ["precio_mayorista", "mayorista"],
  costo_compra: ["costo_compra", "costo"],
  stock_inicial: ["stock_inicial", "stock", "cantidad", "existencia", "existencias", "inventario"],
  stock_minimo: ["stock_minimo", "minimo"],
  notas: ["notas", "observaciones", "nota"],
};

export function mapearEncabezados(encabezados: string[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  encabezados.forEach((h, i) => {
    const n = normalizarEncabezado(h);
    for (const [campo, alias] of Object.entries(COLUMNAS_PRODUCTO)) {
      if (mapa[campo] == null && alias.includes(n)) mapa[campo] = i;
    }
  });
  return mapa;
}

export function categoriaDesdeTexto(texto: string): "areta" | "collar" | "pulsera" | "anillo" | "otro" {
  const t = normalizarEncabezado(texto);
  if (/aret|arete|topo|candonga/.test(t)) return "areta";
  if (/collar|cadena|gargantilla|dije/.test(t)) return "collar";
  if (/pulsera|manilla|brazalete|tobillera/.test(t)) return "pulsera";
  if (/anillo|sortija/.test(t)) return "anillo";
  return "otro";
}
