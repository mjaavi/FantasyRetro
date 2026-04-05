import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from './errorHandler.middleware';

export const CreateBidSchema = z.object({
    player_id: z.string().uuid({ message: 'player_id debe ser un UUID válido' }),
    amount: z
        .number({ message: 'amount debe ser un número' })
        .int({ message: 'amount debe ser un número entero' })
        .positive({ message: 'amount debe ser un número positivo' })
        .max(500_000_000, { message: 'La puja supera el límite permitido' }),
});

export type CreateBidDto = z.infer<typeof CreateBidSchema>;

export const PlayerIdParamSchema = z.object({
    playerId: z.string().uuid({ message: 'playerId debe ser un UUID válido' }),
});

export function validate<T extends z.ZodTypeAny>(
    schema: T,
    source: 'body' | 'params' | 'query' = 'body',
) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            const errorMessage = result.error.issues
                .map(issue => `${issue.path.join('.')}: ${issue.message}`)
                .join('; ');

            next(new AppError(errorMessage, 400));
            return;
        }

        req[source] = result.data;
        next();
    };
}

export const validateBody = <T extends z.ZodTypeAny>(schema: T) => validate(schema, 'body');
export const createBidSchema = CreateBidSchema;
