-- =============================================================================
-- Luzazul Accesorios · Migración 1: esquema base (Fase 1)
--
-- Contiene: perfiles y roles, ajustes del negocio, contactos, productos con
-- fotos e historial de precios, movimientos de inventario con stock calculado
-- por disparador, auditoría, borrado lógico con papelera y políticas RLS.
--
-- Convenciones:
--   · Tablas y columnas en español, en minúsculas y con guion bajo.
--   · Dinero en enteros (pesos colombianos sin decimales).
--   · Fechas en timestamptz; la zona horaria se aplica al mostrar.
--   · Borrado lógico: columna eliminado_en. Los registros con eliminado_en
--     distinto de null están en la papelera y no se muestran en la app.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.rol_usuario as enum ('propietaria', 'ayudante');

create type public.categoria_producto as enum ('areta', 'collar', 'pulsera', 'anillo', 'otro');

create type public.tipo_contacto as enum ('cliente', 'vendedora', 'mayorista', 'proveedor');

create type public.tipo_movimiento as enum (
  'entrada_compra',        -- entra mercancía comprada
  'salida_venta',          -- sale por venta directa
  'salida_consignacion',   -- sale entregada en consignación
  'retorno_consignacion',  -- vuelve lo no vendido de una consignación
  'ajuste_entrada',        -- ajuste manual que suma
  'ajuste_salida',         -- ajuste manual que resta
  'perdida',               -- pérdida o daño
  'obsequio'               -- regalo
);

create type public.tipo_precio as enum ('base', 'publico', 'mayorista', 'costo');

create type public.accion_auditoria as enum ('crear', 'editar', 'borrar', 'restaurar');

-- -----------------------------------------------------------------------------
-- 2. Funciones de apoyo
-- -----------------------------------------------------------------------------

-- Signo de un movimiento: +1 suma al stock, -1 resta.
create or replace function public.signo_movimiento(t public.tipo_movimiento)
returns integer
language sql immutable as $$
  select case t
    when 'entrada_compra'       then 1
    when 'retorno_consignacion' then 1
    when 'ajuste_entrada'       then 1
    else -1
  end;
$$;

-- Actualiza actualizado_en en cada UPDATE.
create or replace function public.marcar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Perfiles y roles
-- -----------------------------------------------------------------------------
create table public.perfiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  nombre       text not null default '',
  correo       text not null default '',
  rol          public.rol_usuario not null default 'ayudante',
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger perfiles_actualizado before update on public.perfiles
  for each row execute function public.marcar_actualizado();

-- La primera persona que se registra es la propietaria; las siguientes, ayudantes.
create or replace function public.crear_perfil_para_usuario()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hay_propietaria boolean;
begin
  select exists (select 1 from public.perfiles where rol = 'propietaria') into hay_propietaria;
  insert into public.perfiles (id, nombre, correo, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    case when hay_propietaria then 'ayudante'::public.rol_usuario else 'propietaria'::public.rol_usuario end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger crear_perfil_al_registrar
  after insert on auth.users
  for each row execute function public.crear_perfil_para_usuario();

-- Rol del usuario autenticado (null si no hay sesión).
create or replace function public.rol_actual()
returns public.rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo;
$$;

create or replace function public.es_propietaria()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = 'propietaria', false);
$$;

create or replace function public.es_usuaria_activa()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.rol_actual() is not null;
$$;

