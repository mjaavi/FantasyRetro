import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/errors/AppError';
import { supabase } from '../../infrastructure/supabase.client';

// Extendemos el tipo Request de Express para añadir el userId autenticado
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

// ─────────────────────────────────────────────
// 🛡️  PILAR 1: SEGURIDAD — Autenticación Real
// ANTES: const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
//        → CUALQUIER petición actuaba como ese usuario
//        → Principio de menor privilegio completamente violado
// AHORA: Se extrae y verifica el JWT de Supabase del header Authorization.
//        Solo los usuarios autenticados pueden acceder a rutas protegidas.
//        req.userId queda disponible en los controladores de forma segura.
// ─────────────────────────────────────────────
export async function requireAuth(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            throw new AppError('No autenticado. Token no proporcionado.', 401);
        }

        const token = authHeader.split(' ')[1];

        // Verificamos el token con Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            throw new AppError('Token inválido o expirado.', 401);
        }

        // Inyectamos el userId verificado en el request para uso en controladores
        req.userId = user.id;
        next();
    } catch (err) {
        next(err);
    }
}
