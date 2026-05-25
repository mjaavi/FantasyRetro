export interface SupportTicket {
    userId: string | null;
    email: string;
    subject: string;
    message: string;
}

export interface SupportTicketRecord extends SupportTicket {
    id: string;
    createdAt: string;
}

export interface ISupportRepository {
    createTicket(ticket: SupportTicket): Promise<SupportTicketRecord>;
}
