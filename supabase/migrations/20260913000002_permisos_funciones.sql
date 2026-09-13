-- =============================================================================
-- Migración 2: permisos de ejecución de funciones.
--
-- En Supabase, las funciones del esquema public son ejecutables por anon y
-- authenticated por defecto. Se restringe:
--   · anon (sin sesión) no ejecuta ninguna función de la app.
--   · purgar_papelera y recalcular_todo_el_stock quedan solo para el servicio
--     (clave secreta), que es quien las usa desde GitHub Actions y restauraciones.
--   · siguiente_codigo y recalcular_stock siguen disponibles con sesión, porque
--     las usan el formulario de producto y los disparadores de movimientos.
-- =============================================================================

revoke execute on function public.siguiente_codigo(text, integer) from anon;
revoke execute on function public.stock_calculado(uuid) from anon;
revoke execute on function public.recalcular_stock(uuid) from anon;
revoke execute on function public.recalcular_todo_el_stock() from anon, authenticated;
revoke execute on function public.purgar_papelera(integer) from anon, authenticated;
revoke execute on function public.rol_actual() from anon;
revoke execute on function public.es_propietaria() from anon;
revoke execute on function public.es_usuaria_activa() from anon;
revoke execute on function public.signo_movimiento(public.tipo_movimiento) from anon;

-- Las funciones que se creen en adelante no serán ejecutables por anon.
alter default privileges in schema public revoke execute on functions from anon;
