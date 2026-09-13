-- =============================================================================
-- Migración 4 (Fase 2): ventas directas, consignaciones con liquidación,
-- cuentas por cobrar y abonos.
--
-- Reglas que garantiza la base de datos:
--   · Cada línea de venta genera su salida de inventario; cada línea de entrega
--     en consignación, su salida; cada devolución liquidada, su retorno.
--   · En una consignación, vendido + devuelto + pendiente = entregado, siempre.
--   · Toda venta y toda consignación tienen una cuenta por cobrar; los pagos son
--     abonos. Una venta «pagada» es una venta con un abono por el total.
--   · Enviar a la papelera una venta o consignación anula sus movimientos y su
--     cuenta; restaurarla los devuelve.
-- =============================================================================

create type public.medio_pago as enum ('efectivo', 'transferencia', 'nequi', 'daviplata', 'tarjeta', 'otro');
create type public.estado_consignacion as enum ('abierta', 'parcial', 'cerrada');
create type public.estado_cuenta as enum ('abierta', 'pagada');
create type public.origen_cuenta as enum ('venta', 'consignacion');

-- Numeración legible (V-0001, C-0001) independiente de los uuid.
create sequence public.ventas_numero_seq;
create sequence public.consignaciones_numero_seq;

-- -----------------------------------------------------------------------------
-- 1. Ventas directas
-- -----------------------------------------------------------------------------
create table public.ventas (
  id              uuid primary key default gen_random_uuid(),
  numero          integer not null default nextval('public.ventas_numero_seq'),
  fecha           timestamptz not null default now(),
  contacto_id     uuid references public.contactos (id),
  subtotal        integer not null default 0 check (subtotal >= 0),
  descuento_total integer not null default 0 check (descuento_total >= 0),
  total           integer not null default 0 check (total >= 0),
  medio_pago      public.medio_pago not null default 'efectivo',
  nota            text not null default '',
  registrado_por  uuid references public.perfiles (id),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminado_en    timestamptz
);
create index ventas_fecha_idx on public.ventas (fecha desc) where eliminado_en is null;
create index ventas_contacto_idx on public.ventas (contacto_id) where eliminado_en is null;
create trigger ventas_actualizado before update on public.ventas for each row execute function public.marcar_actualizado();

create table public.venta_lineas (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references public.ventas (id) on delete cascade,
  producto_id     uuid not null references public.productos (id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0),
  descuento       integer not null default 0 check (descuento >= 0),
  subtotal        integer generated always as (cantidad * precio_unitario - descuento) stored,
  creado_en       timestamptz not null default now()
);
create index venta_lineas_venta_idx on public.venta_lineas (venta_id);
create index venta_lineas_producto_idx on public.venta_lineas (producto_id);

-- -----------------------------------------------------------------------------
-- 2. Consignaciones
-- -----------------------------------------------------------------------------
create table public.consignaciones (
  id              uuid primary key default gen_random_uuid(),
  numero          integer not null default nextval('public.consignaciones_numero_seq'),
  contacto_id     uuid not null references public.contactos (id),
  fecha_entrega   timestamptz not null default now(),
  estado          public.estado_consignacion not null default 'abierta',
  total_entregado integer not null default 0,
  total_vendido   integer not null default 0,
  total_devuelto  integer not null default 0,
  total_pendiente integer not null default 0,
  nota            text not null default '',
  registrado_por  uuid references public.perfiles (id),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminado_en    timestamptz
);
create index consignaciones_contacto_idx on public.consignaciones (contacto_id, fecha_entrega desc) where eliminado_en is null;
create index consignaciones_estado_idx on public.consignaciones (estado) where eliminado_en is null;
create trigger consignaciones_actualizado before update on public.consignaciones for each row execute function public.marcar_actualizado();

