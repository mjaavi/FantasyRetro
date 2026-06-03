-- Migración para añadir el rol 'platform_admin' al check constraint de platform_user_roles.

alter table public.platform_user_roles
    drop constraint if exists platform_user_roles_role_check;

alter table public.platform_user_roles
    add constraint platform_user_roles_role_check
    check (role in ('catalog_admin', 'platform_admin'));
