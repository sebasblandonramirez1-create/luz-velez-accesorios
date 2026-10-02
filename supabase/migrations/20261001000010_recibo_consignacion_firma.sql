-- =============================================================================
-- Migración 10: recibo de entrega en consignación con más datos y firma
-- electrónica.
--
--   * contactos: documento, correo y ciudad (datos de quien recibe).
--   * ajustes: datos del negocio para el recibo, plazo y condiciones.
--   * consignaciones: fecha límite para liquidar.
--   * consignacion_recibos: enlace de firma (token), datos que escribe quien
--     recibe, la firma dibujada, fecha, IP, navegador y huella del contenido.
--
-- Quien recibe no tiene cuenta: entra con el enlace (token) y solo puede leer
-- ese recibo y firmarlo una vez, a través de funciones security definer. anon
-- sigue sin permiso sobre ninguna tabla.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columnas nuevas
-- -----------------------------------------------------------------------------
alter table public.contactos
  add column documento text not null default '',
  add column correo    text not null default '',
  add column ciudad    text not null default '';

alter table public.ajustes
  add column documento_negocio text not null default '',
  add column direccion_negocio text not null default '',
  add column ciudad_negocio    text not null default '',
  add column correo_negocio    text not null default '',
  add column consignacion_dias_plazo integer not null default 30 check (consignacion_dias_plazo between 1 and 365),
  add column consignacion_condiciones text not null default
    E'1. La mercancía relacionada se entrega en consignación y sigue siendo propiedad de quien la entrega hasta que se pague.\n'
    '2. Quien recibe se compromete a liquidar, es decir, a pagar lo vendido y devolver lo no vendido, a más tardar en la fecha límite de este recibo.\n'
    '3. Las piezas vendidas se pagan al valor unitario que aparece en este recibo.\n'
    '4. Quien recibe responde por la pérdida, el daño o el deterioro de las piezas mientras estén en su poder. Las piezas que devuelva deben estar en buen estado.\n'
    '5. Las piezas que no se devuelvan ni se paguen en la fecha límite se entienden vendidas y se cobran al valor de este recibo.';

alter table public.consignaciones add column fecha_limite date;
update public.consignaciones
   set fecha_limite = (fecha_entrega at time zone 'America/Bogota')::date + 30
 where fecha_limite is null;

-- -----------------------------------------------------------------------------
-- 2. Recibos: un registro por consignación, creado al pedir la firma.
-- -----------------------------------------------------------------------------
create table public.consignacion_recibos (
  id                 uuid primary key default gen_random_uuid(),
  consignacion_id    uuid not null unique references public.consignaciones (id) on delete cascade,
  token              uuid not null unique default gen_random_uuid(),
  token_vence        timestamptz not null,
  receptor_nombre    text not null default '',
  receptor_documento text not null default '',
  receptor_telefono  text not null default '',
  receptor_direccion text not null default '',
  receptor_ciudad    text not null default '',
  receptor_correo    text not null default '',
  firma_imagen       text,
  firmado_en         timestamptz,
  firma_ip           text not null default '',
  firma_agente       text not null default '',
  firma_huella       text not null default '',
  solicitado_por     uuid references public.perfiles (id),
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  constraint recibo_firma_completa check ((firmado_en is null) = (firma_imagen is null)),
  constraint recibo_firma_png check (firma_imagen is null or (firma_imagen like 'data:image/png;base64,%' and length(firma_imagen) <= 400000))
);
create trigger consignacion_recibos_actualizado before update on public.consignacion_recibos
  for each row execute function public.marcar_actualizado();

alter table public.consignacion_recibos enable row level security;
-- Las usuarias de la app solo leen; se escribe únicamente desde las funciones.
create policy consignacion_recibos_ver on public.consignacion_recibos for select to authenticated using (public.es_usuaria_activa());

revoke all on public.consignacion_recibos from public, anon, authenticated;
grant select on public.consignacion_recibos to authenticated;
grant select, insert, update, delete on public.consignacion_recibos to service_role;

-- -----------------------------------------------------------------------------
-- 3. Contenido del recibo (uso interno de las funciones de abajo).
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
       where l.consignacion_id = c.id)
  )
  from public.consignaciones c
  join public.contactos co on co.id = c.contacto_id
  cross join public.ajustes a
  where c.id = p_consignacion and c.eliminado_en is null and a.id = 1;
