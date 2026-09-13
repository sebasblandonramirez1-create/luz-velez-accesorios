-- =============================================================================
-- Migración 6 (Fase 3): gastos, compras de mercancía, cierres de caja y
-- reportes por período.
--
-- Reglas:
--   · Una compra confirmada genera las entradas de inventario de sus líneas,
--     actualiza el costo de compra del producto y registra un gasto de la
--     categoría «compra de mercancía» por su total (así los gastos por categoría
--     incluyen la mercancía sin contarla dos veces).
--   · Anular una compra anula sus entradas, salvo que eso deje stock negativo.
--   · Gastos, compras, caja y reportes son contabilidad: solo la propietaria.
-- =============================================================================

create type public.categoria_gasto as enum ('compra_mercancia', 'empaques', 'transporte', 'comisiones', 'publicidad', 'otros');

create sequence public.compras_numero_seq;

-- -----------------------------------------------------------------------------
-- 1. Compras
-- -----------------------------------------------------------------------------
create table public.compras (
  id             uuid primary key default gen_random_uuid(),
  numero         integer not null default nextval('public.compras_numero_seq'),
  proveedor_id   uuid references public.contactos (id),
  fecha          timestamptz not null default now(),
  total          integer not null default 0 check (total >= 0),
  medio_pago     public.medio_pago not null default 'efectivo',
  nota           text not null default '',
  registrado_por uuid references public.perfiles (id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en   timestamptz
);
create index compras_fecha_idx on public.compras (fecha desc) where eliminado_en is null;
create trigger compras_actualizado before update on public.compras for each row execute function public.marcar_actualizado();

create table public.compra_lineas (
  id             uuid primary key default gen_random_uuid(),
  compra_id      uuid not null references public.compras (id) on delete cascade,
  producto_id    uuid not null references public.productos (id),
  cantidad       integer not null check (cantidad > 0),
  costo_unitario integer not null check (costo_unitario >= 0),
  subtotal       integer generated always as (cantidad * costo_unitario) stored,
  creado_en      timestamptz not null default now()
);
create index compra_lineas_compra_idx on public.compra_lineas (compra_id);
create index compra_lineas_producto_idx on public.compra_lineas (producto_id);

-- -----------------------------------------------------------------------------
-- 2. Gastos
-- -----------------------------------------------------------------------------
create table public.gastos (
  id             uuid primary key default gen_random_uuid(),
  fecha          timestamptz not null default now(),
  categoria      public.categoria_gasto not null default 'otros',
  valor          integer not null check (valor > 0),
  medio_pago     public.medio_pago not null default 'efectivo',
  proveedor_id   uuid references public.contactos (id),
  compra_id      uuid references public.compras (id) on delete cascade,
  foto_soporte   text,
  nota           text not null default '',
  registrado_por uuid references public.perfiles (id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en   timestamptz
);
create index gastos_fecha_idx on public.gastos (fecha desc) where eliminado_en is null;
create index gastos_categoria_idx on public.gastos (categoria) where eliminado_en is null;
create unique index gastos_compra_unica on public.gastos (compra_id) where compra_id is not null;
create trigger gastos_actualizado before update on public.gastos for each row execute function public.marcar_actualizado();

-- -----------------------------------------------------------------------------
-- 3. Cierres de caja (uno por día)
-- -----------------------------------------------------------------------------
create table public.cierres_caja (
  id                 uuid primary key default gen_random_uuid(),
  dia                date not null unique,
  ingresos_efectivo  integer not null default 0,
  ingresos_otros     integer not null default 0,
  gastos_efectivo    integer not null default 0,
  gastos_otros       integer not null default 0,
  efectivo_esperado  integer not null default 0,
  efectivo_contado   integer not null default 0,
  diferencia         integer generated always as (efectivo_contado - efectivo_esperado) stored,
  nota               text not null default '',
  cerrado_por        uuid references public.perfiles (id),
  creado_en          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. Disparadores de compras
-- -----------------------------------------------------------------------------
create or replace function public.recalcular_compra(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
  c public.compras%rowtype;
begin
  select coalesce(sum(subtotal), 0) into v_total from public.compra_lineas where compra_id = p_id;
  update public.compras set total = v_total where id = p_id returning * into c;
  -- Gasto asociado (categoría compra de mercancía) por el total de la compra.
  if v_total > 0 then
    insert into public.gastos (fecha, categoria, valor, medio_pago, proveedor_id, compra_id, nota, registrado_por, eliminado_en)
    values (c.fecha, 'compra_mercancia', v_total, c.medio_pago, c.proveedor_id, c.id, 'Compra ' || 'CP-' || lpad(c.numero::text, 4, '0'), c.registrado_por, c.eliminado_en)
    on conflict (compra_id) where compra_id is not null do update
      set valor = excluded.valor, fecha = excluded.fecha, medio_pago = excluded.medio_pago, proveedor_id = excluded.proveedor_id, eliminado_en = excluded.eliminado_en;
  end if;
end;
$$;

create or replace function public.compra_linea_aplicar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.compras%rowtype;
begin
  select * into c from public.compras where id = coalesce(new.compra_id, old.compra_id);
  if tg_op = 'INSERT' then
    insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
    values ('entrada_compra', new.producto_id, new.cantidad, new.costo_unitario, 'compra', c.id, c.fecha, c.registrado_por, 'Compra CP-' || lpad(c.numero::text, 4, '0'));
    update public.productos set costo_compra = new.costo_unitario where id = new.producto_id and costo_compra is distinct from new.costo_unitario;
  elsif tg_op = 'DELETE' then
    delete from public.movimientos_inventario where documento_tipo = 'compra' and documento_id = old.compra_id and producto_id = old.producto_id and cantidad = old.cantidad;
  end if;
  perform public.recalcular_compra(c.id);
  return coalesce(new, old);
end;
$$;
create trigger compra_lineas_aplicar after insert or delete on public.compra_lineas
  for each row execute function public.compra_linea_aplicar();

create or replace function public.compra_papelera()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.eliminado_en is distinct from old.eliminado_en then
    if new.eliminado_en is not null then
      -- No se puede anular si alguna pieza ya se vendió o entregó (dejaría stock negativo).
      for r in select l.producto_id, l.cantidad, p.stock_actual, p.codigo from public.compra_lineas l join public.productos p on p.id = l.producto_id where l.compra_id = new.id loop
        if r.stock_actual - r.cantidad < 0 then
          raise exception 'COMPRA_YA_VENDIDA: de % quedan % en inventario y la compra trajo %', r.codigo, r.stock_actual, r.cantidad using errcode = 'check_violation';
        end if;
      end loop;
    end if;
    update public.movimientos_inventario set eliminado_en = new.eliminado_en where documento_tipo = 'compra' and documento_id = new.id;
  end if;
  if new.eliminado_en is distinct from old.eliminado_en or new.fecha <> old.fecha or new.medio_pago <> old.medio_pago or new.proveedor_id is distinct from old.proveedor_id then
    perform public.recalcular_compra(new.id);
  end if;
  return new;
end;
$$;
create trigger compras_papelera after update on public.compras for each row execute function public.compra_papelera();
create trigger compras_borrado_solo_propietaria before update on public.compras for each row execute function public.solo_propietaria_borra();
create trigger gastos_borrado_solo_propietaria before update on public.gastos for each row execute function public.solo_propietaria_borra();

create trigger auditar_compras after insert or update or delete on public.compras for each row execute function public.auditar();
create trigger auditar_gastos after insert or update or delete on public.gastos for each row execute function public.auditar();
create trigger auditar_cierres after insert or update or delete on public.cierres_caja for each row execute function public.auditar();

-- -----------------------------------------------------------------------------
-- 5. Operación atómica: registrar compra
--    p = { proveedor_id?, fecha?, medio_pago?, nota?, lineas: [{ producto_id, cantidad, costo_unitario }] }
-- -----------------------------------------------------------------------------
create or replace function public.registrar_compra(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid; l jsonb;
begin
  if not public.es_propietaria() then
    raise exception 'SIN_PERMISO: solo la propietaria registra compras' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_array_length(coalesce(p -> 'lineas', '[]'::jsonb)) = 0 then
    raise exception 'COMPRA_SIN_LINEAS: la compra necesita al menos un producto' using errcode = 'check_violation';
  end if;
  insert into public.compras (proveedor_id, fecha, medio_pago, nota, registrado_por)
  values (nullif(p ->> 'proveedor_id', '')::uuid, coalesce((p ->> 'fecha')::timestamptz, now()), coalesce(p ->> 'medio_pago', 'efectivo')::public.medio_pago, coalesce(p ->> 'nota', ''), auth.uid())
  returning id into v_id;
  for l in select * from jsonb_array_elements(p -> 'lineas') loop
    insert into public.compra_lineas (compra_id, producto_id, cantidad, costo_unitario)
    values (v_id, (l ->> 'producto_id')::uuid, (l ->> 'cantidad')::integer, (l ->> 'costo_unitario')::integer);
  end loop;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Caja del día y reportes por período (solo propietaria)
-- -----------------------------------------------------------------------------

-- Ingresos (abonos) y gastos de un día, por medio de pago.
create or replace function public.caja_del_dia(p_dia date)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  desde timestamptz := (p_dia::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';
  hasta timestamptz := desde + interval '1 day';
  r jsonb;
begin
  if not public.es_propietaria() then
    raise exception 'SIN_PERMISO: la caja es solo de la propietaria' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object(
    'dia', p_dia,
    'ingresos', coalesce((select jsonb_agg(jsonb_build_object('medio_pago', medio_pago, 'valor', valor, 'cantidad', n) order by valor desc)
                          from (select medio_pago, sum(valor) as valor, count(*) as n from public.abonos where eliminado_en is null and fecha >= desde and fecha < hasta group by medio_pago) i), '[]'::jsonb),
    'gastos', coalesce((select jsonb_agg(jsonb_build_object('medio_pago', medio_pago, 'valor', valor, 'cantidad', n) order by valor desc)
                        from (select medio_pago, sum(valor) as valor, count(*) as n from public.gastos where eliminado_en is null and fecha >= desde and fecha < hasta group by medio_pago) g), '[]'::jsonb),
    'ventas', (select count(*) from public.ventas where eliminado_en is null and fecha >= desde and fecha < hasta),
    'ingresos_efectivo', coalesce((select sum(valor) from public.abonos where eliminado_en is null and medio_pago = 'efectivo' and fecha >= desde and fecha < hasta), 0),
    'ingresos_otros', coalesce((select sum(valor) from public.abonos where eliminado_en is null and medio_pago <> 'efectivo' and fecha >= desde and fecha < hasta), 0),
    'gastos_efectivo', coalesce((select sum(valor) from public.gastos where eliminado_en is null and medio_pago = 'efectivo' and fecha >= desde and fecha < hasta), 0),
    'gastos_otros', coalesce((select sum(valor) from public.gastos where eliminado_en is null and medio_pago <> 'efectivo' and fecha >= desde and fecha < hasta), 0),
    'cierre', (select to_jsonb(c) from public.cierres_caja c where c.dia = p_dia)
  ) into r;
  return r;
end;
$$;

-- Cierre de caja: guarda la foto del día y el efectivo contado.
create or replace function public.cerrar_caja(p_dia date, p_efectivo_contado integer, p_nota text default '')
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  c jsonb; v_id uuid;
begin
  c := public.caja_del_dia(p_dia);
  insert into public.cierres_caja (dia, ingresos_efectivo, ingresos_otros, gastos_efectivo, gastos_otros, efectivo_esperado, efectivo_contado, nota, cerrado_por)
  values (p_dia, (c ->> 'ingresos_efectivo')::integer, (c ->> 'ingresos_otros')::integer, (c ->> 'gastos_efectivo')::integer, (c ->> 'gastos_otros')::integer,
          (c ->> 'ingresos_efectivo')::integer - (c ->> 'gastos_efectivo')::integer, p_efectivo_contado, coalesce(p_nota, ''), auth.uid())
  on conflict (dia) do update
    set ingresos_efectivo = excluded.ingresos_efectivo, ingresos_otros = excluded.ingresos_otros, gastos_efectivo = excluded.gastos_efectivo,
        gastos_otros = excluded.gastos_otros, efectivo_esperado = excluded.efectivo_esperado, efectivo_contado = excluded.efectivo_contado,
        nota = excluded.nota, cerrado_por = excluded.cerrado_por, creado_en = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Reporte de un período [desde, hasta] (fechas en Bogotá, ambas inclusivas).
-- Ventas = ventas directas del período + lo vendido en liquidaciones del período.
create or replace function public.reporte_periodo(p_desde date, p_hasta date)
returns jsonb language plpgsql volatile security invoker set search_path = public as $$
declare
  desde timestamptz := (p_desde::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';
  hasta timestamptz := ((p_hasta + 1)::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';
  r jsonb;
begin
  if not public.es_propietaria() then
    raise exception 'SIN_PERMISO: los reportes son solo de la propietaria' using errcode = 'insufficient_privilege';
  end if;

  -- Piezas vendidas en el período (directas + consignación), con su categoría, ingreso y costo.
  create temp table if not exists tmp_vendido (categoria text, producto_id uuid, codigo text, nombre text, cantidad integer, ingreso integer, costo integer) on commit drop;
  truncate tmp_vendido;
  insert into tmp_vendido
    select p.categoria::text, p.id, p.codigo, p.nombre, l.cantidad, l.subtotal, coalesce(p.costo_compra, 0) * l.cantidad
      from public.venta_lineas l join public.ventas v on v.id = l.venta_id join public.productos p on p.id = l.producto_id
     where v.eliminado_en is null and v.fecha >= desde and v.fecha < hasta
    union all
    select p.categoria::text, p.id, p.codigo, p.nombre, ll.cantidad_vendida, ll.cantidad_vendida * cl.valor_unitario, coalesce(p.costo_compra, 0) * ll.cantidad_vendida
      from public.liquidacion_lineas ll
      join public.liquidaciones li on li.id = ll.liquidacion_id
      join public.consignacion_lineas cl on cl.id = ll.consignacion_linea_id
      join public.productos p on p.id = cl.producto_id
     where li.eliminado_en is null and li.fecha >= desde and li.fecha < hasta and ll.cantidad_vendida > 0;

  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'ventas_directas', coalesce((select sum(total) from public.ventas where eliminado_en is null and fecha >= desde and fecha < hasta), 0),
    'ventas_directas_cantidad', (select count(*) from public.ventas where eliminado_en is null and fecha >= desde and fecha < hasta),
    'ventas_consignacion', coalesce((select sum(total_vendido) from public.liquidaciones where eliminado_en is null and fecha >= desde and fecha < hasta), 0),
    'descuentos', coalesce((select sum(descuento_total) from public.ventas where eliminado_en is null and fecha >= desde and fecha < hasta), 0),
    'ventas_total', coalesce((select sum(ingreso) from tmp_vendido), 0) - coalesce((select sum(descuento_total) from public.ventas where eliminado_en is null and fecha >= desde and fecha < hasta), 0),
    'piezas_vendidas', coalesce((select sum(cantidad) from tmp_vendido), 0),
    'costo_vendido', coalesce((select sum(costo) from tmp_vendido), 0),
    'piezas_sin_costo', coalesce((select sum(cantidad) from tmp_vendido where costo = 0), 0),
    'por_categoria', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'cantidad', c, 'ingreso', i) order by i desc)
                               from (select categoria, sum(cantidad) c, sum(ingreso) i from tmp_vendido group by categoria) x), '[]'::jsonb),
    'mas_vendidos', coalesce((select jsonb_agg(jsonb_build_object('producto_id', producto_id, 'codigo', codigo, 'nombre', nombre, 'cantidad', c, 'ingreso', i) order by c desc, i desc)
                              from (select producto_id, codigo, nombre, sum(cantidad) c, sum(ingreso) i from tmp_vendido group by producto_id, codigo, nombre order by sum(cantidad) desc, sum(ingreso) desc limit 15) y), '[]'::jsonb),
    'ingresos_cobrados', coalesce((select sum(valor) from public.abonos where eliminado_en is null and fecha >= desde and fecha < hasta), 0),
    'ingresos_por_medio', coalesce((select jsonb_agg(jsonb_build_object('medio_pago', medio_pago, 'valor', v) order by v desc)
                                    from (select medio_pago, sum(valor) v from public.abonos where eliminado_en is null and fecha >= desde and fecha < hasta group by medio_pago) z), '[]'::jsonb),
    'gastos_total', coalesce((select sum(valor) from public.gastos where eliminado_en is null and fecha >= desde and fecha < hasta), 0),
    'gastos_operativos', coalesce((select sum(valor) from public.gastos where eliminado_en is null and categoria <> 'compra_mercancia' and fecha >= desde and fecha < hasta), 0),
    'compras_mercancia', coalesce((select sum(valor) from public.gastos where eliminado_en is null and categoria = 'compra_mercancia' and fecha >= desde and fecha < hasta), 0),
    'gastos_por_categoria', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'valor', v, 'cantidad', n) order by v desc)
                                      from (select categoria::text, sum(valor) v, count(*) n from public.gastos where eliminado_en is null and fecha >= desde and fecha < hasta group by categoria) w), '[]'::jsonb),
    'cuentas_por_cobrar', coalesce((select sum(saldo) from public.cuentas_por_cobrar where eliminado_en is null and estado = 'abierta'), 0),
    'inventario_unidades', coalesce((select sum(stock_actual) from public.productos where eliminado_en is null and activo), 0),
    'inventario_base', coalesce((select sum(stock_actual * precio_base) from public.productos where eliminado_en is null and activo), 0),
    'inventario_publico', coalesce((select sum(stock_actual * precio_publico) from public.productos where eliminado_en is null and activo), 0),
    'inventario_costo', coalesce((select sum(stock_actual * coalesce(costo_compra, 0)) from public.productos where eliminado_en is null and activo), 0),
    'en_consignacion', coalesce((select sum(total_pendiente) from public.consignaciones where eliminado_en is null), 0)
  ) into r;

  -- Margen bruto y utilidad estimada (solo con el costo que exista).
  r := r || jsonb_build_object(
    'margen_bruto', (r ->> 'ventas_total')::integer - (r ->> 'costo_vendido')::integer,
    'utilidad_estimada', (r ->> 'ventas_total')::integer - (r ->> 'costo_vendido')::integer - (r ->> 'gastos_operativos')::integer
  );
  return r;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Papelera y purga
