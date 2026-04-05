// ─────────────────────────────────────────────────────────────────────────────
// presentation/middleware/errorHandler.middleware.ts
// Middleware Express que captura errores y los transforma en respuestas HTTP.
// Responsabilidad única: traducir errores de dominio a respuestas HTTP.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/errors/AppError';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            status:  'error',
            message: err.message,
        });
        return;
    }

    console.error('[Unhandled Error]', err);
    res.status(500).json({
        status:  'error',
        message: 'Error interno del servidor.',
    });
}

// Re-export AppError para compatibilidad con código existente
export { AppError } from '../../domain/errors/AppError';
