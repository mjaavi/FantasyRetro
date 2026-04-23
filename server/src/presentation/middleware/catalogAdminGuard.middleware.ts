import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, InfrastructureError } from '../../domain/errors/AppError';
import { supabaseAdmin } from '../../infrastructure/supabase.client';

const ENV_CATALOG_ADMIN_IDS = new Set(
    (process.env.CATALOG_ADMIN_USER_IDS ?? '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
);

function isBootstrapCatalogAdmin(userId: string | undefined): boolean {
    return Boolean(userId && ENV_CATALOG_ADMIN_IDS.has(userId));
}

export async function requireCatalogAdmin(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new ForbiddenError('Debes iniciar sesion para acceder al catalogo.'));
        }

        if (isBootstrapCatalogAdmin(userId)) {
            return next();
        }

        const { data, error } = await supabaseAdmin
            .from('platform_user_roles')
            .select('user_id')
            .eq('user_id', userId)
            .eq('role', 'catalog_admin')
            .maybeSingle();

        if (error) {
            return next(new InfrastructureError(`No se pudo verificar el rol catalog_admin: ${error.message}`));
        }

        if (!data) {
            return next(new ForbiddenError('Acceso restringido al administrador global del catalogo.'));
        }

        next();
    } catch (err) {
        next(err);
    }
}
