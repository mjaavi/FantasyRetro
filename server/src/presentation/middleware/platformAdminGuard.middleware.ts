import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, InfrastructureError } from '../../domain/errors/AppError';
import { supabaseAdmin } from '../../infrastructure/supabase.client';

const ENV_PLATFORM_ADMIN_IDS = new Set(
    (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
);

export function isBootstrapPlatformAdmin(userId: string | undefined): boolean {
    return Boolean(userId && ENV_PLATFORM_ADMIN_IDS.has(userId));
}

export async function requirePlatformAdmin(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new ForbiddenError('Debes iniciar sesión para realizar operaciones de administración.'));
        }

        // Si está en la lista bootstrap, permitir
        if (isBootstrapPlatformAdmin(userId)) {
            return next();
        }

        // Verificar rol en la base de datos
        const { data, error } = await supabaseAdmin
            .from('platform_user_roles')
            .select('user_id')
            .eq('user_id', userId)
            .eq('role', 'platform_admin')
            .maybeSingle();

        if (error) {
            return next(new InfrastructureError(`No se pudo verificar el rol platform_admin: ${error.message}`));
        }

        if (!data) {
            return next(new ForbiddenError('Acceso denegado. Se requieren permisos de Administrador de Plataforma.'));
        }

        next();
    } catch (err) {
        next(err);
    }
}
