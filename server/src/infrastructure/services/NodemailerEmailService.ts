import nodemailer from 'nodemailer';
import { IEmailService, EmailOptions } from '../../domain/services/IEmailService';

export class NodemailerEmailService implements IEmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        // Configuramos con las variables de entorno si existen, sino con un mock/ethereal para dev
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
                pass: process.env.SMTP_PASS || 'etherealpassword',
            },
        });
    }

    async sendEmail(options: EmailOptions): Promise<void> {
        try {
            const info = await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"RetroFantasy Support" <support@retrofantasy.com>',
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html || options.text,
            });
            console.log(`[EmailService] Correo enviado a ${options.to}. MessageID: ${info.messageId}`);
            
            // Si usamos ethereal, podemos ver la url de prueba
            if (process.env.SMTP_HOST === 'smtp.ethereal.email' || !process.env.SMTP_HOST) {
                console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
            }
        } catch (error) {
            console.error('[EmailService] Error al enviar correo:', error);
            throw new Error('No se pudo enviar el correo.');
        }
    }
}