$$;
revoke execute on function public.contenido_recibo(uuid) from public, anon, authenticated;
grant execute on function public.contenido_recibo(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Pedir la firma: crea (o renueva) el enlace. Cualquier usuaria activa.
-- -----------------------------------------------------------------------------
create or replace function public.preparar_firma_consignacion(p_consignacion uuid, p_dias integer default 15)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.consignacion_recibos%rowtype;
  v_dias integer := least(greatest(coalesce(p_dias, 15), 1), 90);
begin
  if not public.es_usuaria_activa() then
    raise exception 'SIN_PERMISO: hace falta una sesión activa' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.consignaciones where id = p_consignacion and eliminado_en is null) then
    raise exception 'RECIBO_NO_ENCONTRADO: la consignación no existe' using errcode = 'no_data_found';
  end if;
  select * into r from public.consignacion_recibos where consignacion_id = p_consignacion for update;
  if found then
    if r.firmado_en is not null then
      raise exception 'RECIBO_YA_FIRMADO: este recibo ya está firmado' using errcode = 'check_violation';
    end if;
    -- Si el enlace anterior venció se cambia el token; si sigue vigente se
    -- conserva (los enlaces ya enviados siguen sirviendo) y se amplía el plazo.
    update public.consignacion_recibos
       set token = case when token_vence < now() then gen_random_uuid() else token end,
           token_vence = now() + make_interval(days => v_dias),
           solicitado_por = auth.uid()
     where id = r.id
     returning * into r;
  else
    insert into public.consignacion_recibos (consignacion_id, token_vence, solicitado_por)
    values (p_consignacion, now() + make_interval(days => v_dias), auth.uid())
    returning * into r;
  end if;
  return r.token;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Leer el recibo con el enlace (anon). Devuelve null si el enlace no existe.
