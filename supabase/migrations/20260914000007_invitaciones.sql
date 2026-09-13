-- =============================================================================
-- Migración 7: invitaciones con rol (propietaria o ayudante).
--
-- La propietaria invita por correo eligiendo el rol. La persona invitada crea
-- su cuenta desde la pantalla de ingreso («Crear cuenta con invitación») con
-- ese mismo correo, sin necesidad de la clave de servicio en el servidor.
-- Regla del perfil al registrarse:
--   · si no existe ninguna propietaria → propietaria (primera cuenta);
--   · si hay invitación pendiente para el correo → el rol de la invitación;
--   · en otro caso → se rechaza el registro (SIN_INVITACION).
-- =============================================================================

create table public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  correo      text not null,
  rol         public.rol_usuario not null default 'ayudante',
  nombre      text not null default '',
  creada_por  uuid references public.perfiles (id),
  creada_en   timestamptz not null default now(),
  usada_en    timestamptz,
  usada_por   uuid references public.perfiles (id)
);
create unique index invitaciones_correo_pendiente on public.invitaciones (lower(correo)) where usada_en is null;

alter table public.invitaciones enable row level security;
create policy invitaciones_todo on public.invitaciones for all to authenticated using (public.es_propietaria()) with check (public.es_propietaria());
grant select, insert, update, delete on public.invitaciones to authenticated, service_role;

create or replace function public.crear_perfil_para_usuario()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hay_propietaria boolean;
  inv public.invitaciones%rowtype;
  v_rol public.rol_usuario;
  v_nombre text;
begin
  select exists (select 1 from public.perfiles where rol = 'propietaria') into hay_propietaria;
  v_nombre := coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(coalesce(new.email, ''), '@', 1));

  if not hay_propietaria then
    v_rol := 'propietaria';
  else
    select * into inv from public.invitaciones where lower(correo) = lower(coalesce(new.email, '')) and usada_en is null limit 1;
    if inv.id is null then
      raise exception 'SIN_INVITACION: el correo % no tiene invitación. Pide a la propietaria que te invite desde Ajustes → Usuarias.', new.email
        using errcode = 'insufficient_privilege';
    end if;
    v_rol := inv.rol;
    if inv.nombre <> '' and nullif(new.raw_user_meta_data ->> 'nombre', '') is null then v_nombre := inv.nombre; end if;
  end if;

  insert into public.perfiles (id, nombre, correo, rol)
  values (new.id, v_nombre, coalesce(new.email, ''), v_rol)
  on conflict (id) do nothing;

  if inv.id is not null then
    update public.invitaciones set usada_en = now(), usada_por = new.id where id = inv.id;
  end if;
  return new;
end;
$$;