create table public.consignacion_lineas (
  id                 uuid primary key default gen_random_uuid(),
  consignacion_id    uuid not null references public.consignaciones (id) on delete cascade,
  producto_id        uuid not null references public.productos (id),
  cantidad_entregada integer not null check (cantidad_entregada > 0),
  valor_unitario     integer not null check (valor_unitario >= 0),
  cantidad_vendida   integer not null default 0 check (cantidad_vendida >= 0),
  cantidad_devuelta  integer not null default 0 check (cantidad_devuelta >= 0),
  cantidad_pendiente integer generated always as (cantidad_entregada - cantidad_vendida - cantidad_devuelta) stored,
  creado_en          timestamptz not null default now(),
  constraint consignacion_lineas_cuadre check (cantidad_vendida + cantidad_devuelta <= cantidad_entregada)
);
create index consignacion_lineas_consignacion_idx on public.consignacion_lineas (consignacion_id);
create index consignacion_lineas_producto_idx on public.consignacion_lineas (producto_id);

-- Cada liquidación es una visita: qué se vendió y qué se devolvió desde la anterior.
create table public.liquidaciones (
  id              uuid primary key default gen_random_uuid(),
  consignacion_id uuid not null references public.consignaciones (id) on delete cascade,
  fecha           timestamptz not null default now(),
  total_vendido   integer not null default 0,
  nota            text not null default '',
  registrado_por  uuid references public.perfiles (id),
  creado_en       timestamptz not null default now(),
  eliminado_en    timestamptz
);
create index liquidaciones_consignacion_idx on public.liquidaciones (consignacion_id, fecha desc);

create table public.liquidacion_lineas (
  id                   uuid primary key default gen_random_uuid(),
  liquidacion_id       uuid not null references public.liquidaciones (id) on delete cascade,
  consignacion_linea_id uuid not null references public.consignacion_lineas (id),
  cantidad_vendida     integer not null default 0 check (cantidad_vendida >= 0),
  cantidad_devuelta    integer not null default 0 check (cantidad_devuelta >= 0),
  check (cantidad_vendida + cantidad_devuelta > 0)
);
create index liquidacion_lineas_liq_idx on public.liquidacion_lineas (liquidacion_id);
create index liquidacion_lineas_linea_idx on public.liquidacion_lineas (consignacion_linea_id);

-- -----------------------------------------------------------------------------
-- 3. Cuentas por cobrar y abonos
-- -----------------------------------------------------------------------------
create table public.cuentas_por_cobrar (
  id            uuid primary key default gen_random_uuid(),
  contacto_id   uuid references public.contactos (id),
  origen_tipo   public.origen_cuenta not null,
  origen_id     uuid not null,
  fecha         timestamptz not null default now(),
  valor_total   integer not null default 0 check (valor_total >= 0),
  abonado       integer not null default 0 check (abonado >= 0),
  saldo         integer generated always as (valor_total - abonado) stored,
  estado        public.estado_cuenta not null default 'abierta',
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en  timestamptz,
  unique (origen_tipo, origen_id)
);
create index cuentas_contacto_idx on public.cuentas_por_cobrar (contacto_id) where eliminado_en is null;
create index cuentas_estado_idx on public.cuentas_por_cobrar (estado) where eliminado_en is null;
create trigger cuentas_actualizado before update on public.cuentas_por_cobrar for each row execute function public.marcar_actualizado();

create table public.abonos (
  id             uuid primary key default gen_random_uuid(),
  cuenta_id      uuid not null references public.cuentas_por_cobrar (id) on delete cascade,
  fecha          timestamptz not null default now(),
  valor          integer not null check (valor > 0),
  medio_pago     public.medio_pago not null default 'efectivo',
  nota           text not null default '',
  registrado_por uuid references public.perfiles (id),
  creado_en      timestamptz not null default now(),
  eliminado_en   timestamptz
);
create index abonos_cuenta_idx on public.abonos (cuenta_id, fecha desc) where eliminado_en is null;
create index abonos_fecha_idx on public.abonos (fecha desc) where eliminado_en is null;

-- -----------------------------------------------------------------------------
-- 4. Funciones de recálculo
-- -----------------------------------------------------------------------------

