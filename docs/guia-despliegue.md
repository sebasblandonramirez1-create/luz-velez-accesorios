# Guía de despliegue paso a paso

Qué vas a crear: tres cuentas gratuitas (Supabase, GitHub y Vercel), un puñado de claves y
una app publicada en una dirección `https://….vercel.app`. Tiempo estimado: 30 a 45 minutos.

## Antes de empezar

- Usa **un solo correo** para las tres cuentas (por ejemplo el tuyo, no el de la propietaria).
  La cuenta de la propietaria dentro de la app es aparte y se crea en el paso 4.
- Ten a mano un bloc de notas **fuera del chat** (Notas de macOS, por ejemplo) para ir
  copiando claves. Hay dos tipos:

| Tipo | Ejemplos | Dónde puede ir |
|---|---|---|
| Públicas | Project URL, clave `anon` / `publishable`, Project ref, URL de Vercel, orgId, projectId | Se pueden pegar en el chat sin problema |
| **Secretas** | clave `service_role` / `secret`, contraseña de la base de datos, Access Token de Supabase, token de Vercel, token de GitHub | **Nunca en el chat.** Solo en `.env.local`, en los secretos de GitHub y en las variables de Vercel |

- Algunos pasos son en tu terminal, porque piden abrir el navegador para iniciar sesión.
  Abre Terminal en la carpeta del proyecto:

  ```bash
  cd ~/Documents/Claude/Projects/luz-velez-accesorios
  ```

  Si el comando `node` no aparece, ejecuta antes `source ~/.zshrc`.

---

## 1. Supabase: base de datos, autenticación y fotos

### 1.1 Crear la cuenta y el proyecto

1. Entra en <https://supabase.com> → **Start your project** → **Continue with GitHub** (si
   no tienes cuenta de GitHub, créala primero en <https://github.com/signup>; la usarás
   también en el paso 2).
2. Aparece el panel. Si pide crear una **organización**, ponle un nombre (por ejemplo
   `Luz Velez`), tipo *Personal*, plan **Free**.
3. **New project**:
   - *Name*: `luz-velez-accesorios`
   - *Database Password*: pulsa **Generate a password**, cópiala y guárdala en tu bloc
     como **CONTRASEÑA BD** (secreta). No se vuelve a mostrar.
   - *Region*: **South America (São Paulo)**.
   - *Pricing plan*: **Free**.
   - **Create new project**. Tarda 1 o 2 minutos en quedar listo.

### 1.2 Copiar las claves

1. En el menú de la izquierda, abajo: **Project Settings** (icono de engranaje) →
   **General**. Copia **Project ID** (también llamado *Reference ID*, son unas 20 letras
   como `abcdefghijklmnopqrst`). Guárdalo como **PROJECT REF** (pública).
2. **Project Settings → API Keys** (en paneles antiguos se llama **API**). Verás:
   - **Project URL**: `https://<project-ref>.supabase.co`. Guárdala como **SUPABASE URL**
     (pública).
   - Clave **anon** (pestaña *Legacy anon, service_role keys*) o **publishable**
     (`sb_publishable_…`). Cualquiera de las dos sirve. Guárdala como **CLAVE ANON**
     (pública).
   - Clave **service_role** (legacy) o **secret** (`sb_secret_…`, hay que pulsar *Reveal*).
     Guárdala como **CLAVE SERVICE ROLE** (secreta).
3. Token personal: <https://supabase.com/dashboard/account/tokens> → **Generate new
   token** → nombre `github-actions` → **Generate token** → cópialo como **ACCESS TOKEN
   SUPABASE** (secreto). Solo se muestra una vez.

### 1.3 Configurar la autenticación

1. Menú izquierdo → **Authentication** → **Sign In / Providers** (o *Providers*).
   Comprueba que **Email** está *Enabled*.
2. Dentro de Email, desactiva **Confirm email** por ahora y guarda. Así la propietaria
   entra a la primera. Cuando todo funcione, puedes volver a activarlo.
3. **Authentication → URL Configuration**. Deja *Site URL* como está por el momento;
   lo cambiarás en el paso 3.4 cuando conozcas la dirección de Vercel.

### 1.4 Crear la base de datos (aplicar el esquema)

**Opción A, recomendada: desde la terminal** (así queda enlazado para las migraciones
futuras).

```bash
npx supabase login
```

Se abre el navegador; pulsa **Authorize**. Vuelve a la terminal y sigue:

```bash
npx supabase link --project-ref PEGA_AQUI_EL_PROJECT_REF
```

