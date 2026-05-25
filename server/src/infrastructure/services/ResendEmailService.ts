import { EmailOptions, IEmailService } from '../../domain/services/IEmailService';

export class ResendEmailService implements IEmailService {
    private readonly apiKey: string;
    private readonly from: string;
    private readonly timeoutMs: number;

    constructor() {
        this.apiKey = process.env.RESEND_API_KEY ?? '';
        if (!this.apiKey) {
            throw new Error('RESEND_API_KEY no esta configurada.');
        }

        this.from = process.env.SUPPORT_FROM_EMAIL ?? 'RetroFantasy Support <onboarding@resend.dev>';
        this.timeoutMs = Number(process.env.EMAIL_HTTP_TIMEOUT_MS ?? 10_000);
    }

    async sendEmail(options: EmailOptions): Promise<void> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: this.from,
                    to: [options.to],
                    subject: options.subject,
                    text: options.text,
                    html: options.html,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`Resend HTTP ${response.status}: ${body || response.statusText}`);
            }
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                throw new Error(`Resend timeout tras ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
}
