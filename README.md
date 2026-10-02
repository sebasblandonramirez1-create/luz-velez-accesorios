# Luzazul Accesorios · aplicación de inventario, ventas y consignación

Aplicación web para el negocio de joyería y accesorios **Luzazul Accesorios** (antes
«Luz Vélez Accesorios»; el nombre del proyecto, el repositorio y la URL conservan el
identificador `luz-velez-accesorios`).
Reemplaza las hojas impresas de Excel (VENTAS, DEVOLUCIONES, PENDIENTE DE PAGO) con
formularios simples que funcionan desde el celular y el computador.

> **Aviso.** Esta aplicación es un **control interno** del negocio. No lleva la
> contabilidad formal colombiana ni emite facturación electrónica de la DIAN, y no
> reemplaza la contabilidad legal.

## Estado del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Proveedores verificados, modelo de datos, autenticación y roles, productos con fotos, movimientos de inventario, importación y exportación, ajustes, papelera, despliegue continuo | **Hecha y desplegada** en <https://luzazul-accesorios.vercel.app> |
| 2 | Ventas directas, consignación con liquidación, cuentas por cobrar, vistas de impresión iguales a las hojas actuales | **Hecha y desplegada** |
| 3 | Gastos, compras, caja diaria, reportes y exportaciones a Excel y PDF | **Hecha y desplegada** |
| 4 | Etiquetas e impresora NIIMBOT (Bluetooth, PNG y PDF) | **Hecha y desplegada** (Bluetooth pendiente de probar con la impresora real) |
| 5 | Copias de seguridad automáticas y restauración probada, PWA sin conexión, catálogo público, tutorial y guía | **Hecha y desplegada** (el destino de la copia diaria lo configura la propietaria; ver abajo) |

Las decisiones que dependían de la propietaria (impresora y rollo, regla de precio al
público, mostrar el precio en miles en la etiqueta, destino del respaldo, catálogo
público) se configuran **desde la propia aplicación, en Ajustes**, y no en el código.

## Arquitectura

```
Celular / computador (navegador, PWA instalable)
        │  HTTPS
        ▼
Vercel · Next.js 16 (App Router, TypeScript, Tailwind)
        │  supabase-js con la sesión de la usuaria (RLS)
        ▼
Supabase · Postgres 17 + Auth + Storage (bucket «fotos»)
        ▲
GitHub Actions · pruebas → migraciones → despliegue · tarea «mantener activo» · (Fase 5) copias diarias
```

- **Next.js 16** con App Router y Server Actions. El código del cliente nunca ve claves
  secretas: usa la clave pública (anon) y las políticas de seguridad a nivel de fila
  (RLS) limitan lo que cada rol puede hacer.
- **Supabase** aloja Postgres, la autenticación (correo y contraseña, enlace mágico,
  invitaciones) y las fotos. Toda la lógica crítica vive en la base de datos:
  el stock se calcula con disparadores a partir de los movimientos, el historial de
  precios y la auditoría se registran solos, el borrado es lógico con papelera de 30
  días y la purga corre con `pg_cron`.
- **GitHub Actions** corre lint, tipos, pruebas y compilación en cada cambio; en `main`
  aplica las migraciones y despliega a Vercel. Otra tarea consulta la base dos veces
  por semana para que Supabase no pause el proyecto gratuito.
- **Costo esperado: 0 COP/mes** mientras el negocio se mantenga en los límites de
  abajo (varios cientos de productos, algunos miles de transacciones al año y algunos
  cientos de fotos comprimidas a menos de 300 KB caben con holgura).

### Límites de los planes gratuitos (verificados el 11/09/2026)

