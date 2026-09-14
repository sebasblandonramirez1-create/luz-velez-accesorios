"use client";

import { useState } from "react";
import { Aviso, Boton } from "@/components/ui";
import { armarZip, nombreRespaldo } from "@/lib/respaldo";
import { urlFoto } from "@/lib/urls";

/**
 * Exportación manual: el servidor entrega las tablas (según los permisos de la
 * propietaria) y el navegador descarga las fotos del bucket público y arma el
 * zip. Así no hay límite de tamaño en el servidor.
 */
export function DescargarRespaldo() {
  const [estado, setEstado] = useState<{ tipo: "info" | "exito" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [incluirFotos, setIncluirFotos] = useState(true);

  async function descargar() {
    setOcupado(true);
    setEstado({ tipo: "info", texto: "Leyendo los datos…" });
    try {
      const r = await fetch("/ajustes/respaldos/datos");
      if (!r.ok) throw new Error(`El servidor respondió ${r.status}.`);
      const { tablas, fotos } = (await r.json()) as { tablas: Record<string, Record<string, unknown>[]>; fotos: string[] };
      const archivos: { ruta: string; bytes: Uint8Array }[] = [];
      if (incluirFotos) {
        let i = 0;
        for (const ruta of fotos) {
          i++;
          setEstado({ tipo: "info", texto: `Descargando fotos (${i} de ${fotos.length})…` });
          const url = urlFoto(ruta);
          if (!url) continue;
          const f = await fetch(url);
          if (f.ok) archivos.push({ ruta, bytes: new Uint8Array(await f.arrayBuffer()) });
        }
      }
      setEstado({ tipo: "info", texto: "Comprimiendo…" });
      const zip = armarZip(tablas, archivos);
      const blob = new Blob([new Uint8Array(zip)], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nombreRespaldo();
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      setEstado({ tipo: "exito", texto: `Respaldo listo: ${(zip.byteLength / 1024 / 1024).toFixed(1)} MB, ${archivos.length} fotos.` });
    } catch (e) {
      setEstado({ tipo: "error", texto: `No se pudo crear el respaldo: ${(e as Error).message}` });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3">
      {estado && <Aviso tipo={estado.tipo}>{estado.texto}</Aviso>}
      <label className="flex items-center gap-2">
        <input type="checkbox" className="h-5 w-5 accent-primario" checked={incluirFotos} onChange={(e) => setIncluirFotos(e.target.checked)} />
        Incluir las fotos (el archivo pesa más)
      </label>
      <Boton onClick={descargar} disabled={ocupado} grande>
        {ocupado ? "Preparando…" : "⬇️ Descargar respaldo completo"}
      </Boton>
    </div>
  );
}