-- -----------------------------------------------------------------------------
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
  select 'abonos', a.id, 'Abono de ' || a.valor::text, a.eliminado_en from public.abonos a where a.eliminado_en is not null
  union all
  select 'compras', c.id, 'Compra CP-' || lpad(c.numero::text, 4, '0') || ' · ' || c.total::text, c.eliminado_en from public.compras c where c.eliminado_en is not null
  union all
  select 'gastos', g.id, 'Gasto ' || g.categoria::text || ' · ' || g.valor::text, g.eliminado_en from public.gastos g where g.eliminado_en is not null and g.compra_id is null;
grant select on public.papelera to authenticated, service_role;

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
  delete from public.gastos where eliminado_en < now() - make_interval(days => dias) and compra_id is null;
  get diagnostics n = row_count; total := total + n;
  delete from public.movimientos_inventario where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.ventas where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.consignaciones where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.compras where eliminado_en < now() - make_interval(days => dias);
  get diagnostics n = row_count; total := total + n;
  delete from public.productos p
   where p.eliminado_en < now() - make_interval(days => dias)
     and not exists (select 1 from public.movimientos_inventario m where m.producto_id = p.id)
     and not exists (select 1 from public.venta_lineas l where l.producto_id = p.id)
     and not exists (select 1 from public.consignacion_lineas l where l.producto_id = p.id)
     and not exists (select 1 from public.compra_lineas l where l.producto_id = p.id);
  get diagnostics n = row_count; total := total + n;
  delete from public.contactos c
   where c.eliminado_en < now() - make_interval(days => dias)
     and not exists (select 1 from public.productos p where p.proveedor_id = c.id)
     and not exists (select 1 from public.ventas v where v.contacto_id = c.id)
     and not exists (select 1 from public.consignaciones k where k.contacto_id = c.id)
     and not exists (select 1 from public.compras k where k.proveedor_id = c.id)
     and not exists (select 1 from public.gastos g where g.proveedor_id = c.id);
  get diagnostics n = row_count; total := total + n;
  return total;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Permisos: contabilidad solo para la propietaria
