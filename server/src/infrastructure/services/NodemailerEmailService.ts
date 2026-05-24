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

        let finalPort = smtpPort;
        let finalSecure = isSecure;

        // Render bloquea el puerto 465, si estamos allí reconfiguramos al 587
        if (process.env.RENDER === 'true' && finalPort === 465) {
            console.warn('[EmailService] Detectado entorno Render con puerto 465. Reconfigurando automáticamente a puerto 587 (STARTTLS) para evitar bloqueo de red.');
            finalPort = 587;
            finalSecure = false;
        }

        // Configuramos con las variables de entorno si existen, sino con un mock/ethereal para dev
        this.transporter = nodemailer.createTransport({
            host: smtpHost,
            port: finalPort,
            secure: finalSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
            connectionTimeout: 5000, // 5 segundos
            greetingTimeout: 5000,   // 5 segundos
            socketTimeout: 5000,     // 5 segundos
            family: 4,               // FORZAR IPv4 únicamente para evitar errores ENETUNREACH en Render
            tls: {
                rejectUnauthorized: false // Evita fallos por certificados autofirmados o de CA obsoletos
            }
        } as any);
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
        } catch (error: any) {
            console.error('[EmailService] Error inicial al enviar correo:', error);
            
            const smtpPort = Number((process.env.SMTP_PORT ?? '587').trim().replace(/^['"]|['"]$/g, ''));
            const isTimeoutOrBlocked = error.code === 'ETIMEDOUT' || error.message?.includes('timeout') || error.code === 'ECONNREFUSED' || error.code === 'EADDRNOTAVAIL';
            
            // Si falló por timeout/bloqueo de red y se usó puerto 465, intentamos con 587
            if (isTimeoutOrBlocked && smtpPort === 465) {
                console.warn('[EmailService] Falló el envío en puerto 465 (posible bloqueo). Reintentando automáticamente con puerto 587 (STARTTLS)...');
                try {
                    const smtpHost = (process.env.SMTP_HOST || 'smtp.ethereal.email').trim().replace(/^['"]|['"]$/g, '');
                    const smtpUser = (process.env.SMTP_USER || 'ethereal.user@ethereal.email').trim().replace(/^['"]|['"]$/g, '');
                    const smtpPass = (process.env.SMTP_PASS || 'etherealpassword').trim().replace(/^['"]|['"]$/g, '');
                    
                    const fallbackTransporter = nodemailer.createTransport({
                        host: smtpHost,
                        port: 587,
                        secure: false,
                        auth: {
                            user: smtpUser,
                            pass: smtpPass,
                        },
                        connectionTimeout: 5000,
                        greetingTimeout: 5000,
                        socketTimeout: 5000,
                        family: 4,
                        tls: {
                            rejectUnauthorized: false
                        }
                    } as any);

                    const info = await fallbackTransporter.sendMail({
                        from: process.env.SMTP_FROM || '"RetroFantasy Support" <support@retrofantasy.com>',
                        to: options.to,
                        subject: options.subject,
                        text: options.text,
                        html: options.html || options.text,
                    });
                    console.log(`[EmailService] Correo enviado exitosamente usando fallback de puerto 587 a ${options.to}. MessageID: ${info.messageId}`);
                    return;
                } catch (fallbackError) {
                    console.error('[EmailService] Error también en el fallback de puerto 587:', fallbackError);
                    throw new Error('No se pudo enviar el correo en ninguno de los puertos SMTP (465/587).');
                }
            }
            
            throw new Error('No se pudo enviar el correo.');
        }
    }
}
