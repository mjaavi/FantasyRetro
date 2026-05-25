import { EmailOptions, IEmailService } from '../../domain/services/IEmailService';

type GoogleTokenResponse = {
    access_token?: string;
    error?: string;
    error_description?: string;
};

export class GmailApiEmailService implements IEmailService {
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly refreshToken: string;
    private readonly from: string;
    private readonly timeoutMs: number;

    constructor() {
        this.clientId = process.env.GMAIL_CLIENT_ID ?? '';
        this.clientSecret = process.env.GMAIL_CLIENT_SECRET ?? '';
        this.refreshToken = process.env.GMAIL_REFRESH_TOKEN ?? '';
        this.from = process.env.GMAIL_FROM_EMAIL
            || process.env.SUPPORT_FROM_EMAIL
            || process.env.SMTP_FROM
            || '';
        this.timeoutMs = Number(process.env.EMAIL_HTTP_TIMEOUT_MS ?? 10_000);

        if (!this.clientId || !this.clientSecret || !this.refreshToken || !this.from) {
            throw new Error('Gmail API no esta configurado. Revisa GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN y GMAIL_FROM_EMAIL.');
        }
    }

    async sendEmail(options: EmailOptions): Promise<void> {
        const accessToken = await this.getAccessToken();
        const raw = this.buildRawMessage(options);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ raw }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`Gmail API HTTP ${response.status}: ${body || response.statusText}`);
            }
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                throw new Error(`Gmail API timeout tras ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async getAccessToken(): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token',
                }),
                signal: controller.signal,
            });
            const data = await response.json() as GoogleTokenResponse;

            if (!response.ok || !data.access_token) {
                throw new Error(data.error_description || data.error || `Google OAuth HTTP ${response.status}`);
            }

            return data.access_token;
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                throw new Error(`Google OAuth timeout tras ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    private buildRawMessage(options: EmailOptions): string {
        const headers = [
            `From: ${this.from}`,
            `To: ${options.to}`,
            `Subject: ${this.encodeHeader(options.subject)}`,
            'MIME-Version: 1.0',
        ];

        const message = options.html
            ? [
                ...headers,
                'Content-Type: text/html; charset="UTF-8"',
                '',
                options.html,
            ].join('\r\n')
            : [
                ...headers,
                'Content-Type: text/plain; charset="UTF-8"',
                '',
                options.text,
            ].join('\r\n');

        return Buffer.from(message, 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
    }

    private encodeHeader(value: string): string {
        return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
    }
}
