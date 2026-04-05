// ─────────────────────────────────────────────────────────────────────────────
// presentation/middleware/adminGuard.middleware.ts
//
// Middleware de autorización para rutas de administración.
// Debe usarse SIEMPRE después de requireAuth (que ya verificó el JWT).
//
// Comprueba que el usuario autenticado tenga role = 'admin' en sus
// app_metadata de Supabase Auth. Este campo solo puede ser establecido
// por el service_role desde el servidor — los usuarios no pueden modificarlo.
//
// Uso en rutas:
//   r.post('/admin/...', requireAuth, requireAdmin, ctrl.handler);
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../infrastructure/supabase.client';
import { ForbiddenError } from '../../domain/errors/AppError';

export async function requireAdmin(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        // req.userId ya está verificado por requireAuth; el non-null assert es seguro.
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(req.userId!);

        if (error || !data?.user) {
            return next(new ForbiddenError('No se pudo verificar el rol del usuario.'));
        }

        const role = data.user.app_metadata?.role;

        if (role !== 'admin') {
            return next(new ForbiddenError('Acceso restringido a administradores.'));
        }

        next();
    } catch (err) {
        next(err);
    }
}