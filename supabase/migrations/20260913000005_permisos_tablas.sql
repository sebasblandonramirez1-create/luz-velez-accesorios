-- =============================================================================
-- Migración 5: permisos explícitos sobre tablas, vistas y secuencias.
--
-- Al aplicar las migraciones con la CLI (rol cli_login_postgres) las tablas no
-- heredaron los privilegios por defecto de Supabase, y authenticated quedó sin
-- SELECT/INSERT/UPDATE/DELETE ("permission denied for table perfiles").
-- Desde aquí, cada migración concede sus permisos de forma explícita; el entorno
-- de pruebas ya no aplica privilegios por defecto para que esto se detecte.
--
-- Modelo: anon solo lee el catálogo público; authenticated opera sobre todo
-- (las políticas RLS acotan por rol de la app); service_role puede todo.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Tablas y vistas: authenticated y service_role.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- anon: nada, salvo la vista del catálogo público.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.catalogo_publico to anon;

-- Las tablas que solo se escriben desde funciones security definer no admiten
-- escritura directa (RLS ya lo impide; se refuerza a nivel de privilegio).
revoke insert, update, delete on public.auditoria from authenticated;
revoke insert, update, delete on public.precio_historial from authenticated;
revoke insert, update, delete on public.cuentas_por_cobrar from authenticated;
revoke delete on public.perfiles from authenticated;
revoke insert, delete on public.ajustes from authenticated;
