import { ISupportRepository, SupportTicket, SupportTicketRecord } from '../../domain/ports/ISupportRepository';
import { supabaseAdmin } from '../supabase.client';

export class SupabaseSupportRepository implements ISupportRepository {
    async createTicket(ticket: SupportTicket): Promise<SupportTicketRecord> {
        const { data, error } = await supabaseAdmin
            .from('support_tickets')
            .insert({
                user_id: ticket.userId,
                email: ticket.email,
                subject: ticket.subject,
                message: ticket.message,
            })
            .select('id, user_id, email, subject, message, created_at')
            .single();

        if (error) {
            throw new Error(`No se pudo registrar el ticket de soporte: ${error.message}`);
        }

        return {
            id: String(data.id),
            userId: data.user_id ? String(data.user_id) : null,
            email: String(data.email),
            subject: String(data.subject),
            message: String(data.message),
            createdAt: String(data.created_at),
        };
    }
}