| Servicio | Plan gratuito | Fuente |
|---|---|---|
| Supabase | 500 MB de base de datos, 1 GB de archivos, 5 GB de salida al mes, 50.000 usuarios activos, 2 proyectos activos. **Se pausa tras 7 días con pocas consultas**; se puede reanudar durante 1 año sin perder datos (ver «Si la aplicación se duerme»). | [Precios](https://supabase.com/pricing), [Pausa de proyectos](https://supabase.com/docs/guides/platform/free-project-pausing) |
| Vercel Hobby | 100 GB de transferencia, 1 millón de invocaciones de funciones, 100 tareas programadas por proyecto, compilaciones de hasta 45 min, 1 compilación simultánea. Solo para uso no comercial según sus términos (ver nota). | [Límites](https://vercel.com/docs/limits) |
| GitHub Actions | 2.000 minutos al mes en repositorios privados; ilimitado en públicos. | [Facturación](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions) |
| Cloudflare R2 (Fase 5, respaldo) | 10 GB de almacenamiento, 1 millón de escrituras y 10 millones de lecturas al mes, salida gratuita. | [Precios R2](https://developers.cloudflare.com/r2/pricing/) |
| Backblaze B2 (alternativa) | 10 GB gratis, salida hasta 3 veces el almacenamiento. | [Precios B2](https://www.backblaze.com/cloud-storage/pricing) |

**Nota sobre Vercel Hobby.** Sus términos lo reservan para uso personal y no comercial.
Un negocio unipersonal de bajo tráfico suele encajar en la práctica, pero si Vercel lo
objetara, la alternativa gratuita es **Cloudflare Pages** (500 compilaciones al mes en
el plan gratuito, [límites](https://developers.cloudflare.com/pages/platform/limits/));
el código no depende de nada exclusivo de Vercel, salvo el flujo de despliegue en
`.github/workflows/ci.yml`.

### Bucket de fotos

El bucket `fotos` es **público de solo lectura**: cualquiera con la URL exacta de una
foto puede verla (hace falta para el catálogo público y simplifica la app). Las fotos
no contienen datos sensibles; el stock, los costos y los precios base nunca salen del
bucket. La escritura exige sesión iniciada.

## Identidad visual

Tomada de la tarjeta del negocio: cartón kraft (`--fondo #f3ede2`), acuarela turquesa
(`--acento #4fb5a6`) y letras doradas (`--primario #8a6a2d`, `--oro #b08d57`). La marca
(`src/components/marca.tsx`) escribe LUZAZUL en **Cinzel** con el aro del logo en lugar de
la A central, dentro del marco redondeado, y «accesorios» en **Josefin Sans** fina y
espaciada; ambas fuentes se sirven con `next/font/google`. Los iconos de la app son el
aro dorado sobre kraft con acuarela. Para cambiar la paleta basta editar las variables
de `src/app/globals.css`.

## Estructura del repositorio

```
supabase/migrations/   esquema, disparadores, políticas RLS (fuente de verdad)
supabase/seed.sql      datos de prueba realistas
src/app/               páginas (App Router): ingresar, (app)/productos, inventario, contactos, ajustes…
src/lib/               formato de pesos y fechas, precios, códigos, inventario, CSV, clientes Supabase
src/components/        botones, campos, navegación, subida de fotos, buscador de producto
src/proxy.ts           refresca la sesión y protege las rutas
tests/                 pruebas Vitest; tests/db levanta un Postgres embebido y aplica las migraciones
scripts/               respaldo.mts, restaurar.mts, guia.mts, preparar Postgres embebido
docs/                  ejemplo de CSV para importar
src/app/imprimir/      vistas de impresión (comprobante de venta, hojas de consignación)
.github/workflows/     CI, «mantener activo» y respaldo diario
```

## Desarrollo local

Requisitos: Node.js 22 o superior (en este equipo está en `~/.local/node`).

```bash
npm install          # también prepara el Postgres embebido de las pruebas
cp .env.example .env.local   # y rellena las claves de Supabase
npm run dev          # http://localhost:3000
npm test             # pruebas de lógica y de base de datos (Postgres embebido, sin Docker)
npm run lint && npm run typecheck && npm run build
```

Las pruebas de base de datos (`tests/db`) levantan un Postgres 17 embebido, simulan lo
mínimo del entorno de Supabase (`auth.uid()`, roles `anon` y `authenticated`) y aplican
las migraciones reales. Verifican, entre otras cosas, que **el stock siempre cuadra con
los movimientos**, que la ayudante no puede borrar, que la papelera restaura y purga a
los 30 días, y que el catálogo público no filtra datos.

## Desplegar desde cero

Las cuentas las crea la propietaria (o quien administre): la aplicación no guarda
contraseñas de terceros. Todo el proceso toma unos 30 minutos.

### 1. Supabase

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo (región más cercana:
   *South America (São Paulo)*). Guarda la **contraseña de la base de datos**.
2. En *Project Settings → API* copia la **Project URL** y la clave pública
   (**anon** / *publishable*). Copia también la clave **service_role** (*secret*):
   solo va en el servidor y en GitHub.
3. En *Authentication → URL Configuration* pon como *Site URL* la dirección donde
   vivirá la app (por ejemplo `https://luzazul-accesorios.vercel.app`) y añade
   `https://luzazul-accesorios.vercel.app/auth/callback` a *Redirect URLs*.
4. En *Authentication → Providers → Email* deja activado *Email* y, para que la
   propietaria pueda entrar sin confirmar correo la primera vez, puedes desactivar
   *Confirm email* (recomendado volver a activarlo después).
5. Aplica el esquema. Opción A, desde tu computador:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```

   Opción B: pega el contenido de `supabase/migrations/*.sql` en *SQL Editor* y
   ejecútalo. Para explorar con datos de prueba, ejecuta después `supabase/seed.sql`.

### 2. Primera usuaria (la propietaria)

En *Authentication → Users → Add user → Create new user*, escribe el correo y una
contraseña. **La primera cuenta que se crea queda como propietaria automáticamente**;
las siguientes entran como ayudantes (se cambia el rol en la app, en *Ajustes →
Usuarias*).

### 3. GitHub

1. Crea un repositorio privado en <https://github.com/new> llamado `luz-velez-accesorios`,
   sin README ni `.gitignore`.
2. Crea un token clásico con permiso `repo` en <https://github.com/settings/tokens> (es la
   «contraseña» que pide `git push`).
3. Sube el código:

   ```bash
   git remote add origin https://github.com/<usuario>/luz-velez-accesorios.git
   git push -u origin main
   ```

   El flujo `CI` corre solo y **no necesita secretos**. El flujo `mantener-activo`
   tampoco: usa la URL y la clave pública del proyecto, que van en el propio archivo.

### 4. Vercel

1. Crea la cuenta en <https://vercel.com/signup> con GitHub, plan Hobby.
2. **Add New → Project → Import** `luz-velez-accesorios`. En *Environment Variables*
   añade `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_APP_URL` (la URL que Vercel asigne,
   `https://luzazul-accesorios.vercel.app` salvo que añada un sufijo). **Deploy**.
3. Vuelve a Supabase → *Authentication → URL Configuration* y pon esa URL como *Site
   URL* y `https://<url>/auth/callback` en *Redirect URLs* (o pídele a Claude que lo haga
   con `npx supabase config push`).

Desde entonces, cada `git push` a `main` corre las pruebas en GitHub y Vercel compila y
publica; si la compilación falla, no se publica. Las migraciones se aplican desde el
computador con `npx supabase db push` (o desde Actions si se activa la variable
`MIGRAR_DESDE_ACTIONS`, ver `.github/workflows/ci.yml`).

> Nota: con la integración de Vercel, un fallo en las **pruebas** de GitHub no bloquea
> la publicación, solo aparece en rojo en el commit. Si más adelante se quiere que las
> pruebas bloqueen el despliegue, se desconecta la integración y se despliega desde
> Actions con un token de Vercel; la versión anterior de `ci.yml` en el historial de git
> tiene ese flujo.

## Cómo añadir una usuaria

- Desde la app (propietaria): *Ajustes → Usuarias → Invitar a una persona*, eligiendo
  el rol (ayudante o propietaria). La persona crea su cuenta desde la pantalla de ingreso
  con «Crear cuenta con invitación». Con `SUPABASE_SERVICE_ROLE_KEY` en el servidor
  también recibe el correo de invitación de Supabase.
- Desde Supabase: *Authentication → Users → Add user* solo funciona si antes existe una
  invitación para ese correo (la base rechaza registros sin invitación).
- Para hacerla propietaria o desactivarla: *Ajustes → Usuarias*.

Permisos: la **propietaria** puede todo. La **ayudante** registra ventas y movimientos,
crea productos y contactos y consulta inventario, pero no puede borrar ni restaurar, no
ve la auditoría ni el historial de precios ni el costo de compra, y no cambia ajustes.

## Cómo cambiar el diseño de la etiqueta

- **Desde la app** (*Ajustes → Etiqueta e impresora*): modelo de impresora, DPI, rollo
  (lista de rollos habituales o medidas a mano), qué líneas lleva la etiqueta (nombre del
  negocio, descripción en mayúsculas, código con precio en miles, precio al público) y si
  el código lleva el precio en miles. La vista previa está en *Imprimir etiquetas*.
- **En el código**: el texto de cada línea y su peso (cuánto alto ocupa) están en
  `lineasDeEtiqueta` de `src/lib/etiquetas.ts`; el dibujo (fuentes, márgenes, centrado)
  en `dibujarEtiqueta` de `src/components/etiqueta-canvas.tsx`. La fuente se reduce
  automáticamente hasta que el texto cabe en el ancho.

## Etiquetas e impresora NIIMBOT (Fase 4)

Tres rutas de impresión, en *Imprimir etiquetas* (cola con varios productos y cantidad
por producto):

1. **Bluetooth directo** con la biblioteca abierta
   [`@mmote/niimbluelib`](https://github.com/MultiMote/niimbluelib) (MIT, versión fijada
   `0.46.0`, en estado alfa según sus autores). Usa la API Web Bluetooth, disponible en
   Chrome y Edge en Android, Windows, macOS y Linux, y **no** en iPhone ni Safari
   ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)). La app
   detecta el modelo al conectar y elige el algoritmo de impresión con `findPrintTask`;
   si no lo reconoce, se puede forzar a mano. Modelos que los usuarios de la biblioteca
   reportan funcionando por Bluetooth: D11, D101, D110, D110_M, B1, B1 Pro, B21, B21 Pro,
   B18, M2 ([lista de modelos probados](https://github.com/MultiMote/niimbluelib/issues/1)).
   El B3S no funciona por Bluetooth. **Advertencia de los autores:** el proyecto es
   «con fines informativos y educativos» y no está afiliado al fabricante; la licencia es
   MIT. Esta ruta no se ha podido probar con la impresora física desde el desarrollo:
   queda pendiente de la primera prueba de la propietaria con su equipo.
2. **PNG para la app oficial NIIMBOT**: un archivo por producto, al tamaño exacto del
   rollo en píxeles (203 o 300 dpi), que se abre como imagen en la app del celular.
   Funciona en iPhone. Es la ruta de respaldo definitiva si el Bluetooth falla.
3. **Hoja PDF** para impresoras convencionales: `/imprimir/etiquetas` dibuja cada
   etiqueta a su tamaño físico en milímetros; se imprime al 100 % o se guarda como PDF.

Detalles técnicos: el tamaño en píxeles es `mm / 25,4 × dpi`; para impresoras «de lado»
(D11, D110: cabezal de 96 px = 12 mm) el alto de la etiqueta va contra el cabezal y la
imagen se gira 90° al codificar; para las «de frente» (B1, B21: cabezal de 384 px =
48 mm) es el ancho. Si el rollo supera el cabezal hasta un 8 % (50 mm en la B1) se recorta
el margen; si lo supera más, la app avisa y bloquea la impresión.

## Usuarias e invitaciones

Puede haber varias propietarias. En *Ajustes → Usuarias* la propietaria invita por
correo eligiendo el rol; la persona invitada entra a la app, pulsa «Crear cuenta con
invitación» y usa ese mismo correo (la base rechaza registros sin invitación). Si el
servidor tiene `SUPABASE_SERVICE_ROLE_KEY`, además se envía el correo de invitación de
Supabase. El rol también se puede cambiar después desde la misma pantalla.

## Copias de seguridad

Tres mecanismos, todos con el mismo formato de archivo (`respaldo-aaaa-mm-dd.zip`:
`meta.json`, `datos/<tabla>.json` y `.csv` por cada tabla, y `fotos/…`):

1. **Copia automática diaria** (`.github/workflows/respaldo.yml`, 03:30 de Bogotá):
   `scripts/respaldo.mts` lee todas las tablas por conexión directa a Postgres, descarga las
   fotos del bucket y sube el zip a un destino **fuera de Supabase**. Conserva 30 copias
   diarias y la primera de cada mes durante 12 meses (`copiasParaBorrar`). Al terminar
   anota la fecha en `ajustes.ultimo_respaldo_en`; el tablero avisa si pasan 48 horas.
   Configuración (GitHub → Settings → Secrets and variables → Actions):
   - Secreto `SUPABASE_DB_URL`: Supabase → botón **Connect** → *Session pooler* (IPv4).
   - Variable `RESPALDO_DESTINO` = `r2` o `drive` (sin ella, la copia queda como artefacto
     del flujo durante 90 días, que sirve de red de seguridad mínima).
   - **Cloudflare R2** (10 GB gratis, [precios](https://developers.cloudflare.com/r2/pricing/)):
     crear un bucket privado y un token de API con permiso de lectura y escritura; secretos
     `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
   - **Google Drive de la propietaria**: crear un proyecto en Google Cloud con la API de
     Drive, credenciales OAuth «aplicación de escritorio», obtener un *refresh token* con el
     alcance `drive.file` (por ejemplo con OAuth Playground) y la carpeta destino; secretos
     `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
     `GOOGLE_DRIVE_FOLDER_ID`.
2. **Descarga manual** desde la app (*Ajustes → Copias de seguridad*): el servidor entrega
   las tablas y el navegador descarga las fotos y arma el zip (sin límite de tamaño del
   servidor).
3. **Restauración**: `scripts/restaurar.mts` (abajo).

## Cómo restaurar un respaldo

1. Ten un proyecto de Supabase con las migraciones aplicadas (`npx supabase db push`).
2. En la terminal, en la carpeta del proyecto:

   ```bash
   SUPABASE_DB_URL='postgres://…' NEXT_PUBLIC_SUPABASE_URL='https://….supabase.co' SUPABASE_SERVICE_ROLE_KEY='…' node scripts/restaurar.mts respaldo-2026-09-13.zip
   ```

   Sin `--confirmar` solo muestra el contenido. Con `--confirmar` **reemplaza todo** el
   contenido de las tablas por el del respaldo (dentro de una transacción: si algo falla,
   no queda nada a medias), ajusta la numeración de ventas, consignaciones y compras,
   recalcula el stock y vuelve a subir las fotos (`--sin-fotos` para omitirlas).
3. Las cuentas de usuarias no se restauran (viven en la autenticación de Supabase): crea la
   de la propietaria en *Authentication → Users*; será propietaria por ser la primera, y
   desde *Ajustes → Usuarias* invita a las demás.

Está probado automáticamente: `tests/db/restaurar.test.ts` exporta una base con actividad
y la restaura idéntica en una vacía, y `tests/db/scripts_respaldo.test.ts` ejecuta los dos
scripts reales de punta a punta contra Postgres embebidos.

## Modo sin conexión (PWA)

`public/sw.js` guarda los archivos estáticos y la última copia de cada pantalla visitada;
sin red se muestran en solo lectura o aparece `/sin-conexion`. Las ventas y entregas en
consignación registradas sin red se guardan en el celular (`src/lib/pendientes.ts`) y el
componente `SincronizarPendientes` las envía solas cuando vuelve la conexión, mostrando
cuántas faltan y permitiendo descartarlas. Las demás operaciones exigen conexión.

## Catálogo público

`/catalogo/<dirección>` (la dirección se fija en *Ajustes → Catálogo público*). Lee la
vista `catalogo_publico` con la clave anónima: solo productos activos marcados como
visibles, con foto, nombre, material, color y precio al público; nunca stock ni precios
base. Cada pieza tiene un botón «Pedir» que abre WhatsApp al teléfono del negocio.

## Tutorial y guía

Al entrar por primera vez en un navegador aparece un tutorial de cinco pasos (se puede
repetir desde *Ajustes → Ayuda*). La guía rápida de dos páginas con capturas está en
`public/guia-propietaria.pdf` (enlace en Ayuda) y se regenera con `node scripts/guia.mts`
con la app corriendo en local.

## Si la aplicación «se duerme» (pausa de Supabase)

El plan gratuito de Supabase pausa el proyecto cuando pasa **una semana sin consultas**.
No se pierde nada: la base de datos y las fotos quedan guardadas y vuelven intactas al
reactivarlo (Supabase permite reactivar hasta un año después de la pausa). Mientras
está dormido, la pantalla de ingreso avisa «La aplicación está dormida» y enlaza a
**`/reactivar`**; también hay un enlace permanente «¿La aplicación no responde?
Reactivarla» al pie del ingreso.

Hay tres defensas, de más a menos automática:

1. **Que no se duerma.** El flujo `mantener-activo.yml` hace una consulta mínima
   todos los días (Supabase dice que «unas pocas consultas al día» bastan). No
   necesita secretos. Si alguna vez falla, GitHub avisa por correo a la dueña del
   repositorio.
2. **Reactivar desde la app.** Si en Vercel existe la variable
   `SUPABASE_ACCESS_TOKEN` (token de acceso de Supabase: avatar → *Account* →
   *Access Tokens* → *Generate new token*; si ofrece permisos finos, basta
   `project_admin_write` sobre este proyecto; guárdalo como *Sensitive* y redespliega),
   la pantalla `/reactivar` muestra el botón **Reactivar la aplicación**, que pide la
   reactivación a la API de gestión de Supabase y se queda comprobando el estado
   hasta que vuelve. El botón solo actúa cuando el proyecto está dormido, así que
   no sirve para nada más aunque sea público.
3. **Reactivar a mano.** Sin token, `/reactivar` enlaza al proyecto en el panel de
   Supabase: *Restore project* → confirmar → esperar uno a tres minutos.

Comprobación hecha el 22/09/2026: tras ocho días sin uso, el proyecto pasó a `INACTIVE`;
el flujo de mantenimiento anterior nunca corrió por un error de sintaxis en el `if`
del paso opcional (`secrets` no está disponible en `if`), corregido en esa fecha.

## Variables de entorno

Ver `.env.example`. Nunca subas `.env.local` al repositorio (está en `.gitignore`).

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador y servidor | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador y servidor | clave pública; RLS limita su alcance |
| `SUPABASE_SERVICE_ROLE_KEY` | solo servidor y GitHub | invitaciones, respaldos, purga |
| `NEXT_PUBLIC_APP_URL` | servidor | enlaces de correo y catálogo público |
| `SUPABASE_ACCESS_TOKEN` | solo servidor (opcional) | botón «Reactivar la aplicación» en `/reactivar` cuando Supabase pausa el proyecto |

## Ventas, consignación y cuentas por cobrar (Fase 2)

- **Una venta = un documento con líneas + una cuenta por cobrar.** Los pagos son
  `abonos`; una venta «pagada» es una venta con un abono por el total en el momento de
  registrarla. Así la caja (Fase 3) sale de los abonos por fecha y medio de pago.
- **Consignación.** `consignaciones` → `consignacion_lineas` (entregada, vendida,
  devuelta, pendiente = entregada − vendida − devuelta, garantizado por restricción).
  Cada visita de la vendedora es una `liquidacion` con sus líneas; el disparador
  acumula en la línea de consignación, devuelve al inventario lo devuelto y actualiza
  la cuenta por cobrar (valor = vendido acumulado). El estado pasa de abierta a parcial
  y a cerrada cuando no queda nada pendiente.
- **Todo entra por funciones atómicas** (`registrar_venta`, `registrar_consignacion`,
  `registrar_liquidacion`, `registrar_abono`): una llamada, una transacción; si falta
  stock o se liquida de más, no queda nada a medias.
- **Papelera.** Anular una venta devuelve el inventario y anula sus abonos; anular una
  liquidación deshace cantidades y retornos; una consignación con liquidaciones no se
  puede anular hasta anularlas. Todo se restaura desde Ajustes → Papelera.
- **Comprobantes y hojas.** `/imprimir/ventas/<id>` y `/imprimir/consignaciones/<id>`
  son páginas de impresión (Recibo de entrega, VENTAS, DEVOLUCIONES por bloques y
  PENDIENTE DE PAGO, con el código y el precio en miles como en el papel). El PDF se
  obtiene con «Imprimir → Guardar como PDF» del navegador, también en el celular; no se
  genera en el servidor para no añadir dependencias.
- **WhatsApp.** El comprobante y el recordatorio de saldo son textos listos para
  pegar; el botón abre `wa.me` con el número del contacto (indicativo 57).

## Recibo de consignación, buscador de piezas y firma electrónica

Añadido el 01/10/2026 (migración 10).

- **Recibo de entrega con más datos.** El recibo lleva los datos del negocio (NIT o
  cédula, teléfono, correo, dirección, ciudad: Ajustes → Negocio), el número y la
  fecha, la **fecha límite para liquidar**, un bloque «Datos de quien recibe»
  (nombre, cédula o NIT, celular, correo, dirección, ciudad), la relación de piezas con
  totales, observaciones, las **condiciones de la consignación** y las dos firmas. Lo
  que la ficha del contacto no tenga sale como renglón en blanco para llenarlo a mano.
  El plazo en días y el texto de las condiciones se cambian en Ajustes → Recibo de
  consignación. Un mismo contenido en tres salidas: página de impresión
  (`/imprimir/consignaciones/<id>?hoja=entrega`), archivo PDF
  (`src/lib/recibo-pdf.ts`, con `pdf-lib`, generado en el navegador) y página pública
  de firma.
- **Buscador de piezas al crear la entrega** (`src/components/selector-productos.tsx`,
  lógica en `src/lib/filtros-productos.ts`): texto libre sobre código, nombre, material,
  color y categoría (sin tildes, varias palabras); pestañas por categoría con conteo;
  filtros de material y color; solo con existencias; solo lo añadido; orden por código,
  nombre, precio o existencias; vista de fotos o de lista; y una lista con barra de
  desplazamiento propia que muestra todos los resultados. Cada pieza se añade y se
  ajusta con − / + sin salir de la lista.
- **Compartir.** En el detalle de la consignación, tarjeta «Recibo de entrega»:
  imprimir; **Compartir PDF** (en el celular abre el menú de compartir con el archivo
  adjunto, para WhatsApp o correo; donde el navegador no lo permite, lo descarga);
  **WhatsApp** y **Correo** con la relación de piezas como texto y el enlace del recibo.
- **Firma electrónica.** «Pedir firma electrónica» genera un enlace
  `/firmar/<token>` (15 días). Quien recibe lo abre sin cuenta, revisa el recibo,
  completa sus datos, firma con el dedo y acepta las condiciones. Se guardan la imagen
  de la firma, la fecha y hora, la IP, el navegador y una huella SHA-256 del contenido;
  el recibo firmado muestra un código de verificación y el mismo enlace lo sigue
  mostrando. Los datos que escriba completan la ficha del contacto donde estaba vacía.
  Solo la propietaria puede anular una firma o un enlace.
- **Seguridad.** `anon` sigue sin permiso sobre ninguna tabla: lee y firma únicamente a
  través de `recibo_para_firmar(token)` y `firmar_recibo_consignacion(token, datos)`,
  que exigen un token vigente, firman una sola vez y validan nombre, documento y firma.
  Probado en `tests/db/recibo_firma.test.ts`.
- **Alcance legal.** Es una firma electrónica simple (Ley 527 de 1999 y Decreto 2364
  de 2012): sirve como constancia de que la persona recibió y aceptó, con evidencia de
  quién, cuándo y desde dónde. No es una firma digital certificada por una entidad de
  certificación. Si el negocio necesita un respaldo jurídico mayor (por ejemplo, un
  título ejecutivo), conviene revisar el texto de las condiciones con una abogada o un
  abogado.

## Gastos, compras, caja y reportes (Fase 3)

- **Solo la propietaria** ve y registra compras, gastos, caja y reportes (RLS y comprobación
  en las funciones). La ayudante sigue registrando ventas, entregas y abonos.
- **Compras.** `compras` → `compra_lineas`; cada línea genera una entrada de inventario
  con documento `compra`, actualiza `costo_compra` del producto y la compra registra
  automáticamente un `gasto` de categoría «compra de mercancía» por su total. Anular una
  compra devuelve las entradas salvo que ya se haya vendido parte (`COMPRA_YA_VENDIDA`).
- **Gastos** con categoría, medio de pago, proveedor opcional y foto del soporte (carpeta
  `gastos/` del bucket). Los gastos ligados a una compra se editan desde la compra.
- **Caja del día** (`caja_del_dia`): ingresos = abonos del día por medio de pago; gastos
  del día por medio; efectivo esperado = ingresos en efectivo − gastos en efectivo. El
  cierre (`cerrar_caja`) guarda la foto del día, el efectivo contado y la diferencia; se
  puede corregir el mismo día.
- **Reportes** (`reporte_periodo(desde, hasta)`): ventas = ventas directas del período +
  lo vendido en liquidaciones del período; por categoría; más vendidos; costo de lo
  vendido con el `costo_compra` actual (se avisa cuántas piezas no tienen costo); margen
  bruto = ventas − costo; utilidad estimada = margen − gastos operativos (todas las
  categorías salvo compra de mercancía, que ya está en el costo); cobros por medio;
  cuentas por cobrar y valor del inventario a base, público y costo (a hoy).
- **Exportación.** Excel con un escritor `.xlsx` propio (`src/lib/xlsx.ts`, sobre
  `fflate`, sin SheetJS): catálogo, inventario (existencias y movimientos) y reporte con
  varias hojas. PDF: página de impresión `/imprimir/reportes` y «Guardar como PDF».

## Decisiones de diseño

- **El stock nunca se edita a mano.** Un disparador ignora cualquier cambio directo a
  `stock_actual`; solo cambia al insertar, anular o restaurar movimientos. Las salidas
  que dejarían el stock en negativo se rechazan, salvo los ajustes de resta.
- **Dos precios con historial.** `precio_base` (el de las hojas, 40.000) y
  `precio_publico` (el de la etiqueta, 118.900), más mayorista y costo opcionales. Cada
  cambio queda en `precio_historial`. La regla de cálculo (manual o base × factor con
  redondeo) es un ajuste.
- **Códigos.** `siguiente_codigo('SLA')` no cuenta los `SLAP…`, de modo que las
  pulseras llevan su propia numeración. El número que sigue al código en las hojas
  («SLA013 40») se interpreta como precio base en miles al importar.
- **Borrado lógico.** `eliminado_en` + vista `papelera` + `purgar_papelera(30)`.
- **Dinero en enteros** (pesos sin decimales), fechas en `timestamptz` y se muestran en
  `America/Bogota` con formato dd/mm/aaaa.
- **Sin dependencias de más.** Next, supabase-js, zod, browser-image-compression y
  Tailwind en producción; Vitest, pg y embedded-postgres para pruebas.
