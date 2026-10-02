-- =============================================================================
-- Migración 11: modificar una consignación sin liquidarla, con registro.
--
--   * modificar_consignacion(p): en una sola transacción añade o retira piezas,
--     cambia cantidades, valores, la fecha límite y la nota. El inventario se
--     ajusta con movimientos propios (no se reescribe la historia).
--   * consignacion_modificaciones: registro de cada modificación (quién, cuándo,
--     por qué y qué cambió). Solo lo escribe la función; nadie lo edita ni borra.
--
-- Reglas: no se puede dejar una pieza por debajo de lo ya liquidado, ni retirar
-- una pieza con liquidaciones, ni cambiar el valor de una pieza con ventas. Si el
-- recibo ya está firmado, solo la propietaria puede modificar y la firma se anula
-- (queda anotado en el registro), porque lo firmado ya no coincide.
-- =============================================================================

-- Una pieza aparece una sola vez por consignación (la app ya lo garantizaba).
create unique index consignacion_lineas_producto_unico on public.consignacion_lineas (consignacion_id, producto_id);

-- -----------------------------------------------------------------------------
-- 1. Registro de modificaciones
-- -----------------------------------------------------------------------------
create table public.consignacion_modificaciones (
  id              uuid primary key default gen_random_uuid(),
  consignacion_id uuid not null references public.consignaciones (id) on delete cascade,
  numero          integer not null check (numero > 0),
  fecha           timestamptz not null default now(),
  usuario_id      uuid references public.perfiles (id),
  usuario_nombre  text not null default '',
  motivo          text not null default '',
  cambios         jsonb not null check (jsonb_typeof(cambios) = 'array' and jsonb_array_length(cambios) > 0),
  piezas_antes    integer not null,
  piezas_despues  integer not null,
  total_antes     integer not null,
  total_despues   integer not null,
  unique (consignacion_id, numero)
);
create index consignacion_modificaciones_consignacion_idx on public.consignacion_modificaciones (consignacion_id, fecha desc);

alter table public.consignacion_modificaciones enable row level security;
create policy consignacion_modificaciones_ver on public.consignacion_modificaciones for select to authenticated using (public.es_usuaria_activa());

revoke all on public.consignacion_modificaciones from public, anon, authenticated;
grant select on public.consignacion_modificaciones to authenticated;
grant select, insert, update, delete on public.consignacion_modificaciones to service_role;

-- -----------------------------------------------------------------------------
-- 2. Movimientos de inventario de las líneas.
--    Durante una modificación (app.modificando_consignacion = '1') las piezas
--    que se añaden salen con la fecha de hoy y las que se retiran vuelven con un
--    movimiento de retorno. Fuera de una modificación se comporta como antes.
-- -----------------------------------------------------------------------------
create or replace function public.consignacion_linea_movimiento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.consignaciones%rowtype;
  modificando boolean := coalesce(current_setting('app.modificando_consignacion', true), '') = '1';
  etiqueta text;
begin
  select * into c from public.consignaciones where id = coalesce(new.consignacion_id, old.consignacion_id);
  etiqueta := 'Consignación C-' || lpad(c.numero::text, 4, '0');
  if tg_op = 'INSERT' then
    if modificando then
      insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
      values ('salida_consignacion', new.producto_id, new.cantidad_entregada, new.valor_unitario, 'consignacion', c.id, now(), auth.uid(),
              etiqueta || ' · modificación: pieza añadida');
    else
      insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
      values ('salida_consignacion', new.producto_id, new.cantidad_entregada, new.valor_unitario, 'consignacion', c.id, c.fecha_entrega, c.registrado_por,
              etiqueta || ' · entrega');
    end if;
  elsif tg_op = 'DELETE' then
    if modificando then
      insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
      values ('retorno_consignacion', old.producto_id, old.cantidad_entregada, old.valor_unitario, 'consignacion', old.consignacion_id, now(), auth.uid(),
              etiqueta || ' · modificación: pieza retirada');
    else
      -- Borrado definitivo (purga de la papelera): se van todos sus movimientos,
      -- incluidos los de modificaciones.
      delete from public.movimientos_inventario
       where documento_tipo = 'consignacion' and documento_id = old.consignacion_id and producto_id = old.producto_id;
    end if;
  end if;
  if c.id is not null then
    perform public.recalcular_consignacion(c.id);
  end if;
  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Modificar la consignación.
