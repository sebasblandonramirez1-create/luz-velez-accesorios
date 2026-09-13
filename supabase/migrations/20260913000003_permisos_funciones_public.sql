-- =============================================================================
-- Migración 3: la migración 2 revocó de anon, pero Postgres concede EXECUTE al
-- pseudo-rol PUBLIC en toda función nueva, y anon lo hereda. Aquí se revoca de
-- PUBLIC y se concede de forma explícita a quien corresponde.
-- =============================================================================

do $$
declare
  f text;
begin
  -- Funciones que usa la app con sesión iniciada (y el servicio).
  foreach f in array array[
    'public.siguiente_codigo(text, integer)',
    'public.stock_calculado(uuid)',
    'public.recalcular_stock(uuid)',
    'public.rol_actual()',
    'public.es_propietaria()',
    'public.es_usuaria_activa()',
    'public.signo_movimiento(public.tipo_movimiento)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;

  -- Funciones reservadas al servicio (GitHub Actions, restauraciones).
  foreach f in array array[
    'public.recalcular_todo_el_stock()',
    'public.purgar_papelera(integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- Las funciones que se creen en adelante no serán ejecutables por PUBLIC ni anon.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