Te pedirá la **contraseña de la base de datos** (paso 1.1). Luego:

```bash
npx supabase db push
```

Responde `Y` cuando pregunte si aplica la migración `20260911000001_esquema_base.sql`.
Si termina con `Finished supabase db push`, listo.

> Alternativa: si prefieres, después de `npx supabase login` avísame y yo ejecuto
> `link` y `db push` desde aquí. La sesión queda guardada en tu Mac, no en el chat.

**Opción B: copiar y pegar.** Panel de Supabase → **SQL Editor** → **New query**. Abre el
archivo `supabase/migrations/20260911000001_esquema_base.sql`, copia todo, pégalo y pulsa
**Run**. Debe decir *Success*.

**Datos de prueba (opcional).** Para explorar la app con productos de ejemplo, repite la
opción B con `supabase/seed.sql`. Se borran después desde la papelera o con el SQL que
indica el propio archivo.

### 1.5 Comprobar

**Table Editor** debe mostrar las tablas `ajustes`, `auditoria`, `contactos`,
`movimientos_inventario`, `perfiles`, `precio_historial`, `producto_fotos` y
`productos`. **Storage** debe mostrar el bucket `fotos`.

---

## 2. GitHub: el código y las pruebas automáticas

### 2.1 Crear el repositorio

1. <https://github.com/new>.
   - *Repository name*: `luz-velez-accesorios`
   - **Private**.
   - No marques *Add a README* ni `.gitignore` (ya existen).
   - **Create repository**.
2. Crea un token para poder subir el código desde tu Mac:
   <https://github.com/settings/tokens> → **Generate new token (classic)** →
   *Note*: `mac`, *Expiration*: 90 días o *No expiration*, marca **repo** →
   **Generate token**. Cópialo como **TOKEN GITHUB** (secreto).

### 2.2 Subir el código

En la terminal (sustituye `TU_USUARIO` por tu usuario de GitHub):

```bash
git remote add origin https://github.com/TU_USUARIO/luz-velez-accesorios.git
```

```bash
git push -u origin main
```

Pedirá *Username* (tu usuario) y *Password*: pega el **TOKEN GITHUB**, no tu
contraseña. macOS lo guardará en el llavero para la próxima vez.

Al subir, GitHub ejecuta automáticamente las pruebas (pestaña **Actions**). El trabajo
*Lint, tipos, pruebas y compilación* debe quedar en verde; los de *migraciones* y
*despliegue* fallarán hasta que cargues los secretos del paso 2.3 y 3.

### 2.3 Cargar los secretos

Repositorio → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**. Crea uno por uno (nombre exacto, valor pegado tal cual):

| Nombre del secreto | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | SUPABASE URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CLAVE ANON |
| `SUPABASE_SERVICE_ROLE_KEY` | CLAVE SERVICE ROLE |
| `SUPABASE_ACCESS_TOKEN` | ACCESS TOKEN SUPABASE |
| `SUPABASE_PROJECT_REF` | PROJECT REF |
| `SUPABASE_DB_PASSWORD` | CONTRASEÑA BD |
| `VERCEL_TOKEN` | del paso 3.2 |
| `VERCEL_ORG_ID` | del paso 3.1 |
| `VERCEL_PROJECT_ID` | del paso 3.1 |

---

## 3. Vercel: donde vive la app

### 3.1 Cuenta y proyecto

1. <https://vercel.com/signup> → **Continue with GitHub** → plan **Hobby**.
2. En la terminal:

   ```bash
   npx vercel login
   ```

   Elige *Continue with GitHub*; se abre el navegador; confirma.

   ```bash
   npx vercel link
   ```

   Responde: *Set up?* **Y** · *Which scope?* tu cuenta · *Link to existing project?*
   **N** · *Project name?* `luz-velez-accesorios` · *In which directory is your code?*
   `./` (Enter) · si pregunta por ajustes de compilación, **N**.

3. Lee los identificadores:

   ```bash
   cat .vercel/project.json
   ```

   Copia `orgId` como **VERCEL ORG ID** y `projectId` como **VERCEL PROJECT ID**
   (públicos). Añádelos a los secretos de GitHub (paso 2.3).

### 3.2 Token

<https://vercel.com/account/settings/tokens> (o **Account Settings → Tokens**) →
*Token name* `github-actions` → *Scope* tu cuenta → *Expiration* **No expiration** →
**Create**. Cópialo como **TOKEN VERCEL** (secreto) y súbelo a GitHub como `VERCEL_TOKEN`.