--    p = { consignacion_id, motivo?, fecha_limite?, nota?,
--          lineas: [{ producto_id, cantidad, valor_unitario }] }
--    «lineas» es el estado completo que debe quedar: lo que no venga se retira.
-- -----------------------------------------------------------------------------
create or replace function public.modificar_consignacion(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.consignaciones%rowtype;
  r public.consignacion_recibos%rowtype;
  l record;
  n jsonb;
  cambios jsonb := '[]'::jsonb;
  firmada boolean := false;
  etiqueta text;
  v_producto uuid;
  v_cant integer;
  v_valor integer;
  v_codigo text;
  v_nombre text;
  v_limite date;
  v_nota text;
  v_piezas_antes integer;
  v_piezas_despues integer;
  v_total_despues integer;
  v_numero integer;
  v_usuario text;
  v_id uuid;
begin
  if not public.es_usuaria_activa() then
    raise exception 'SIN_PERMISO: hace falta una sesión activa' using errcode = 'insufficient_privilege';
  end if;
  select * into c from public.consignaciones where id = (p ->> 'consignacion_id')::uuid and eliminado_en is null for update;
  if not found then
    raise exception 'CONSIGNACION_NO_ENCONTRADA: la entrega no existe o fue anulada' using errcode = 'no_data_found';
  end if;
  if c.estado = 'cerrada' then
    raise exception 'CONSIGNACION_CERRADA: la entrega ya está cerrada' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p -> 'lineas') is distinct from 'array' or jsonb_array_length(p -> 'lineas') = 0 then
    raise exception 'CONSIGNACION_SIN_LINEAS: la entrega necesita al menos un producto' using errcode = 'check_violation';
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'lineas') e group by e ->> 'producto_id' having count(*) > 1) then
    raise exception 'LINEAS_REPETIDAS: un producto aparece más de una vez' using errcode = 'check_violation';
  end if;

  select * into r from public.consignacion_recibos where consignacion_id = c.id for update;
  firmada := found and r.firmado_en is not null;
  if firmada and not public.es_propietaria() then
    raise exception 'RECIBO_FIRMADO: el recibo ya está firmado; solo la propietaria puede modificar la entrega' using errcode = 'insufficient_privilege';
  end if;

  etiqueta := 'Consignación C-' || lpad(c.numero::text, 4, '0');
  select coalesce(sum(cantidad_entregada), 0) into v_piezas_antes from public.consignacion_lineas where consignacion_id = c.id;
  perform set_config('app.modificando_consignacion', '1', true);

  -- 3.1 Piezas que se retiran (no vienen en la lista nueva).
  for l in
    select cl.*, pr.codigo, pr.nombre
      from public.consignacion_lineas cl join public.productos pr on pr.id = cl.producto_id
     where cl.consignacion_id = c.id
       and not exists (select 1 from jsonb_array_elements(p -> 'lineas') e where (e ->> 'producto_id')::uuid = cl.producto_id)
     order by cl.creado_en, pr.codigo
  loop
    if l.cantidad_vendida + l.cantidad_devuelta > 0 then
      raise exception 'LINEA_CON_LIQUIDACION: % ya tiene % piezas liquidadas y no se puede retirar', l.codigo, l.cantidad_vendida + l.cantidad_devuelta
        using errcode = 'check_violation';
    end if;
    delete from public.consignacion_lineas where id = l.id; -- el disparador devuelve las piezas al inventario
    cambios := cambios || jsonb_build_object('tipo', 'pieza_retirada', 'codigo', l.codigo, 'nombre', l.nombre, 'cantidad', l.cantidad_entregada, 'valor_unitario', l.valor_unitario);
  end loop;

  -- 3.2 Piezas que cambian o se añaden.
  for n in select * from jsonb_array_elements(p -> 'lineas') loop
    v_producto := (n ->> 'producto_id')::uuid;
    v_cant := (n ->> 'cantidad')::integer;
    v_valor := (n ->> 'valor_unitario')::integer;
    if v_producto is null or v_cant is null or v_cant <= 0 or v_valor is null or v_valor < 0 then
      raise exception 'LINEA_INVALIDA: revisa la cantidad y el valor de cada pieza' using errcode = 'check_violation';
    end if;
    select codigo, nombre into v_codigo, v_nombre from public.productos where id = v_producto;
    if not found then
      raise exception 'LINEA_INVALIDA: el producto no existe' using errcode = 'check_violation';
    end if;

    select * into l from public.consignacion_lineas where consignacion_id = c.id and producto_id = v_producto for update;
    if not found then
      insert into public.consignacion_lineas (consignacion_id, producto_id, cantidad_entregada, valor_unitario)
      values (c.id, v_producto, v_cant, v_valor); -- el disparador saca las piezas del inventario
      cambios := cambios || jsonb_build_object('tipo', 'pieza_agregada', 'codigo', v_codigo, 'nombre', v_nombre, 'cantidad', v_cant, 'valor_unitario', v_valor);
    else
      if v_cant <> l.cantidad_entregada then
        if v_cant < l.cantidad_vendida + l.cantidad_devuelta then
          raise exception 'CANTIDAD_MENOR_A_LIQUIDADA: de % ya se liquidaron % piezas y se intenta dejar %', v_codigo, l.cantidad_vendida + l.cantidad_devuelta, v_cant
            using errcode = 'check_violation';
        end if;
        if v_cant > l.cantidad_entregada then
          insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
          values ('salida_consignacion', v_producto, v_cant - l.cantidad_entregada, v_valor, 'consignacion', c.id, now(), auth.uid(),
                  etiqueta || ' · modificación: se añaden piezas');
        else
          insert into public.movimientos_inventario (tipo, producto_id, cantidad, valor_unitario, documento_tipo, documento_id, fecha, registrado_por, nota)
          values ('retorno_consignacion', v_producto, l.cantidad_entregada - v_cant, l.valor_unitario, 'consignacion', c.id, now(), auth.uid(),
                  etiqueta || ' · modificación: se retiran piezas');
        end if;
        cambios := cambios || jsonb_build_object('tipo', 'cantidad', 'codigo', v_codigo, 'nombre', v_nombre, 'antes', l.cantidad_entregada, 'despues', v_cant);
      end if;
      if v_valor <> l.valor_unitario then
        if l.cantidad_vendida > 0 then
          raise exception 'VALOR_CON_VENTAS: % ya tiene piezas vendidas y su valor no se puede cambiar', v_codigo using errcode = 'check_violation';
        end if;
        cambios := cambios || jsonb_build_object('tipo', 'valor', 'codigo', v_codigo, 'nombre', v_nombre, 'antes', l.valor_unitario, 'despues', v_valor);
      end if;
      if v_cant <> l.cantidad_entregada or v_valor <> l.valor_unitario then
        update public.consignacion_lineas set cantidad_entregada = v_cant, valor_unitario = v_valor where id = l.id;
      end if;
    end if;
  end loop;

  -- 3.3 Fecha límite y nota.
  if p ? 'fecha_limite' and nullif(p ->> 'fecha_limite', '') is not null then
    v_limite := (p ->> 'fecha_limite')::date;
    if v_limite is distinct from c.fecha_limite then
      if v_limite < (c.fecha_entrega at time zone 'America/Bogota')::date then
        raise exception 'FECHA_LIMITE_INVALIDA: la fecha límite no puede ser anterior a la entrega' using errcode = 'check_violation';
      end if;
      cambios := cambios || jsonb_build_object('tipo', 'fecha_limite', 'antes', c.fecha_limite, 'despues', v_limite);
      update public.consignaciones set fecha_limite = v_limite where id = c.id;
    end if;
  end if;
  if p ? 'nota' then
    v_nota := trim(coalesce(p ->> 'nota', ''));
    if v_nota <> c.nota then
      cambios := cambios || jsonb_build_object('tipo', 'nota', 'antes', c.nota, 'despues', v_nota);
      update public.consignaciones set nota = v_nota where id = c.id;
    end if;
  end if;

  if jsonb_array_length(cambios) = 0 then
    raise exception 'SIN_CAMBIOS: no hay nada que modificar' using errcode = 'check_violation';
  end if;

  -- 3.4 Lo firmado ya no coincide: la firma se anula y queda anotado.
  if firmada then
    cambios := cambios || jsonb_build_object('tipo', 'firma_anulada', 'firmante', r.receptor_nombre, 'documento', r.receptor_documento, 'firmado_en', r.firmado_en, 'huella', r.firma_huella);
    delete from public.consignacion_recibos where id = r.id;
  end if;

  perform public.recalcular_consignacion(c.id);
  perform set_config('app.modificando_consignacion', '', true);

  select coalesce(sum(cantidad_entregada), 0) into v_piezas_despues from public.consignacion_lineas where consignacion_id = c.id;
  select total_entregado into v_total_despues from public.consignaciones where id = c.id;
  select coalesce(max(numero), 0) + 1 into v_numero from public.consignacion_modificaciones where consignacion_id = c.id;
  select coalesce(nullif(nombre, ''), correo, '') into v_usuario from public.perfiles where id = auth.uid();

  insert into public.consignacion_modificaciones (consignacion_id, numero, usuario_id, usuario_nombre, motivo, cambios, piezas_antes, piezas_despues, total_antes, total_despues)
  values (c.id, v_numero, auth.uid(), coalesce(v_usuario, ''), left(trim(coalesce(p ->> 'motivo', '')), 500), cambios, v_piezas_antes, v_piezas_despues, c.total_entregado, v_total_despues)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.modificar_consignacion(jsonb) from public, anon;
