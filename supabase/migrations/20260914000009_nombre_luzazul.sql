-- =============================================================================
-- Migración 9: el negocio se llama «Luzazul Accesorios».
-- Cambia el valor por defecto y actualiza el nombre si todavía era el inicial.
-- =============================================================================

alter table public.ajustes alter column nombre_negocio set default 'Luzazul Accesorios';
update public.ajustes set nombre_negocio = 'Luzazul Accesorios' where id = 1 and nombre_negocio = 'Luz Vélez Accesorios';
