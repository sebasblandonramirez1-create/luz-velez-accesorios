-- =============================================================================
-- Migración 12: clasificación de productos por código corto.
--
-- Cada producto puede llevar una clasificación (CP, CM, CCH, PL, PLM…) que
-- aparece junto al código y la descripción en recibos, hojas, listas y
-- reportes, con un conteo por clasificación al final. La lista se administra
-- desde Ajustes (solo la propietaria); nace con las cinco de la propietaria.
-- Los productos sin clasificar se señalan en la app.
-- =============================================================================

create table public.clasificaciones_producto (
  codigo         text primary key check (codigo ~ '^[A-Z]{1,6}$'),
  nombre         text not null check (length(trim(nombre)) > 0),
  orden          integer not null default 0,
  activa         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create trigger clasificaciones_producto_actualizado before update on public.clasificaciones_producto
  for each row execute function public.marcar_actualizado();

insert into public.clasificaciones_producto (codigo, nombre, orden) values
  ('CP',  'Collar de piedras', 1),
  ('CM',  'Collar medio',      2),
  ('CCH', 'Collar choker',     3),
  ('PL',  'Pulsera',           4),
  ('PLM', 'Pulsera media',     5);

alter table public.productos
  add column clasificacion text references public.clasificaciones_producto (codigo) on update cascade;
create index productos_clasificacion_idx on public.productos (clasificacion) where eliminado_en is null;

-- RLS: todas las usuarias activas la leen; solo la propietaria la cambia.
alter table public.clasificaciones_producto enable row level security;
create policy clasificaciones_ver on public.clasificaciones_producto for select to authenticated using (public.es_usuaria_activa());
create policy clasificaciones_crear on public.clasificaciones_producto for insert to authenticated with check (public.es_propietaria());
create policy clasificaciones_editar on public.clasificaciones_producto for update to authenticated using (public.es_propietaria()) with check (public.es_propietaria());
create policy clasificaciones_borrar on public.clasificaciones_producto for delete to authenticated using (public.es_propietaria());

revoke all on public.clasificaciones_producto from public, anon;
grant select, insert, update, delete on public.clasificaciones_producto to authenticated, service_role;

-- El recibo lleva la clasificación de cada pieza y la lista de clasificaciones
-- (para el conteo por clasificación con su nombre).
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
               'codigo', p.codigo, 'nombre', p.nombre, 'clasificacion', p.clasificacion,
               'cantidad', l.cantidad_entregada, 'valor_unitario', l.valor_unitario)
               order by l.creado_en, p.codigo), '[]'::jsonb)
        from public.consignacion_lineas l join public.productos p on p.id = l.producto_id
       where l.consignacion_id = c.id),
    'clasificaciones', (
      select coalesce(jsonb_agg(jsonb_build_object('codigo', k.codigo, 'nombre', k.nombre) order by k.orden, k.codigo), '[]'::jsonb)
        from public.clasificaciones_producto k),
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
