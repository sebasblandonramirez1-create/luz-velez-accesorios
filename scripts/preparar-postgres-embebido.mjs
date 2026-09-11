/**
 * Prepara el Postgres embebido que usan las pruebas (rehidrata los enlaces
 * simbólicos de las bibliotecas nativas). npm 11 no ejecuta el postinstall del
 * paquete por defecto, así que se hace aquí. Es inofensivo si ya está hecho.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const plataforma = `${process.platform}-${process.arch}`;
const base = join(raiz, "node_modules", "@embedded-postgres", plataforma);
if (!existsSync(base)) {
  console.log(`[postgres embebido] no hay binarios para ${plataforma}; las pruebas de base de datos no podrán correr aquí.`);
  process.exit(0);
}
const script = join(base, "scripts", "hydrate-symlinks.js");
if (!existsSync(script)) process.exit(0);
const r = spawnSync(process.execPath, [script], { cwd: base, stdio: "inherit" });
console.log(`[postgres embebido] listo para ${plataforma}.`);
process.exit(r.status ?? 0);
