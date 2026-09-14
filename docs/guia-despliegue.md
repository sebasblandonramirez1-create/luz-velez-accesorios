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

## 2. GitHub: el código (10 minutos)

1. Entra en <https://github.com/new>.
   - *Repository name*: `luz-velez-accesorios`
   - Marca **Private**.
   - No marques nada más. Pulsa **Create repository**.
2. Crea la «contraseña» para subir código: <https://github.com/settings/tokens> →
   **Generate new token** → **Generate new token (classic)** → *Note*: `mac` →
   *Expiration*: **No expiration** → marca la casilla **repo** → abajo, **Generate
   token**. Copia el texto que empieza por `ghp_` en tu bloc de notas (secreto).
3. En la terminal (cambia `TU_USUARIO` por tu usuario de GitHub):

   ```bash
   cd ~/Documents/Claude/Projects/luz-velez-accesorios
   git remote add origin https://github.com/TU_USUARIO/luz-velez-accesorios.git
   git push -u origin main
   ```

   Pedirá *Username*: tu usuario. *Password*: pega el token `ghp_…` (no se ve al
   escribir; pulsa Enter). macOS lo recuerda para las próximas veces.

Listo. No hay que crear secretos: las pruebas y la tarea de mantener activo Supabase
funcionan solas. Puedes verlas en la pestaña **Actions** del repositorio.

## 3. Vercel: publicar la app (10 minutos)

1. Entra en <https://vercel.com/signup> → **Continue with GitHub** → autoriza → plan
   **Hobby**.
2. En el panel, **Add New…** → **Project**. En la lista *Import Git Repository* busca
   `luz-velez-accesorios` y pulsa **Import**. Si no aparece, pulsa *Adjust GitHub App
   Permissions* y dale acceso a ese repositorio.
3. En la pantalla de configuración, abre **Environment Variables** y añade cuatro, una
   por una (*Key* → *Value* → **Add**):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://tklopxvtbwzdgseacqyw.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_VKktmSYVsPQ8Egf0hox2zw_UREyov6g` |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clave `sb_secret_…` **nueva** (de tu bloc de notas) |
   | `NEXT_PUBLIC_APP_URL` | `https://luzazul-accesorios.vercel.app` |

4. Pulsa **Deploy**. Espera 2 o 3 minutos hasta ver confeti y una vista previa.
5. Pulsa **Continue to Dashboard**. Arriba verás la dirección real (*Domains*), por
   ejemplo `luzazul-accesorios.vercel.app`. Cópiala y mándasela a Claude por el chat:
   con eso se registran las direcciones de autenticación en Supabase y se comprueba el
   ingreso. Si la dirección tiene un sufijo distinto, corrige `NEXT_PUBLIC_APP_URL` en
   *Settings → Environment Variables* y vuelve a desplegar (*Deployments → ⋯ →
   Redeploy*).

Desde ahora, cada cambio que Claude suba a GitHub se publica solo.

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

Solo la **URL DE LA APP** que asigne Vercel. Las claves secretas no me las mandes: van
solo en Vercel y en `.env.local`.
