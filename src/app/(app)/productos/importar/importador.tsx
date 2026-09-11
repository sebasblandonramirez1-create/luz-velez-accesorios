"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Boton, Tarjeta } from "@/components/ui";
import { categoriaDesdeTexto, leerCsv, mapearEncabezados } from "@/lib/csv";
import { interpretarCodigoDeHoja, normalizarCodigo, codigoValido } from "@/lib/codigos";
import { leerPesos, pesos } from "@/lib/formato";
import { CATEGORIA_SINGULAR } from "@/lib/tipos";
import { importarProductos, type FilaImportacion } from "./acciones";

interface FilaVista extends FilaImportacion {
  problema: string | null;
}

export function Importador({ codigosExistentes }: { codigosExistentes: string[] }) {
  const router = useRouter();
  const [filas, setFilas] = useState<FilaVista[]>([]);
  const [columnas, setColumnas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function leerArchivo(archivo: File | undefined) {
    setError(null);
    setResultado(null);
    if (!archivo) return;
    const texto = await archivo.text();
    const tabla = leerCsv(texto);
    if (tabla.length < 2) {
      setError("El archivo no tiene filas de datos. Revisa que tenga encabezados y al menos un producto.");
      return;
    }
    const mapa = mapearEncabezados(tabla[0]);
    if (mapa.codigo == null || mapa.nombre == null) {
      setError(`No encontré las columnas obligatorias. Encabezados leídos: ${tabla[0].join(", ")}. Necesito al menos «Código» y «Descripción» (o «Nombre»).`);
      return;
    }
    setColumnas(Object.keys(mapa));
    const existentes = new Set(codigosExistentes);
    const vistos = new Set<string>();
    const celda = (f: string[], campo: string) => (mapa[campo] == null ? "" : (f[mapa[campo]] ?? "").trim());

    const lista: FilaVista[] = tabla.slice(1).map((f) => {
      const { codigo: cod, precioBase: precioDeHoja } = interpretarCodigoDeHoja(celda(f, "codigo"));
      const codigo = normalizarCodigo(cod);
      const nombre = celda(f, "nombre");
      const precio_base = leerPesos(celda(f, "precio_base")) ?? precioDeHoja ?? 0;
      const precio_publico = leerPesos(celda(f, "precio_publico")) ?? 0;
      const fila: FilaVista = {
        codigo,
        nombre,
        categoria: mapa.categoria != null ? categoriaDesdeTexto(celda(f, "categoria")) : categoriaDesdeTexto(nombre),
        subcategoria: celda(f, "subcategoria"),
        material: celda(f, "material"),
        color: celda(f, "color"),
        precio_base,
        precio_publico,
        precio_mayorista: leerPesos(celda(f, "precio_mayorista")),
        costo_compra: leerPesos(celda(f, "costo_compra")),
        stock_inicial: leerPesos(celda(f, "stock_inicial")) ?? 0,
        stock_minimo: leerPesos(celda(f, "stock_minimo")),
        notas: celda(f, "notas"),
        problema: null,
      };
      if (!codigo || !codigoValido(codigo)) fila.problema = "Código vacío o inválido";
      else if (!nombre) fila.problema = "Sin descripción";
      else if (existentes.has(codigo)) fila.problema = "Ya existe en la app";
      else if (vistos.has(codigo)) fila.problema = "Repetido en el archivo";
      vistos.add(codigo);
      return fila;
    });
    setFilas(lista);
  }

  const validas = filas.filter((f) => !f.problema);

  async function confirmar() {
    setCargando(true);
    setError(null);
    try {
      const r = await importarProductos(validas.map(({ problema: _problema, ...resto }) => resto));
      if (r.error) setError(r.error);
      else {
        setResultado(`Se importaron ${r.importados} productos.`);
        setFilas([]);
        setTimeout(() => router.push("/productos?aviso=" + encodeURIComponent(`Se importaron ${r.importados} productos.`)), 800);
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tarjeta>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Archivo CSV</span>
          <input type="file" accept=".csv,text/csv,.txt" className="campo" onChange={(e) => leerArchivo(e.target.files?.[0])} />
        </label>
        {error && <Aviso tipo="error" className="mt-3">{error}</Aviso>}
        {resultado && <Aviso tipo="exito" className="mt-3">{resultado}</Aviso>}
      </Tarjeta>

      {filas.length > 0 && (
        <Tarjeta titulo={`Vista previa: ${validas.length} para importar, ${filas.length - validas.length} con problemas`}>
          <p className="mb-2 text-sm text-texto-suave">Columnas reconocidas: {columnas.join(", ")}.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  <th className="py-2 pr-2">Código</th>
                  <th className="py-2 pr-2">Descripción</th>
                  <th className="py-2 pr-2">Categoría</th>
                  <th className="py-2 pr-2 text-right">Base</th>
                  <th className="py-2 pr-2 text-right">Público</th>
                  <th className="py-2 pr-2 text-right">Cant.</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className={`border-b border-borde ${f.problema ? "bg-peligro-claro/40" : ""}`}>
                    <td className="py-1.5 pr-2 font-semibold">{f.codigo}</td>
                    <td className="py-1.5 pr-2">{f.nombre}</td>
                    <td className="py-1.5 pr-2">{CATEGORIA_SINGULAR[f.categoria]}</td>
                    <td className="py-1.5 pr-2 text-right">{pesos(f.precio_base)}</td>
                    <td className="py-1.5 pr-2 text-right">{pesos(f.precio_publico)}</td>
                    <td className="py-1.5 pr-2 text-right">{f.stock_inicial}</td>
                    <td className="py-1.5">{f.problema ? <span className="text-peligro">{f.problema}</span> : <span className="text-exito">Listo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Boton grande onClick={confirmar} disabled={cargando || validas.length === 0}>
              {cargando ? "Importando…" : `Importar ${validas.length} productos`}
            </Boton>
            <Boton grande variante="fantasma" onClick={() => setFilas([])} disabled={cargando}>
              Cancelar
            </Boton>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
