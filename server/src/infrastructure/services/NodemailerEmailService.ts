import nodemailer from 'nodemailer';
import { IEmailService, EmailOptions } from '../../domain/services/IEmailService';

export class NodemailerEmailService implements IEmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        const smtpHost = (process.env.SMTP_HOST || 'smtp.ethereal.email').trim().replace(/^['"]|['"]$/g, '');
        const smtpPort = Number((process.env.SMTP_PORT ?? '587').trim().replace(/^['"]|['"]$/g, ''));
        const smtpUser = (process.env.SMTP_USER || 'ethereal.user@ethereal.email').trim().replace(/^['"]|['"]$/g, '');
        const smtpPass = (process.env.SMTP_PASS || 'etherealpassword').trim().replace(/^['"]|['"]$/g, '');
        
        let isSecure = smtpPort === 465;
        if (process.env.SMTP_SECURE !== undefined) {
            isSecure = process.env.SMTP_SECURE.trim().replace(/^['"]|['"]$/g, '') === 'true';
        }

        // Configuramos con las variables de entorno si existen, sino con un mock/ethereal para dev
        this.transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
            connectionTimeout: 5000, // 5 segundos
            greetingTimeout: 5000,   // 5 segundos
            socketTimeout: 5000,     // 5 segundos
            tls: {
                rejectUnauthorized: false // Evita fallos por certificados autofirmados o de CA obsoletos
            }
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
