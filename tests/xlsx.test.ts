import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { crearXlsx, letraColumna } from "@/lib/xlsx";

describe("xlsx", () => {
  it("nombra columnas como Excel", () => {
    expect(letraColumna(0)).toBe("A");
    expect(letraColumna(25)).toBe("Z");
    expect(letraColumna(26)).toBe("AA");
    expect(letraColumna(27)).toBe("AB");
    expect(letraColumna(701)).toBe("ZZ");
  });

  it("produce un zip con las partes esperadas y las celdas correctas", () => {
    const bytes = crearXlsx([
      { nombre: "Productos", filas: [["Código", "Nombre", "Precio"], ["SLA013", "Aretas <perla> & \"Mallorca\"", 118900], ["SLA014", null, 0]], anchos: [12, 40, 12] },
      { nombre: "Ventas/2026?", filas: [["Total"], [430700]] },
    ]);
    expect(bytes.byteLength).toBeGreaterThan(500);
    const partes = unzipSync(bytes);
    expect(Object.keys(partes).sort()).toEqual(
      ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"].sort(),
    );
    const hoja1 = strFromU8(partes["xl/worksheets/sheet1.xml"]);
    expect(hoja1).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Código</t></is></c>');
    expect(hoja1).toContain('<c r="C2"><v>118900</v></c>');
    expect(hoja1).toContain("Aretas &lt;perla&gt; &amp; &quot;Mallorca&quot;");
    expect(hoja1).toContain('<c r="C3"><v>0</v></c>');
    expect(hoja1).not.toContain('r="B3"'); // celda vacía omitida
    expect(hoja1).toContain('<col min="2" max="2" width="40"');
    const libro = strFromU8(partes["xl/workbook.xml"]);
    expect(libro).toContain('name="Productos"');
    expect(libro).toContain('name="Ventas 2026 "'); // caracteres prohibidos reemplazados
  });

  it("sin hojas genera un libro con una hoja vacía", () => {
    const partes = unzipSync(crearXlsx([]));
    expect(strFromU8(partes["xl/worksheets/sheet1.xml"])).toContain("<sheetData></sheetData>");
  });
});