-- -----------------------------------------------------------------------------
-- 4. Ajustes del negocio (una sola fila, id = 1)
-- -----------------------------------------------------------------------------
create table public.ajustes (
  id                       integer primary key default 1 check (id = 1),
  nombre_negocio           text not null default 'Luzazul Accesorios',
  telefono_negocio         text not null default '',
  -- Códigos
  prefijo_general          text not null default 'SLA',
  prefijo_pulsera          text not null default 'SLAP',
  -- Precio al público: 'manual' (pieza por pieza) o 'multiplicador' (base × factor, redondeado)
  regla_precio_publico     text not null default 'manual' check (regla_precio_publico in ('manual', 'multiplicador')),
  factor_precio_publico    numeric(8,4) not null default 3.0,
  -- Redondeo del precio calculado: 'ninguno', 'centena' (a 100), 'mil' (a 1.000), 'terminacion_900' (…900)
  redondeo_precio_publico  text not null default 'terminacion_900'
    check (redondeo_precio_publico in ('ninguno', 'centena', 'mil', 'terminacion_900')),
  stock_minimo_predeterminado integer not null default 2 check (stock_minimo_predeterminado >= 0),
  -- Etiqueta e impresora
  impresora_modelo         text not null default '',      -- p. ej. D110, B1, B21
  etiqueta_ancho_mm        numeric(6,2) not null default 30,
  etiqueta_alto_mm         numeric(6,2) not null default 15,
  etiqueta_dpi             integer not null default 203,
  etiqueta_mostrar_precio_miles boolean not null default true, -- «SLA013 40»
  etiqueta_lineas          jsonb not null default '["negocio","descripcion","codigo_precio","precio_publico"]'::jsonb,
  -- Catálogo público
  catalogo_publico_activo  boolean not null default false,
  catalogo_slug            text not null default 'catalogo',
  -- Respaldos
  respaldo_destino         text not null default 'ninguno' check (respaldo_destino in ('ninguno', 'r2', 'drive')),
  ultimo_respaldo_en       timestamptz,
  ultimo_respaldo_detalle  text,
  actualizado_en           timestamptz not null default now()
);

insert into public.ajustes (id) values (1);

create trigger ajustes_actualizado before update on public.ajustes
  for each row execute function public.marcar_actualizado();

-- -----------------------------------------------------------------------------
-- 5. Contactos
-- -----------------------------------------------------------------------------
create table public.contactos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (length(trim(nombre)) > 0),
  telefono      text not null default '',
  tipo          public.tipo_contacto not null default 'cliente',
  direccion     text not null default '',
  notas         text not null default '',
  creado_por    uuid references public.perfiles (id),
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en  timestamptz
);

create index contactos_nombre_idx on public.contactos (lower(nombre)) where eliminado_en is null;
create index contactos_tipo_idx on public.contactos (tipo) where eliminado_en is null;

create trigger contactos_actualizado before update on public.contactos
  for each row execute function public.marcar_actualizado();

-- -----------------------------------------------------------------------------
-- 6. Productos
-- -----------------------------------------------------------------------------
create table public.productos (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null check (codigo ~ '^[A-Z0-9-]{2,20}$'),
  nombre            text not null check (length(trim(nombre)) > 0),
  categoria         public.categoria_producto not null default 'otro',
  subcategoria      text not null default '',
  material          text not null default '',
  color             text not null default '',
  precio_base       integer not null default 0 check (precio_base >= 0),
  precio_publico    integer not null default 0 check (precio_publico >= 0),
  precio_mayorista  integer check (precio_mayorista is null or precio_mayorista >= 0),
  costo_compra      integer check (costo_compra is null or costo_compra >= 0),
  stock_actual      integer not null default 0,
  stock_minimo      integer not null default 2 check (stock_minimo >= 0),
  proveedor_id      uuid references public.contactos (id),
  activo            boolean not null default true,        -- false = descontinuado
  visible_catalogo  boolean not null default false,
  notas             text not null default '',
  creado_por        uuid references public.perfiles (id),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  eliminado_en      timestamptz
);

-- El código es único entre los productos que no están en la papelera.
create unique index productos_codigo_unico on public.productos (codigo) where eliminado_en is null;
create index productos_nombre_idx on public.productos (lower(nombre)) where eliminado_en is null;
create index productos_categoria_idx on public.productos (categoria) where eliminado_en is null;
create index productos_stock_idx on public.productos (stock_actual) where eliminado_en is null;

create trigger productos_actualizado before update on public.productos
  for each row execute function public.marcar_actualizado();

-- El stock no se edita a mano: si un UPDATE trae otro stock_actual sin venir del
-- recálculo por movimientos, se ignora en silencio y se conserva el anterior.
create or replace function public.proteger_stock_actual()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.recalculando_stock', true), '') <> '1' then
    new.stock_actual := old.stock_actual;
  end if;
  return new;
end;
$$;

create trigger productos_proteger_stock before update on public.productos
  for each row execute function public.proteger_stock_actual();

