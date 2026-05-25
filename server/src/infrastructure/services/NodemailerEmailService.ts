import nodemailer from 'nodemailer';
import { EmailOptions, IEmailService } from '../../domain/services/IEmailService';

export class NodemailerEmailService implements IEmailService {
    private readonly transporter: nodemailer.Transporter;

    constructor() {
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            throw new Error('SMTP no esta configurado.');
        }

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 5000),
            greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 5000),
            socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 10000),
        });
    }

    async sendEmail(options: EmailOptions): Promise<void> {
        const info = await this.transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SUPPORT_FROM_EMAIL || '"RetroFantasy Support" <support@retrofantasy.com>',
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html || options.text,
        });

        console.log(`[EmailService] Correo enviado a ${options.to}. MessageID: ${info.messageId}`);
    }
}