### 3.3 Variables de entorno en Vercel

Panel de Vercel → proyecto `luz-velez-accesorios` → **Settings** → **Environment
Variables**. Para cada una, escribe *Key* y *Value*, deja marcados *Production*,
*Preview* y *Development*, y **Save**:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | SUPABASE URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CLAVE ANON |
| `SUPABASE_SERVICE_ROLE_KEY` | CLAVE SERVICE ROLE (marca *Sensitive* si aparece la opción) |
| `NEXT_PUBLIC_APP_URL` | `https://luz-velez-accesorios.vercel.app` (ver 3.4) |

### 3.4 Dirección pública y cierre del círculo con Supabase

1. En Vercel → **Settings → Domains** verás la dirección asignada, normalmente
   `https://luz-velez-accesorios.vercel.app`. Si Vercel añadió un sufijo (por ejemplo
   `-abc123`), usa la que aparezca ahí. Esa es la **URL DE LA APP**.
2. Vuelve a Supabase → **Authentication → URL Configuration**:
   - *Site URL*: la URL DE LA APP.
   - *Redirect URLs* → **Add URL**: `https://TU-URL/auth/callback` y también
     `http://localhost:3000/auth/callback` (para pruebas en el computador).
   - **Save**.
3. Si la URL real es distinta de la que pusiste en `NEXT_PUBLIC_APP_URL`, corrígela en
   Vercel.

### 3.5 Evitar dobles despliegues

Vercel, al enlazar con GitHub, puede desplegar por su cuenta en cada push, sin esperar a
las pruebas. Para que solo publique GitHub Actions cuando todo pasa:
proyecto → **Settings → Git** → si aparece un repositorio conectado, **Disconnect**.
(Con `vercel link` desde la terminal normalmente no queda conectado; comprueba y sigue.)

### 3.6 Primer despliegue

Con los nueve secretos cargados en GitHub: repositorio → **Actions** → flujo **CI y
despliegue** → **Run workflow** → **Run workflow**. En 3 a 5 minutos los tres trabajos
(*verificar*, *migrar*, *desplegar*) deben estar en verde. Abre la URL DE LA APP: debe
aparecer la pantalla de ingreso.

Si un trabajo falla, ábrelo y copia el texto rojo en el chat; casi siempre es un secreto
mal escrito.

---

## 4. La cuenta de la propietaria

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
2. *Email*: el correo de la propietaria. *Password*: una contraseña de al menos 8
   caracteres (anótala para ella). Marca **Auto Confirm User** si aparece. **Create user**.
3. **La primera cuenta creada queda como propietaria automáticamente.** Todas las
   siguientes entran como ayudantes; se cambia desde la app en *Ajustes → Usuarias*.
4. Entra en la URL DE LA APP con ese correo y contraseña. Debe abrir el tablero de
   inicio. Ve a **Ajustes** y revisa nombre del negocio, regla de precios, impresora y
   demás.
5. En el celular de la propietaria: abre la URL en Chrome (Android) o Safari (iPhone) y
   usa **Añadir a pantalla de inicio**. Queda como una app.

Para una ayudante: desde la app, *Ajustes → Usuarias → Invitar a una ayudante* (recibe
un correo con enlace), o desde Supabase igual que arriba.

---

## 5. Uso diario y mantenimiento

- **Cada cambio que haga Claude** en el código se sube con `git push` y se publica solo
  si pasan las pruebas.
- **Supabase no se pausa**: el flujo *Mantener activo Supabase* consulta la base lunes y
  jueves. Puedes verlo en GitHub → Actions.
- **Si Supabase avisa por correo que va a pausar el proyecto** (no debería), entra al
  panel y pulsa *Restore*. Y avísame para revisar el flujo.
- **Para trabajar en local** (probar sin publicar): crea `.env.local` copiando
  `.env.example` y pegando SUPABASE URL, CLAVE ANON y CLAVE SERVICE ROLE; luego
  `npm run dev` y abre <http://localhost:3000>.

## Resumen de lo que necesito que me pases por el chat

Solo datos públicos: **PROJECT REF**, **SUPABASE URL**, **CLAVE ANON** y **URL DE LA
APP**, más una confirmación de que hiciste `npx supabase login` y `npx vercel login`.
Con eso puedo terminar de enlazar, aplicar migraciones, cargar datos de prueba y probar
la app en vivo. Las claves secretas no me las mandes: van solo en GitHub, Vercel y
`.env.local`.
