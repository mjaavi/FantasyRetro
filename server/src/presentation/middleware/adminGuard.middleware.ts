import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, InfrastructureError, ValidationError } from '../../domain/errors/AppError';
import { supabaseAdmin } from '../../infrastructure/supabase.client';

async function getLeagueAdminId(leagueId: number): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('fantasy_leagues')
        .select('admin_id')
        .eq('id', leagueId)
        .maybeSingle();

    if (error) {
        throw new InfrastructureError(`No se pudo verificar la liga: ${error.message}`);
    }

    return data?.admin_id ?? null;
}

async function isLeagueParticipant(leagueId: number, userId: string | undefined): Promise<boolean> {
    if (!userId) {
        return false;
    }

    const { data, error } = await supabaseAdmin
        .from('league_participants')
        .select('league_id')
        .eq('league_id', leagueId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw new InfrastructureError(`No se pudo verificar la participacion en la liga: ${error.message}`);
    }

    return Boolean(data);
}

export async function requireLeagueParticipant(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const leagueId = Number(req.params.leagueId);

        if (!Number.isInteger(leagueId) || leagueId <= 0) {
            return next(new ValidationError('ID de liga invalido.'));
        }

        const participant = await isLeagueParticipant(leagueId, req.userId);
        if (!participant) {
            return next(new ForbiddenError('Debes pertenecer a esta liga para acceder a estos datos.'));
        }

        next();
    } catch (err) {
        next(err);
    }
}

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

        const adminId = await getLeagueAdminId(leagueId);
        if (!adminId) {
            return next(new ForbiddenError('Liga no encontrada o sin permisos de administracion.'));
        }

        if (adminId !== req.userId) {
            return next(new ForbiddenError('Acceso restringido al administrador de esta liga.'));
        }

        next();
    } catch (err) {
        next(err);
    }
}
