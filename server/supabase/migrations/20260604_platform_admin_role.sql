-- Migración para añadir el rol 'platform_admin' al check constraint de platform_user_roles.

alter table public.platform_user_roles
    drop constraint if exists platform_user_roles_role_check;

alter table public.platform_user_roles
    add constraint platform_user_roles_role_check
    check (role in ('catalog_admin', 'platform_admin'));

-- Asignar el rol 'platform_admin' al usuario admin@retrofantasy.com si existe
insert into public.platform_user_roles (user_id, role, notes)
select id, 'platform_admin', 'Asignado automáticamente durante la migración'
from auth.users
where email = 'admin@retrofantasy.com'
on conflict (user_id, role) do nothing;
