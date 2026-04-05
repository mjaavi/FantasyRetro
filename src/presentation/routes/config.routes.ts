import { Router } from 'express';

export function createConfigRouter(): Router {
    const r = Router();

    r.get('/config', (req, res) => {
        const config = {
            apiUrl: process.env.API_URL ?? `${req.protocol}://${req.get('host')}/api`,
            // URL base del frontend (usada como redirectTo en emails de Supabase)
            frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseAnonKey: process.env.SUPABASE_KEY,
            // Alias temporal para compatibilidad con codigo antiguo.
            supabaseKey: process.env.SUPABASE_KEY,
        };

        res.json({
            status: 'ok',
            ...config,
            data: config,
        });
    });

    return r;
}