-- -----------------------------------------------------------------------------
alter table public.compras enable row level security;
alter table public.compra_lineas enable row level security;
alter table public.gastos enable row level security;
alter table public.cierres_caja enable row level security;

create policy compras_todo on public.compras for all to authenticated using (public.es_propietaria()) with check (public.es_propietaria());
create policy compra_lineas_todo on public.compra_lineas for all to authenticated using (public.es_propietaria()) with check (public.es_propietaria());
create policy gastos_todo on public.gastos for all to authenticated using (public.es_propietaria()) with check (public.es_propietaria());
create policy cierres_todo on public.cierres_caja for all to authenticated using (public.es_propietaria()) with check (public.es_propietaria());

grant select, insert, update, delete on public.compras, public.compra_lineas, public.gastos, public.cierres_caja to authenticated, service_role;
grant usage, select on public.compras_numero_seq to authenticated, service_role;

revoke execute on function public.registrar_compra(jsonb), public.caja_del_dia(date), public.cerrar_caja(date, integer, text), public.reporte_periodo(date, date), public.recalcular_compra(uuid) from public, anon;
grant execute on function public.registrar_compra(jsonb), public.caja_del_dia(date), public.cerrar_caja(date, integer, text), public.reporte_periodo(date, date), public.recalcular_compra(uuid) to authenticated, service_role;

-- Fotos de soportes de gastos: misma carpeta «gastos/» del bucket fotos (políticas ya existentes).