create or replace function public.recalcular_cuenta(p_cuenta_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  suma integer;
begin
  select coalesce(sum(valor), 0) into suma from public.abonos where cuenta_id = p_cuenta_id and eliminado_en is null;
  update public.cuentas_por_cobrar
     set abonado = suma,
         estado = case when valor_total - suma <= 0 then 'pagada'::public.estado_cuenta else 'abierta'::public.estado_cuenta end
   where id = p_cuenta_id;
end;
$$;

create or replace function public.recalcular_venta(p_venta_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_subtotal integer;
  v_descuento integer;
  v_contacto uuid;
  v_fecha timestamptz;
  v_eliminado timestamptz;
  v_cuenta uuid;
begin
  select coalesce(sum(subtotal), 0) into v_subtotal from public.venta_lineas where venta_id = p_venta_id;
  select descuento_total, contacto_id, fecha, eliminado_en into v_descuento, v_contacto, v_fecha, v_eliminado
    from public.ventas where id = p_venta_id;
  update public.ventas set subtotal = v_subtotal, total = greatest(v_subtotal - v_descuento, 0) where id = p_venta_id;

  -- Cuenta por cobrar de la venta (una por venta).
  insert into public.cuentas_por_cobrar (contacto_id, origen_tipo, origen_id, fecha, valor_total, eliminado_en)
  values (v_contacto, 'venta', p_venta_id, v_fecha, greatest(v_subtotal - v_descuento, 0), v_eliminado)
  on conflict (origen_tipo, origen_id) do update
    set contacto_id = excluded.contacto_id, fecha = excluded.fecha, valor_total = excluded.valor_total, eliminado_en = excluded.eliminado_en
  returning id into v_cuenta;
  perform public.recalcular_cuenta(v_cuenta);
end;
$$;

create or replace function public.recalcular_consignacion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_contacto uuid;
  v_fecha timestamptz;
  v_eliminado timestamptz;
  v_cuenta uuid;
  nuevo_estado public.estado_consignacion;
begin
  select coalesce(sum(cantidad_entregada * valor_unitario), 0) as entregado,
         coalesce(sum(cantidad_vendida * valor_unitario), 0) as vendido,
         coalesce(sum(cantidad_devuelta * valor_unitario), 0) as devuelto,
         coalesce(sum(cantidad_pendiente * valor_unitario), 0) as pendiente,
         coalesce(sum(cantidad_pendiente), 0) as piezas_pendientes,
         coalesce(sum(cantidad_vendida + cantidad_devuelta), 0) as piezas_movidas
    into r
    from public.consignacion_lineas where consignacion_id = p_id;

  nuevo_estado := case
    when r.piezas_pendientes = 0 then 'cerrada'
    when r.piezas_movidas > 0 then 'parcial'
    else 'abierta' end;

  update public.consignaciones
     set total_entregado = r.entregado, total_vendido = r.vendido, total_devuelto = r.devuelto,
         total_pendiente = r.pendiente, estado = nuevo_estado
   where id = p_id
   returning contacto_id, fecha_entrega, eliminado_en into v_contacto, v_fecha, v_eliminado;

  insert into public.cuentas_por_cobrar (contacto_id, origen_tipo, origen_id, fecha, valor_total, eliminado_en)
  values (v_contacto, 'consignacion', p_id, v_fecha, r.vendido, v_eliminado)
  on conflict (origen_tipo, origen_id) do update
    set contacto_id = excluded.contacto_id, valor_total = excluded.valor_total, eliminado_en = excluded.eliminado_en
  returning id into v_cuenta;
  perform public.recalcular_cuenta(v_cuenta);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Disparadores: ventas
-- -----------------------------------------------------------------------------

-- Cada línea de venta saca inventario.
create or replace function public.venta_linea_movimiento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v public.ventas%rowtype;
begin
  select * into v from public.ventas where id = coalesce(new.venta_id, old.venta_id);
  if tg_op = 'INSERT' then
    insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
    values ('salida_venta', new.producto_id, new.cantidad, new.precio_unitario, 'venta', v.id, v.fecha, v.registrado_por, 'Venta V-' || lpad(v.numero::text, 4, '0'));
  elsif tg_op = 'DELETE' then
    delete from public.movimientos_inventario where documento_tipo = 'venta' and documento_id = old.venta_id and producto_id = old.producto_id and cantidad = old.cantidad;
  end if;
  perform public.recalcular_venta(v.id);
  return coalesce(new, old);
end;
$$;
create trigger venta_lineas_movimiento after insert or delete on public.venta_lineas
  for each row execute function public.venta_linea_movimiento();

-- Papelera de la venta: anula o restaura sus movimientos y su cuenta.
create or replace function public.venta_papelera()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.eliminado_en is distinct from old.eliminado_en then
    update public.movimientos_inventario set eliminado_en = new.eliminado_en where documento_tipo = 'venta' and documento_id = new.id;
    update public.abonos a set eliminado_en = new.eliminado_en
      from public.cuentas_por_cobrar c where a.cuenta_id = c.id and c.origen_tipo = 'venta' and c.origen_id = new.id;
  end if;
  if new.descuento_total <> old.descuento_total or new.contacto_id is distinct from old.contacto_id or new.fecha <> old.fecha or new.eliminado_en is distinct from old.eliminado_en then
    perform public.recalcular_venta(new.id);
  end if;
  return new;
end;
$$;
create trigger ventas_papelera after update on public.ventas
  for each row execute function public.venta_papelera();

create trigger ventas_borrado_solo_propietaria before update on public.ventas
  for each row execute function public.solo_propietaria_borra();

-- -----------------------------------------------------------------------------
-- 6. Disparadores: consignaciones y liquidaciones
-- -----------------------------------------------------------------------------

create or replace function public.consignacion_linea_movimiento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.consignaciones%rowtype;
begin
  select * into c from public.consignaciones where id = coalesce(new.consignacion_id, old.consignacion_id);
  if tg_op = 'INSERT' then
    insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
    values ('salida_consignacion', new.producto_id, new.cantidad_entregada, new.valor_unitario, 'consignacion', c.id, c.fecha_entrega, c.registrado_por,
            'Consignación C-' || lpad(c.numero::text, 4, '0') || ' · entrega');
  elsif tg_op = 'DELETE' then
    delete from public.movimientos_inventario where documento_tipo = 'consignacion' and documento_id = old.consignacion_id and producto_id = old.producto_id and tipo = 'salida_consignacion' and cantidad = old.cantidad_entregada;
  end if;
  perform public.recalcular_consignacion(c.id);
  return coalesce(new, old);
end;
$$;
create trigger consignacion_lineas_movimiento after insert or delete on public.consignacion_lineas
  for each row execute function public.consignacion_linea_movimiento();

-- Al liquidar una línea: valida contra lo pendiente, acumula y devuelve al inventario lo devuelto.
create or replace function public.liquidacion_linea_aplicar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  l public.consignacion_lineas%rowtype;
  liq public.liquidaciones%rowtype;
  c public.consignaciones%rowtype;
begin
  select * into l from public.consignacion_lineas where id = new.consignacion_linea_id for update;
  select * into liq from public.liquidaciones where id = new.liquidacion_id;
  select * into c from public.consignaciones where id = l.consignacion_id;
  if liq.consignacion_id <> l.consignacion_id then
    raise exception 'LIQUIDACION_INVALIDA: la línea no pertenece a esta consignación' using errcode = 'check_violation';
  end if;
  if new.cantidad_vendida + new.cantidad_devuelta > l.cantidad_pendiente then
    raise exception 'LIQUIDACION_EXCEDE: quedan % pendientes y se intentan liquidar %', l.cantidad_pendiente, new.cantidad_vendida + new.cantidad_devuelta
      using errcode = 'check_violation';
  end if;
  update public.consignacion_lineas
     set cantidad_vendida = cantidad_vendida + new.cantidad_vendida,
         cantidad_devuelta = cantidad_devuelta + new.cantidad_devuelta
   where id = l.id;
  if new.cantidad_devuelta > 0 then
    insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
    values ('retorno_consignacion', l.producto_id, new.cantidad_devuelta, l.valor_unitario, 'liquidacion', liq.id, liq.fecha, liq.registrado_por,
            'Consignación C-' || lpad(c.numero::text, 4, '0') || ' · devolución');
  end if;
  update public.liquidaciones set total_vendido = total_vendido + new.cantidad_vendida * l.valor_unitario where id = liq.id;
  perform public.recalcular_consignacion(l.consignacion_id);
  return new;
end;
$$;
create trigger liquidacion_lineas_aplicar after insert on public.liquidacion_lineas
  for each row execute function public.liquidacion_linea_aplicar();

-- Anular una liquidación (papelera) deshace sus cantidades y sus retornos; restaurarla los reaplica.
create or replace function public.liquidacion_papelera()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  signo integer;
  r record;
begin
  if new.eliminado_en is distinct from old.eliminado_en then
    signo := case when new.eliminado_en is null then 1 else -1 end;
    for r in select * from public.liquidacion_lineas where liquidacion_id = new.id loop
      update public.consignacion_lineas
         set cantidad_vendida = cantidad_vendida + signo * r.cantidad_vendida,
             cantidad_devuelta = cantidad_devuelta + signo * r.cantidad_devuelta
       where id = r.consignacion_linea_id;
    end loop;
    update public.movimientos_inventario set eliminado_en = new.eliminado_en where documento_tipo = 'liquidacion' and documento_id = new.id;
    perform public.recalcular_consignacion(new.consignacion_id);
  end if;
  return new;
end;
$$;
create trigger liquidaciones_papelera after update on public.liquidaciones
  for each row execute function public.liquidacion_papelera();
create trigger liquidaciones_borrado_solo_propietaria before update on public.liquidaciones
  for each row execute function public.solo_propietaria_borra();

-- Papelera de la consignación: solo si no tiene liquidaciones activas.
create or replace function public.consignacion_papelera()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.eliminado_en is distinct from old.eliminado_en then
    if new.eliminado_en is not null and exists (select 1 from public.liquidaciones where consignacion_id = new.id and eliminado_en is null) then
      raise exception 'CONSIGNACION_CON_LIQUIDACIONES: anula primero sus liquidaciones' using errcode = 'check_violation';
    end if;
    update public.movimientos_inventario set eliminado_en = new.eliminado_en where documento_tipo = 'consignacion' and documento_id = new.id;
    update public.abonos a set eliminado_en = new.eliminado_en
      from public.cuentas_por_cobrar c where a.cuenta_id = c.id and c.origen_tipo = 'consignacion' and c.origen_id = new.id;
  end if;
  if new.contacto_id <> old.contacto_id or new.fecha_entrega <> old.fecha_entrega or new.eliminado_en is distinct from old.eliminado_en then
    perform public.recalcular_consignacion(new.id);
  end if;
  return new;
end;
$$;
create trigger consignaciones_papelera after update on public.consignaciones
  for each row execute function public.consignacion_papelera();
create trigger consignaciones_borrado_solo_propietaria before update on public.consignaciones
  for each row execute function public.solo_propietaria_borra();

-- -----------------------------------------------------------------------------
-- 7. Disparadores: abonos
-- -----------------------------------------------------------------------------
create or replace function public.abono_validar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.cuentas_por_cobrar%rowtype;
  otros integer;
begin
  if new.eliminado_en is not null then return new; end if;
  select * into c from public.cuentas_por_cobrar where id = new.cuenta_id for update;
  select coalesce(sum(valor), 0) into otros from public.abonos where cuenta_id = new.cuenta_id and eliminado_en is null and id <> new.id;
  if otros + new.valor > c.valor_total then
    raise exception 'ABONO_EXCEDE: el saldo es % y se intenta abonar %', c.valor_total - otros, new.valor using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger abonos_validar before insert or update on public.abonos
  for each row execute function public.abono_validar();

create or replace function public.abono_recalcula()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_cuenta(coalesce(new.cuenta_id, old.cuenta_id));
  return coalesce(new, old);
end;
$$;
create trigger abonos_recalculan after insert or update or delete on public.abonos
  for each row execute function public.abono_recalcula();
create trigger abonos_borrado_solo_propietaria before update on public.abonos
  for each row execute function public.solo_propietaria_borra();

-- -----------------------------------------------------------------------------
-- 8. Auditoría y papelera
-- -----------------------------------------------------------------------------
create trigger auditar_ventas after insert or update or delete on public.ventas for each row execute function public.auditar();
create trigger auditar_consignaciones after insert or update or delete on public.consignaciones for each row execute function public.auditar();
create trigger auditar_liquidaciones after insert or update or delete on public.liquidaciones for each row execute function public.auditar();
create trigger auditar_abonos after insert or update or delete on public.abonos for each row execute function public.auditar();

create or replace view public.papelera as
  select 'productos'::text as tabla, id, codigo || ' · ' || nombre as descripcion, eliminado_en from public.productos where eliminado_en is not null
  union all
  select 'contactos', id, nombre, eliminado_en from public.contactos where eliminado_en is not null
  union all
  select 'movimientos_inventario', m.id, m.tipo::text || ' · ' || p.codigo || ' × ' || m.cantidad, m.eliminado_en
    from public.movimientos_inventario m join public.productos p on p.id = m.producto_id
   where m.eliminado_en is not null and m.documento_id is null
  union all
  select 'ventas', v.id, 'Venta V-' || lpad(v.numero::text, 4, '0') || ' · ' || v.total::text, v.eliminado_en from public.ventas v where v.eliminado_en is not null
  union all
  select 'consignaciones', c.id, 'Consignación C-' || lpad(c.numero::text, 4, '0') || ' · ' || co.nombre, c.eliminado_en
    from public.consignaciones c join public.contactos co on co.id = c.contacto_id where c.eliminado_en is not null
  union all
  select 'liquidaciones', l.id, 'Liquidación de C-' || lpad(c.numero::text, 4, '0') || ' del ' || to_char(l.fecha at time zone 'America/Bogota', 'DD/MM/YYYY'), l.eliminado_en
    from public.liquidaciones l join public.consignaciones c on c.id = l.consignacion_id where l.eliminado_en is not null
  union all
  select 'abonos', a.id, 'Abono de ' || a.valor::text, a.eliminado_en from public.abonos a where a.eliminado_en is not null;
grant select on public.papelera to authenticated;

create or replace function public.purgar_papelera(dias integer default 30)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  total integer := 0;
  n integer;
begin
  delete from public.abonos where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.liquidaciones where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.cuentas_por_cobrar c where c.eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.movimientos_inventario where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.ventas where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.consignaciones where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.productos p
   where p.eliminado_en < now() - make_interval(days => dias)
     and not exists (select 1 from public.movimientos_inventario m where m.producto_id = p.id)
     and not exists (select 1 from public.venta_lineas l where l.producto_id = p.id)
     and not exists (select 1 from public.consignacion_lineas l where l.producto_id = p.id);
  get diagnostics n = row_count; total := total + n;
  delete from public.contactos c
   where c.eliminado_en < now() - make_interval(days => dias)
     and not exists (select 1 from public.productos p where p.proveedor_id = c.id)
     and not exists (select 1 from public.ventas v where v.contacto_id = c.id)
     and not exists (select 1 from public.consignaciones k where k.contacto_id = c.id);
  get diagnostics n = row_count; total := total + n;
  return total;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Vistas de consulta
-- -----------------------------------------------------------------------------

-- Saldo por contacto, con antigüedad de la cuenta abierta más vieja.
create or replace view public.saldos_por_contacto as
  select co.id as contacto_id, co.nombre, co.telefono, co.tipo,
         sum(c.saldo)::integer as saldo,
         count(*)::integer as cuentas_abiertas,
         min(c.fecha) as desde,
         (current_date - min(c.fecha)::date)::integer as dias
    from public.cuentas_por_cobrar c
    join public.contactos co on co.id = c.contacto_id
   where c.eliminado_en is null and c.estado = 'abierta' and c.saldo > 0
   group by co.id, co.nombre, co.telefono, co.tipo;
grant select on public.saldos_por_contacto to authenticated;

-- -----------------------------------------------------------------------------
-- 10. RLS
-- -----------------------------------------------------------------------------
alter table public.ventas enable row level security;
alter table public.venta_lineas enable row level security;
alter table public.consignaciones enable row level security;
alter table public.consignacion_lineas enable row level security;
alter table public.liquidaciones enable row level security;
alter table public.liquidacion_lineas enable row level security;
alter table public.cuentas_por_cobrar enable row level security;
alter table public.abonos enable row level security;

-- Ambos roles registran ventas, consignaciones, liquidaciones y abonos y los consultan.
-- Editar (incluida la papelera) queda para la propietaria, salvo la nota y el contacto.
do $$
declare t text;
begin
  foreach t in array array['ventas','venta_lineas','consignaciones','consignacion_lineas','liquidaciones','liquidacion_lineas','abonos'] loop
    execute format('create policy %I_ver on public.%I for select to authenticated using (public.es_usuaria_activa())', t, t);
    execute format('create policy %I_crear on public.%I for insert to authenticated with check (public.es_usuaria_activa())', t, t);
  end loop;
  foreach t in array array['ventas','consignaciones','liquidaciones','abonos'] loop
    execute format('create policy %I_editar on public.%I for update to authenticated using (public.es_usuaria_activa()) with check (public.es_usuaria_activa())', t, t);
  end loop;
end $$;

create policy cuentas_ver on public.cuentas_por_cobrar for select to authenticated using (public.es_usuaria_activa());

-- Permisos de funciones nuevas (anon no ejecuta nada; ver migración 3).
revoke execute on function public.recalcular_cuenta(uuid) from public, anon;
revoke execute on function public.recalcular_venta(uuid) from public, anon;
revoke execute on function public.recalcular_consignacion(uuid) from public, anon;
grant execute on function public.recalcular_cuenta(uuid), public.recalcular_venta(uuid), public.recalcular_consignacion(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 11. Operaciones atómicas que usa la app (una llamada = una transacción).
--     Corren con los permisos de la usuaria (security invoker): aplican RLS.
-- -----------------------------------------------------------------------------

-- p = { fecha?, contacto_id?, descuento_total?, medio_pago?, nota?,
--       estado_pago: 'pagada' | 'abono' | 'pendiente', abono?: int,
--       lineas: [{ producto_id, cantidad, precio_unitario, descuento? }] }
create or replace function public.registrar_venta(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid; l jsonb; v_total integer; v_estado text; v_abono integer; v_cuenta uuid; v_medio public.medio_pago;
begin
  if not public.es_usuaria_activa() then
    raise exception 'SIN_PERMISO: hace falta una sesión activa' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_array_length(coalesce(p -> 'lineas', '[]'::jsonb)) = 0 then
    raise exception 'VENTA_SIN_LINEAS: la venta necesita al menos un producto' using errcode = 'check_violation';
  end if;
  v_estado := coalesce(p ->> 'estado_pago', 'pagada');
  v_medio := coalesce(p ->> 'medio_pago', 'efectivo')::public.medio_pago;
  if v_estado <> 'pagada' and nullif(p ->> 'contacto_id', '') is null then
    raise exception 'VENTA_PENDIENTE_SIN_CONTACTO: para dejar saldo pendiente hay que elegir la clienta' using errcode = 'check_violation';
  end if;

  insert into public.ventas (fecha, contacto_id, descuento_total, medio_pago, nota, registrado_por)
  values (coalesce((p ->> 'fecha')::timestamptz, now()), nullif(p ->> 'contacto_id', '')::uuid,
          coalesce((p ->> 'descuento_total')::integer, 0), v_medio, coalesce(p ->> 'nota', ''), auth.uid())
  returning id into v_id;

  for l in select * from jsonb_array_elements(p -> 'lineas') loop
    insert into public.venta_lineas (venta_id, producto_id, cantidad, precio_unitario, descuento)
    values (v_id, (l ->> 'producto_id')::uuid, (l ->> 'cantidad')::integer, (l ->> 'precio_unitario')::integer, coalesce((l ->> 'descuento')::integer, 0));
  end loop;

  select total into v_total from public.ventas where id = v_id;
  v_abono := case v_estado when 'pagada' then v_total when 'abono' then coalesce((p ->> 'abono')::integer, 0) else 0 end;
  if v_abono > 0 then
    select id into v_cuenta from public.cuentas_por_cobrar where origen_tipo = 'venta' and origen_id = v_id;
    insert into public.abonos (cuenta_id, fecha, valor, medio_pago, nota, registrado_por)
    values (v_cuenta, coalesce((p ->> 'fecha')::timestamptz, now()), v_abono, v_medio,
            case when v_estado = 'pagada' then 'Pago de la venta' else 'Abono al registrar la venta' end, auth.uid());
  end if;
  return v_id;
end;
$$;

-- p = { contacto_id, fecha_entrega?, nota?, lineas: [{ producto_id, cantidad, valor_unitario }] }
create or replace function public.registrar_consignacion(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid; l jsonb;
begin
  if not public.es_usuaria_activa() then
    raise exception 'SIN_PERMISO: hace falta una sesión activa' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_array_length(coalesce(p -> 'lineas', '[]'::jsonb)) = 0 then
    raise exception 'CONSIGNACION_SIN_LINEAS: la entrega necesita al menos un producto' using errcode = 'check_violation';
  end if;
  insert into public.consignaciones (contacto_id, fecha_entrega, nota, registrado_por)
  values ((p ->> 'contacto_id')::uuid, coalesce((p ->> 'fecha_entrega')::timestamptz, now()), coalesce(p ->> 'nota', ''), auth.uid())
  returning id into v_id;
  for l in select * from jsonb_array_elements(p -> 'lineas') loop
    insert into public.consignacion_lineas (consignacion_id, producto_id, cantidad_entregada, valor_unitario)
    values (v_id, (l ->> 'producto_id')::uuid, (l ->> 'cantidad')::integer, (l ->> 'valor_unitario')::integer);
  end loop;
  return v_id;
end;
$$;

-- p = { consignacion_id, fecha?, nota?, abono?: int, medio_pago?,
--       lineas: [{ consignacion_linea_id, cantidad_vendida, cantidad_devuelta }] }
create or replace function public.registrar_liquidacion(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid; l jsonb; v_abono integer; v_cuenta uuid; v_lineas integer := 0;
begin
  if not public.es_usuaria_activa() then
    raise exception 'SIN_PERMISO: hace falta una sesión activa' using errcode = 'insufficient_privilege';
  end if;
  insert into public.liquidaciones (consignacion_id, fecha, nota, registrado_por)
  values ((p ->> 'consignacion_id')::uuid, coalesce((p ->> 'fecha')::timestamptz, now()), coalesce(p ->> 'nota', ''), auth.uid())
  returning id into v_id;
  for l in select * from jsonb_array_elements(coalesce(p -> 'lineas', '[]'::jsonb)) loop
    if coalesce((l ->> 'cantidad_vendida')::integer, 0) + coalesce((l ->> 'cantidad_devuelta')::integer, 0) > 0 then
      insert into public.liquidacion_lineas (liquidacion_id, consignacion_linea_id, cantidad_vendida, cantidad_devuelta)
      values (v_id, (l ->> 'consignacion_linea_id')::uuid, coalesce((l ->> 'cantidad_vendida')::integer, 0), coalesce((l ->> 'cantidad_devuelta')::integer, 0));
      v_lineas := v_lineas + 1;
    end if;
  end loop;
  v_abono := coalesce((p ->> 'abono')::integer, 0);
  if v_lineas = 0 and v_abono = 0 then
    raise exception 'LIQUIDACION_VACIA: marca al menos una pieza vendida o devuelta, o un abono' using errcode = 'check_violation';
  end if;
  if v_abono > 0 then
    select id into v_cuenta from public.cuentas_por_cobrar where origen_tipo = 'consignacion' and origen_id = (p ->> 'consignacion_id')::uuid;
    insert into public.abonos (cuenta_id, fecha, valor, medio_pago, nota, registrado_por)
    values (v_cuenta, coalesce((p ->> 'fecha')::timestamptz, now()), v_abono, coalesce(p ->> 'medio_pago', 'efectivo')::public.medio_pago, 'Pago en liquidación', auth.uid());
  end if;
  return v_id;
end;
$$;

-- p = { cuenta_id, valor, medio_pago?, fecha?, nota? }
create or replace function public.registrar_abono(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.es_usuaria_activa() then
    raise exception 'SIN_PERMISO: hace falta una sesión activa' using errcode = 'insufficient_privilege';
  end if;
  insert into public.abonos (cuenta_id, fecha, valor, medio_pago, nota, registrado_por)
  values ((p ->> 'cuenta_id')::uuid, coalesce((p ->> 'fecha')::timestamptz, now()), (p ->> 'valor')::integer,
          coalesce(p ->> 'medio_pago', 'efectivo')::public.medio_pago, coalesce(p ->> 'nota', ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.registrar_venta(jsonb), public.registrar_consignacion(jsonb), public.registrar_liquidacion(jsonb), public.registrar_abono(jsonb) from public, anon;
grant execute on function public.registrar_venta(jsonb), public.registrar_consignacion(jsonb), public.registrar_liquidacion(jsonb), public.registrar_abono(jsonb) to authenticated, service_role;
