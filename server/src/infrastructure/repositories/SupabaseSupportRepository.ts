import { createClient } from '@supabase/supabase-js';

export interface SupportTicket {
    user_id: string | null;
    email: string;
    subject: string;
    message: string;
}

export class SupabaseSupportRepository {
    private supabase;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async createTicket(ticket: SupportTicket): Promise<void> {
        const { error } = await this.supabase
            .from('support_tickets')
            .insert({
                user_id: ticket.user_id,
                email: ticket.email,
                subject: ticket.subject,
                message: ticket.message
            });

        if (error) {
            console.warn('[SupportRepository] Tabla support_tickets no encontrada o error:', error.message);
            // Si la tabla no existe (ej. no se corrieron migraciones), no rompemos la app (como pidió el user para el TFG)
        }
    }
}