-- Siguiente código libre para un prefijo. Solo cuenta códigos con exactamente
-- ese prefijo seguido de dígitos, de modo que SLA y SLAP no se mezclan.
create or replace function public.siguiente_codigo(prefijo text, digitos integer default 3)
returns text
language plpgsql stable as $$
declare
  maximo integer;
begin
  select coalesce(max(substring(codigo from length(prefijo) + 1)::integer), 0)
    into maximo
    from public.productos
   where codigo ~ ('^' || prefijo || '[0-9]+$');
  return prefijo || lpad((maximo + 1)::text, digitos, '0');
end;
$$;

-- Fotos de producto (varias por producto, una principal).
create table public.producto_fotos (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references public.productos (id) on delete cascade,
  ruta           text not null,           -- ruta en el bucket «fotos»
  ruta_miniatura text not null,
  principal      boolean not null default false,
  orden          integer not null default 0,
  ancho          integer,
  alto           integer,
  bytes          integer,
  creado_por     uuid references public.perfiles (id),
  creado_en      timestamptz not null default now()
);

create index producto_fotos_producto_idx on public.producto_fotos (producto_id, orden);
-- Solo una foto principal por producto.
create unique index producto_fotos_principal_unica on public.producto_fotos (producto_id) where principal;

-- Historial de cambios de precio.
create table public.precio_historial (
  id             bigint generated always as identity primary key,
  producto_id    uuid not null references public.productos (id) on delete cascade,
  tipo           public.tipo_precio not null,
  valor_anterior integer,
  valor_nuevo    integer,
  cambiado_por   uuid references public.perfiles (id),
  cambiado_en    timestamptz not null default now()
);

create index precio_historial_producto_idx on public.precio_historial (producto_id, cambiado_en desc);

create or replace function public.registrar_cambio_precio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.precio_historial (producto_id, tipo, valor_anterior, valor_nuevo, cambiado_por)
    values (new.id, 'base', null, new.precio_base, auth.uid()),
           (new.id, 'publico', null, new.precio_publico, auth.uid());
    if new.precio_mayorista is not null then
      insert into public.precio_historial (producto_id, tipo, valor_anterior, valor_nuevo, cambiado_por)
      values (new.id, 'mayorista', null, new.precio_mayorista, auth.uid());
    end if;
    if new.costo_compra is not null then
      insert into public.precio_historial (producto_id, tipo, valor_anterior, valor_nuevo, cambiado_por)
      values (new.id, 'costo', null, new.costo_compra, auth.uid());
    end if;
    return new;
  end if;

  if new.precio_base is distinct from old.precio_base then
    insert into public.precio_historial (producto_id, tipo, valor_anterior, valor_nuevo, cambiado_por)
    values (new.id, 'base', old.precio_base, new.precio_base, auth.uid());
  end if;
  if new.precio_publico is distinct from old.precio_publico then
    insert into public.precio_historial (producto_id, tipo, valor_anterior, valor_nuevo, cambiado_por)
    values (new.id, 'publico', old.precio_publico, new.precio_publico, auth.uid());
  end if;
  if new.precio_mayorista is distinct from old.precio_mayorista then
    insert into public.precio_historial (producto_id, tipo, valor_anterior, valor_nuevo, cambiado_por)
    values (new.id, 'mayorista', old.precio_mayorista, new.precio_mayorista, auth.uid());
  end if;
  if new.costo_compra is distinct from old.costo_compra then
    insert into public.precio_historial (producto_id, tipo, valor_anterior, valor_nuevo, cambiado_por)
    values (new.id, 'costo', old.costo_compra, new.costo_compra, auth.uid());
  end if;
  return new;
end;
$$;

create trigger productos_historial_precio
  after insert or update on public.productos
  for each row execute function public.registrar_cambio_precio();