-- -----------------------------------------------------------------------------
create or replace function public.recibo_para_firmar(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r public.consignacion_recibos%rowtype;
  contenido jsonb;
begin
  select * into r from public.consignacion_recibos where token = p_token;
  if not found then return null; end if;
  contenido := public.contenido_recibo(r.consignacion_id);
  if contenido is null then return null; end if; -- consignación anulada
  if r.firmado_en is null and r.token_vence < now() then
    return jsonb_build_object('estado', 'vencido', 'negocio', contenido -> 'negocio');
  end if;
  return contenido || jsonb_build_object(
    'estado', case when r.firmado_en is null then 'pendiente' else 'firmado' end,
    'vence', r.token_vence,
    'receptor', jsonb_build_object(
      'nombre', r.receptor_nombre, 'documento', r.receptor_documento, 'telefono', r.receptor_telefono,
      'direccion', r.receptor_direccion, 'ciudad', r.receptor_ciudad, 'correo', r.receptor_correo),
    'firma', case when r.firmado_en is null then null else
      jsonb_build_object('imagen', r.firma_imagen, 'firmado_en', r.firmado_en, 'huella', r.firma_huella) end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Firmar (anon, una sola vez).
--    p = { nombre, documento, telefono?, direccion?, ciudad?, correo?,
--          firma: 'data:image/png;base64,…', acepta: true, ip?, agente? }
-- -----------------------------------------------------------------------------
create or replace function public.firmar_recibo_consignacion(p_token uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.consignacion_recibos%rowtype;
  contenido jsonb;
  receptor jsonb;
  v_firma text := coalesce(p ->> 'firma', '');
  v_huella text;
  v_ahora timestamptz := now();
  recortar constant integer := 200;
begin
  select * into r from public.consignacion_recibos where token = p_token for update;
  if not found then
    raise exception 'RECIBO_NO_ENCONTRADO: el enlace no es válido' using errcode = 'no_data_found';
  end if;
  if r.firmado_en is not null then
    raise exception 'RECIBO_YA_FIRMADO: este recibo ya está firmado' using errcode = 'check_violation';
  end if;
  if r.token_vence < v_ahora then
    raise exception 'RECIBO_VENCIDO: el enlace venció' using errcode = 'check_violation';
  end if;
  contenido := public.contenido_recibo(r.consignacion_id);
  if contenido is null then
    raise exception 'RECIBO_NO_ENCONTRADO: la entrega fue anulada' using errcode = 'no_data_found';
  end if;
  if coalesce((p ->> 'acepta')::boolean, false) is not true then
    raise exception 'RECIBO_SIN_ACEPTAR: falta aceptar las condiciones' using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(p ->> 'nombre', ''))) < 3 or length(regexp_replace(coalesce(p ->> 'documento', ''), '\D', '', 'g')) < 5 then
    raise exception 'RECIBO_DATOS_INCOMPLETOS: faltan el nombre completo o el documento' using errcode = 'check_violation';
  end if;
  if v_firma not like 'data:image/png;base64,%' or length(v_firma) < 200 or length(v_firma) > 400000 then
    raise exception 'RECIBO_FIRMA_INVALIDA: la firma no es válida' using errcode = 'check_violation';
  end if;

  receptor := jsonb_build_object(
    'nombre',    left(trim(p ->> 'nombre'), recortar),
    'documento', left(trim(p ->> 'documento'), 40),
    'telefono',  left(trim(coalesce(p ->> 'telefono', '')), 40),
    'direccion', left(trim(coalesce(p ->> 'direccion', '')), recortar),
    'ciudad',    left(trim(coalesce(p ->> 'ciudad', '')), 80),
    'correo',    left(lower(trim(coalesce(p ->> 'correo', ''))), 120));

  -- Huella: SHA-256 del contenido entregado, los datos de quien firma, la firma
  -- y la fecha. Si después cambia algo del recibo, la huella deja de coincidir.
  v_huella := encode(sha256(convert_to(
    (contenido - 'contacto')::text || receptor::text || v_firma || to_char(v_ahora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'UTF8')), 'hex');

  update public.consignacion_recibos
     set receptor_nombre = receptor ->> 'nombre', receptor_documento = receptor ->> 'documento',
         receptor_telefono = receptor ->> 'telefono', receptor_direccion = receptor ->> 'direccion',
         receptor_ciudad = receptor ->> 'ciudad', receptor_correo = receptor ->> 'correo',
         firma_imagen = v_firma, firmado_en = v_ahora,
         firma_ip = left(coalesce(p ->> 'ip', ''), 80), firma_agente = left(coalesce(p ->> 'agente', ''), 300),
         firma_huella = v_huella
   where id = r.id;

  -- Completa la ficha del contacto solo donde estaba vacía.
  update public.contactos co
     set documento = case when co.documento = '' then receptor ->> 'documento' else co.documento end,
         telefono  = case when co.telefono  = '' then receptor ->> 'telefono'  else co.telefono  end,
         direccion = case when co.direccion = '' then receptor ->> 'direccion' else co.direccion end,
         ciudad    = case when co.ciudad    = '' then receptor ->> 'ciudad'    else co.ciudad    end,
         correo    = case when co.correo    = '' then receptor ->> 'correo'    else co.correo    end
    from public.consignaciones c
   where c.id = r.consignacion_id and co.id = c.contacto_id;

  return jsonb_build_object('firmado_en', v_ahora, 'huella', v_huella);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Anular la firma o el enlace (solo la propietaria): permite pedirla de nuevo.
-- -----------------------------------------------------------------------------
create or replace function public.anular_firma_consignacion(p_consignacion uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_propietaria() then
    raise exception 'SIN_PERMISO: solo la propietaria puede anular una firma' using errcode = 'insufficient_privilege';
  end if;
  delete from public.consignacion_recibos where consignacion_id = p_consignacion;
end;
$$;

revoke execute on function public.preparar_firma_consignacion(uuid, integer) from public, anon;
revoke execute on function public.anular_firma_consignacion(uuid) from public, anon;
grant execute on function public.preparar_firma_consignacion(uuid, integer), public.anular_firma_consignacion(uuid) to authenticated, service_role;

revoke execute on function public.recibo_para_firmar(uuid) from public;
revoke execute on function public.firmar_recibo_consignacion(uuid, jsonb) from public;
grant execute on function public.recibo_para_firmar(uuid), public.firmar_recibo_consignacion(uuid, jsonb) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. registrar_consignacion: acepta fecha_limite; si no llega, usa el plazo de Ajustes.
--    p = { contacto_id, fecha_entrega?, fecha_limite?, nota?, lineas: [...] }
-- -----------------------------------------------------------------------------
create or replace function public.registrar_consignacion(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid; l jsonb;
  v_entrega timestamptz := coalesce((p ->> 'fecha_entrega')::timestamptz, now());
  v_plazo integer;
  v_limite date;
begin
  if not public.es_usuaria_activa() then
    raise exception 'SIN_PERMISO: hace falta una sesión activa' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_array_length(coalesce(p -> 'lineas', '[]'::jsonb)) = 0 then
    raise exception 'CONSIGNACION_SIN_LINEAS: la entrega necesita al menos un producto' using errcode = 'check_violation';
  end if;
  select consignacion_dias_plazo into v_plazo from public.ajustes where id = 1;
  v_limite := coalesce(nullif(p ->> 'fecha_limite', '')::date, (v_entrega at time zone 'America/Bogota')::date + coalesce(v_plazo, 30));
  if v_limite < (v_entrega at time zone 'America/Bogota')::date then
    raise exception 'FECHA_LIMITE_INVALIDA: la fecha límite no puede ser anterior a la entrega' using errcode = 'check_violation';
  end if;
  insert into public.consignaciones (contacto_id, fecha_entrega, fecha_limite, nota, registrado_por)
  values ((p ->> 'contacto_id')::uuid, v_entrega, v_limite, coalesce(p ->> 'nota', ''), auth.uid())
  returning id into v_id;
  for l in select * from jsonb_array_elements(p -> 'lineas') loop
    insert into public.consignacion_lineas (consignacion_id, producto_id, cantidad_entregada, valor_unitario)
    values (v_id, (l ->> 'producto_id')::uuid, (l ->> 'cantidad')::integer, (l ->> 'valor_unitario')::integer);
  end loop;
  return v_id;
end;
$$;
