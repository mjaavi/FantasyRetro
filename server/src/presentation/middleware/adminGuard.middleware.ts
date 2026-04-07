import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, InfrastructureError, ValidationError } from '../../domain/errors/AppError';
import { supabaseAdmin } from '../../infrastructure/supabase.client';

export async function requireLeagueAdmin(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const leagueId = Number(req.params.leagueId);

        if (!Number.isInteger(leagueId) || leagueId <= 0) {
            return next(new ValidationError('ID de liga invalido.'));
        }

        const { data, error } = await supabaseAdmin
            .from('fantasy_leagues')
            .select('admin_id')
            .eq('id', leagueId)
            .maybeSingle();

        if (error) {
            return next(new InfrastructureError(`No se pudo verificar el administrador de la liga: ${error.message}`));
        }

        if (!data) {
            return next(new ForbiddenError('Liga no encontrada o sin permisos de administracion.'));
        }

        if (data.admin_id !== req.userId) {
            return next(new ForbiddenError('Acceso restringido al administrador de esta liga.'));
        }

        next();
    } catch (err) {
        next(err);
    }
}