-- -----------------------------------------------------------------------------
-- 7. Movimientos de inventario
-- -----------------------------------------------------------------------------
create table public.movimientos_inventario (
  id              uuid primary key default gen_random_uuid(),
  tipo            public.tipo_movimiento not null,
  producto_id     uuid not null references public.productos (id),
  cantidad        integer not null check (cantidad > 0),
  valor_unitario  integer not null default 0 check (valor_unitario >= 0),
  -- Documento origen (venta, consignación, compra…), se llena en fases siguientes.
  documento_tipo  text,
  documento_id    uuid,
  fecha           timestamptz not null default now(),
  nota            text not null default '',
  registrado_por  uuid references public.perfiles (id),
  creado_en       timestamptz not null default now(),
  eliminado_en    timestamptz
);

create index movimientos_producto_idx on public.movimientos_inventario (producto_id, fecha desc) where eliminado_en is null;
create index movimientos_fecha_idx on public.movimientos_inventario (fecha desc) where eliminado_en is null;
create index movimientos_documento_idx on public.movimientos_inventario (documento_tipo, documento_id) where eliminado_en is null;

-- Stock = suma de signo × cantidad de los movimientos no eliminados.
create or replace function public.stock_calculado(p_producto_id uuid)
returns integer
language sql stable as $$
  select coalesce(sum(public.signo_movimiento(tipo) * cantidad), 0)::integer
    from public.movimientos_inventario
   where producto_id = p_producto_id and eliminado_en is null;
$$;