grant execute on function public.modificar_consignacion(jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. El recibo indica si la entrega fue modificada.
-- -----------------------------------------------------------------------------
create or replace function public.contenido_recibo(p_consignacion uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'negocio', jsonb_build_object(
      'nombre', a.nombre_negocio, 'telefono', a.telefono_negocio, 'documento', a.documento_negocio,
      'direccion', a.direccion_negocio, 'ciudad', a.ciudad_negocio, 'correo', a.correo_negocio),
    'condiciones', a.consignacion_condiciones,
    'consignacion', jsonb_build_object(
      'id', c.id, 'numero', c.numero, 'fecha_entrega', c.fecha_entrega, 'fecha_limite', c.fecha_limite,
      'nota', c.nota, 'total_entregado', c.total_entregado),
    'contacto', jsonb_build_object(
      'nombre', co.nombre, 'telefono', co.telefono, 'documento', co.documento,
      'direccion', co.direccion, 'ciudad', co.ciudad, 'correo', co.correo),
    'lineas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'codigo', p.codigo, 'nombre', p.nombre, 'cantidad', l.cantidad_entregada, 'valor_unitario', l.valor_unitario)
               order by l.creado_en, p.codigo), '[]'::jsonb)
        from public.consignacion_lineas l join public.productos p on p.id = l.producto_id
       where l.consignacion_id = c.id),
    'modificaciones', (
      select jsonb_build_object('cantidad', count(*), 'ultima', max(m.fecha))
        from public.consignacion_modificaciones m where m.consignacion_id = c.id)
  )
  from public.consignaciones c
  join public.contactos co on co.id = c.contacto_id
  cross join public.ajustes a
  where c.id = p_consignacion and c.eliminado_en is null and a.id = 1;
$$;
revoke execute on function public.contenido_recibo(uuid) from public, anon, authenticated;
grant execute on function public.contenido_recibo(uuid) to service_role;
