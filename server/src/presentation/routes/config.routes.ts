import { Router } from 'express';

export function createConfigRouter(): Router {
    const r = Router();

    r.get('/config', (req, res) => {
        // Render (y otros proxies) termina TLS antes de Express: req.protocol = 'http'.
        // X-Forwarded-Proto contiene el protocolo real del cliente ('https' en producción).
        const proto = (req.headers['x-forwarded-proto'] as string)
            ?.split(',')[0]?.trim() ?? req.protocol;

        const config = {
            apiUrl:         process.env.API_URL ?? `${proto}://${req.get('host')}/api`,
            frontendUrl:    process.env.FRONTEND_URL ?? 'http://localhost:3000',
            supabaseUrl:    process.env.SUPABASE_URL,
            supabaseAnonKey: process.env.SUPABASE_KEY,
            supabaseKey:    process.env.SUPABASE_KEY,
        };

        res.json({ status: 'ok', ...config, data: config });
    });


    return r;
}