create or replace function public.recalcular_stock(p_producto_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.recalculando_stock', '1', true);
  update public.productos
     set stock_actual = public.stock_calculado(p_producto_id)
   where id = p_producto_id;
  perform set_config('app.recalculando_stock', '', true);
end;
$$;

-- Recalcula el stock de todos los productos (útil tras restaurar un respaldo).
create or replace function public.recalcular_todo_el_stock()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  r record;
begin
  for r in select id from public.productos loop
    perform public.recalcular_stock(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.movimiento_recalcula_stock()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_stock(old.producto_id);
    return old;
  end if;
  perform public.recalcular_stock(new.producto_id);
  if tg_op = 'UPDATE' and new.producto_id <> old.producto_id then
    perform public.recalcular_stock(old.producto_id);
  end if;
  return new;
end;
$$;

create trigger movimientos_recalculan_stock
  after insert or update or delete on public.movimientos_inventario
  for each row execute function public.movimiento_recalcula_stock();

-- Las salidas no pueden dejar el stock en negativo (salvo ajustes, que corrigen errores).
create or replace function public.validar_stock_suficiente()
returns trigger language plpgsql as $$
declare
  disponible integer;
begin
  if new.eliminado_en is not null then
    return new;
  end if;
  if public.signo_movimiento(new.tipo) < 0 and new.tipo not in ('ajuste_salida') then
    select public.stock_calculado(new.producto_id) into disponible;
    if tg_op = 'UPDATE' and old.eliminado_en is null then
      disponible := disponible - public.signo_movimiento(old.tipo) * old.cantidad;
    end if;
    if disponible - new.cantidad < 0 then
      raise exception 'STOCK_INSUFICIENTE: el producto solo tiene % unidades y se intentan sacar %', disponible, new.cantidad
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger movimientos_validar_stock
  before insert or update on public.movimientos_inventario
  for each row execute function public.validar_stock_suficiente();

-- -----------------------------------------------------------------------------
-- 8. Auditoría genérica
-- -----------------------------------------------------------------------------
create table public.auditoria (
  id               bigint generated always as identity primary key,
  tabla            text not null,
  registro_id      text not null,
  accion           public.accion_auditoria not null,
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  usuario_id       uuid,
  fecha            timestamptz not null default now()
);

create index auditoria_registro_idx on public.auditoria (tabla, registro_id, fecha desc);
create index auditoria_fecha_idx on public.auditoria (fecha desc);

create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  accion public.accion_auditoria;
  anterior jsonb;
  nuevo jsonb;
  clave text;
begin
  if tg_op = 'INSERT' then
    accion := 'crear'; nuevo := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    accion := 'borrar'; anterior := to_jsonb(old);
  else
    anterior := to_jsonb(old); nuevo := to_jsonb(new);
    if (anterior ? 'eliminado_en') and (anterior ->> 'eliminado_en') is null and (nuevo ->> 'eliminado_en') is not null then
      accion := 'borrar';
    elsif (anterior ? 'eliminado_en') and (anterior ->> 'eliminado_en') is not null and (nuevo ->> 'eliminado_en') is null then
      accion := 'restaurar';
    else
      accion := 'editar';
    end if;
  end if;
  clave := coalesce(nuevo ->> 'id', anterior ->> 'id');
  insert into public.auditoria (tabla, registro_id, accion, datos_anteriores, datos_nuevos, usuario_id)
  values (tg_table_name, clave, accion, anterior, nuevo, auth.uid());
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger auditar_productos after insert or update or delete on public.productos
  for each row execute function public.auditar();
create trigger auditar_contactos after insert or update or delete on public.contactos
  for each row execute function public.auditar();
create trigger auditar_movimientos after insert or update or delete on public.movimientos_inventario
  for each row execute function public.auditar();
create trigger auditar_ajustes after update on public.ajustes
  for each row execute function public.auditar();
create trigger auditar_perfiles after update on public.perfiles
  for each row execute function public.auditar();

-- -----------------------------------------------------------------------------
-- 9. Papelera: borrado lógico, restauración y purga a los 30 días
-- -----------------------------------------------------------------------------

-- Solo la propietaria mueve registros a la papelera o los restaura.
create or replace function public.solo_propietaria_borra()
returns trigger language plpgsql as $$
begin
  if new.eliminado_en is distinct from old.eliminado_en and not public.es_propietaria() then
    raise exception 'SIN_PERMISO: solo la propietaria puede borrar o restaurar registros'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger productos_borrado_solo_propietaria before update on public.productos
  for each row execute function public.solo_propietaria_borra();
create trigger contactos_borrado_solo_propietaria before update on public.contactos
  for each row execute function public.solo_propietaria_borra();
create trigger movimientos_borrado_solo_propietaria before update on public.movimientos_inventario
  for each row execute function public.solo_propietaria_borra();

-- Elimina definitivamente lo que lleve más de 30 días en la papelera.
create or replace function public.purgar_papelera(dias integer default 30)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  total integer := 0;
  n integer;
begin
  delete from public.movimientos_inventario where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.productos p
   where p.eliminado_en < now() - make_interval(days => dias)
     and not exists (select 1 from public.movimientos_inventario m where m.producto_id = p.id);
  get diagnostics n = row_count; total := total + n;
  delete from public.contactos c
   where c.eliminado_en < now() - make_interval(days => dias)
     and not exists (select 1 from public.productos p where p.proveedor_id = c.id);
  get diagnostics n = row_count; total := total + n;
  return total;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Vistas de consulta
-- -----------------------------------------------------------------------------

-- Productos sin movimiento en los últimos 90 días (o nunca).
create or replace view public.productos_sin_movimiento as
  select p.*, max(m.fecha) as ultimo_movimiento
    from public.productos p
    left join public.movimientos_inventario m
      on m.producto_id = p.id and m.eliminado_en is null
   where p.eliminado_en is null and p.activo
   group by p.id
  having coalesce(max(m.fecha), p.creado_en) < now() - interval '90 days';

-- Papelera unificada.
create or replace view public.papelera as
  select 'productos'::text as tabla, id, codigo || ' · ' || nombre as descripcion, eliminado_en from public.productos where eliminado_en is not null
  union all
  select 'contactos', id, nombre, eliminado_en from public.contactos where eliminado_en is not null
  union all
  select 'movimientos_inventario', m.id, m.tipo::text || ' · ' || p.codigo || ' × ' || m.cantidad, m.eliminado_en
    from public.movimientos_inventario m join public.productos p on p.id = m.producto_id
   where m.eliminado_en is not null;

-- -----------------------------------------------------------------------------
-- 11. Seguridad a nivel de fila (RLS)
-- -----------------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.ajustes enable row level security;
alter table public.contactos enable row level security;
alter table public.productos enable row level security;
alter table public.producto_fotos enable row level security;
alter table public.precio_historial enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.auditoria enable row level security;

-- perfiles: todas las usuarias activas ven los perfiles; cada una edita su nombre;
-- la propietaria edita rol y estado.
create policy perfiles_ver on public.perfiles for select to authenticated using (public.es_usuaria_activa());
create policy perfiles_editar_propio on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and rol = (select rol from public.perfiles where id = auth.uid()) and activo = (select activo from public.perfiles where id = auth.uid()));
create policy perfiles_editar_propietaria on public.perfiles for update to authenticated
  using (public.es_propietaria()) with check (public.es_propietaria());

-- ajustes: todas leen; solo la propietaria edita.
create policy ajustes_ver on public.ajustes for select to authenticated using (public.es_usuaria_activa());
create policy ajustes_editar on public.ajustes for update to authenticated using (public.es_propietaria()) with check (public.es_propietaria());

-- contactos, productos, fotos, movimientos: leen y escriben ambas; el borrado
-- lógico lo controla el disparador solo_propietaria_borra; el borrado físico no
-- se permite desde la app (lo hace purgar_papelera).
create policy contactos_ver on public.contactos for select to authenticated using (public.es_usuaria_activa());
create policy contactos_crear on public.contactos for insert to authenticated with check (public.es_usuaria_activa());
create policy contactos_editar on public.contactos for update to authenticated using (public.es_usuaria_activa()) with check (public.es_usuaria_activa());

create policy productos_ver on public.productos for select to authenticated using (public.es_usuaria_activa());
create policy productos_crear on public.productos for insert to authenticated with check (public.es_usuaria_activa());
create policy productos_editar on public.productos for update to authenticated using (public.es_usuaria_activa()) with check (public.es_usuaria_activa());

create policy fotos_ver on public.producto_fotos for select to authenticated using (public.es_usuaria_activa());
create policy fotos_crear on public.producto_fotos for insert to authenticated with check (public.es_usuaria_activa());
create policy fotos_editar on public.producto_fotos for update to authenticated using (public.es_usuaria_activa()) with check (public.es_usuaria_activa());
create policy fotos_borrar on public.producto_fotos for delete to authenticated using (public.es_usuaria_activa());

create policy movimientos_ver on public.movimientos_inventario for select to authenticated using (public.es_usuaria_activa());
create policy movimientos_crear on public.movimientos_inventario for insert to authenticated with check (public.es_usuaria_activa());
create policy movimientos_editar on public.movimientos_inventario for update to authenticated using (public.es_propietaria()) with check (public.es_propietaria());

-- historial de precios y auditoría: solo la propietaria (contabilidad).
create policy precio_historial_ver on public.precio_historial for select to authenticated using (public.es_propietaria());
create policy auditoria_ver on public.auditoria for select to authenticated using (public.es_propietaria());

-- Catálogo público: lectura anónima limitada a productos visibles, a través de una
-- vista que oculta stock, costos y precio base.
create or replace view public.catalogo_publico
with (security_invoker = false) as
  select p.id, p.codigo, p.nombre, p.categoria, p.material, p.color, p.precio_publico,
         (select f.ruta from public.producto_fotos f where f.producto_id = p.id order by f.principal desc, f.orden limit 1) as foto,
         (select f.ruta_miniatura from public.producto_fotos f where f.producto_id = p.id order by f.principal desc, f.orden limit 1) as miniatura
    from public.productos p
   where p.eliminado_en is null and p.activo and p.visible_catalogo
     and (select catalogo_publico_activo from public.ajustes where id = 1);

grant select on public.catalogo_publico to anon, authenticated;
grant select on public.productos_sin_movimiento to authenticated;
grant select on public.papelera to authenticated;

-- -----------------------------------------------------------------------------
-- 12. Almacenamiento de fotos (bucket público de solo lectura para anónimos)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy fotos_bucket_leer on storage.objects for select using (bucket_id = 'fotos');
create policy fotos_bucket_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_usuaria_activa());
create policy fotos_bucket_actualizar on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_usuaria_activa());
create policy fotos_bucket_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_usuaria_activa());

-- -----------------------------------------------------------------------------
-- 13. Tareas programadas en la base (pg_cron está disponible en Supabase)
-- -----------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('purgar-papelera-diaria', '15 3 * * *', $cron$ select public.purgar_papelera(30) $cron$);
exception when others then
  raise notice 'pg_cron no disponible en este entorno: la purga de la papelera se hará desde GitHub Actions (%)', sqlerrm;
end;
$$;
