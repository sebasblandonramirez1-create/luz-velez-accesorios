# Luz Vélez Accesorios · aplicación de inventario, ventas y consignación

Aplicación web para el negocio de joyería y accesorios **Luz Vélez Accesorios**.
Reemplaza las hojas impresas de Excel (VENTAS, DEVOLUCIONES, PENDIENTE DE PAGO) con
formularios simples que funcionan desde el celular y el computador.

> **Aviso.** Esta aplicación es un **control interno** del negocio. No lleva la
> contabilidad formal colombiana ni emite facturación electrónica de la DIAN, y no
> reemplaza la contabilidad legal.

## Estado del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Proveedores verificados, modelo de datos, autenticación y roles, productos con fotos, movimientos de inventario, importación y exportación, ajustes, papelera, despliegue continuo | **Hecha y desplegada** en <https://luz-velez-accesorios.vercel.app> |
| 2 | Ventas directas, consignación con liquidación, cuentas por cobrar, vistas de impresión iguales a las hojas actuales | **Hecha y desplegada** |
| 3 | Gastos, compras, reportes y exportaciones a Excel y PDF | Pendiente |
| 4 | Etiquetas e impresora NIIMBOT (Bluetooth, PNG y PDF) | Pendiente |
| 5 | Copias de seguridad automáticas y restauración probada, PWA sin conexión, catálogo público, tutorial y guía | Pendiente |

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
| Supabase | 500 MB de base de datos, 1 GB de archivos, 5 GB de salida al mes, 50.000 usuarios activos, 2 proyectos activos. **Se pausa tras 7 días con pocas consultas**; se puede reanudar durante 1 año. | [Precios](https://supabase.com/pricing), [Pausa de proyectos](https://supabase.com/docs/guides/platform/free-project-pausing) |
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

## Estructura del repositorio

```
supabase/migrations/   esquema, disparadores, políticas RLS (fuente de verdad)
supabase/seed.sql      datos de prueba realistas
src/app/               páginas (App Router): ingresar, (app)/productos, inventario, contactos, ajustes…
src/lib/               formato de pesos y fechas, precios, códigos, inventario, CSV, clientes Supabase
src/components/        botones, campos, navegación, subida de fotos, buscador de producto
src/proxy.ts           refresca la sesión y protege las rutas
tests/                 pruebas Vitest; tests/db levanta un Postgres embebido y aplica las migraciones
scripts/               utilidades (preparar Postgres embebido)
docs/                  ejemplo de CSV para importar
src/app/imprimir/      vistas de impresión (comprobante de venta, hojas de consignación)
.github/workflows/     CI y «mantener activo»
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
   vivirá la app (por ejemplo `https://luz-velez.vercel.app`) y añade
   `https://luz-velez.vercel.app/auth/callback` a *Redirect URLs*.
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
   `https://luz-velez-accesorios.vercel.app` salvo que añada un sufijo). **Deploy**.
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

- Desde la app (propietaria): *Ajustes → Usuarias → Invitar a una ayudante*. Requiere
  `SUPABASE_SERVICE_ROLE_KEY` en las variables de entorno del servidor. La invitada
  recibe un correo, crea su contraseña y entra como **ayudante**.
- Desde Supabase: *Authentication → Users → Add user*. También entra como ayudante.
- Para hacerla propietaria o desactivarla: *Ajustes → Usuarias*.

Permisos: la **propietaria** puede todo. La **ayudante** registra ventas y movimientos,
crea productos y contactos y consulta inventario, pero no puede borrar ni restaurar, no
ve la auditoría ni el historial de precios ni el costo de compra, y no cambia ajustes.

## Cómo cambiar el diseño de la etiqueta

Los datos de la etiqueta (nombre del negocio, modelo de impresora, tamaño del rollo,
DPI y si el código lleva el precio en miles como «SLA013 40») se cambian en *Ajustes →
Etiqueta e impresora*. El diseño gráfico (orden de las cuatro líneas, tipografía) se
construye en la Fase 4 y quedará descrito aquí.

## Cómo restaurar un respaldo

Las copias automáticas y el procedimiento probado de restauración se construyen en la
Fase 5. Mientras tanto, Supabase hace copias diarias propias en el plan gratuito solo
durante 7 días; **exporta el catálogo y el inventario** desde la app (*Productos →
Exportar*, *Inventario → Exportar*) si vas a hacer cambios grandes. Tras cualquier
restauración, ejecuta en SQL `select public.recalcular_todo_el_stock();`.

## Variables de entorno

Ver `.env.example`. Nunca subas `.env.local` al repositorio (está en `.gitignore`).

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador y servidor | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador y servidor | clave pública; RLS limita su alcance |
| `SUPABASE_SERVICE_ROLE_KEY` | solo servidor y GitHub | invitaciones, respaldos, purga |
| `NEXT_PUBLIC_APP_URL` | servidor | enlaces de correo y catálogo público |

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
  son páginas de impresión (Relación de entrega, VENTAS, DEVOLUCIONES por bloques y
  PENDIENTE DE PAGO, con el código y el precio en miles como en el papel). El PDF se
  obtiene con «Imprimir → Guardar como PDF» del navegador, también en el celular; no se
  genera en el servidor para no añadir dependencias.
- **WhatsApp.** El comprobante y el recordatorio de saldo son textos listos para
  pegar; el botón abre `wa.me` con el número del contacto (indicativo 57).

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
