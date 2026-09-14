-- =============================================================================
-- Migración 8: datos públicos del negocio para la página del catálogo.
-- La vista catalogo_publico ya existe (migración 1); aquí se expone, solo para
-- anon, el nombre, el teléfono y la dirección del catálogo, sin el resto de
-- ajustes.
-- =============================================================================

create or replace function public.datos_publicos_negocio()
returns table (nombre_negocio text, telefono_negocio text, catalogo_slug text, catalogo_publico_activo boolean)
language sql stable security definer set search_path = public as $$
  select nombre_negocio, telefono_negocio, catalogo_slug, catalogo_publico_activo from public.ajustes where id = 1;
$$;

revoke execute on function public.datos_publicos_negocio() from public;
grant execute on function public.datos_publicos_negocio() to anon, authenticated, service_role;
