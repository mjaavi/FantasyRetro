import nodemailer from 'nodemailer';
import { IEmailService, EmailOptions } from '../../domain/services/IEmailService';
import dns from 'dns';
import axios from 'axios';

// Forzar la resolución de DNS para priorizar IPv4 en este módulo, previniendo errores ENETUNREACH en entornos sin IPv6 saliente como Render
if (dns && typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

// Función auxiliar para resolver de forma garantizada un hostname a IPv4
async function resolveIPv4Only(host: string): Promise<string> {
    if (!host) return host;
    if (/^[0-9.]+$/.test(host) || host.includes(':') || host === 'localhost') {
        return host;
    }
    return new Promise((resolve) => {
        dns.resolve4(host, (err, addresses) => {
            if (err || !addresses || addresses.length === 0) {
                console.warn(`[EmailService DNS] No se pudo resolver ${host} a IPv4, usando host original:`, err?.message);
                resolve(host);
            } else {
                console.log(`[EmailService DNS] Resuelto ${host} a IPv4: ${addresses[0]}`);
                resolve(addresses[0]);
            }
        });
    });
}

export class NodemailerEmailService implements IEmailService {
    private transporter: nodemailer.Transporter | null = null;

    private async getTransporter(): Promise<nodemailer.Transporter> {
        if (this.transporter) return this.transporter;

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

        const ipv4Host = await resolveIPv4Only(smtpHost);

        this.transporter = nodemailer.createTransport({
            host: ipv4Host,
            port: finalPort,
            secure: finalSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
            connectionTimeout: 5000, // 5 segundos
            greetingTimeout: 5000,   // 5 segundos
            socketTimeout: 5000,     // 5 segundos
            tls: {
                rejectUnauthorized: false, // Evita fallos por certificados autofirmados o de CA obsoletos
                servername: smtpHost       // IMPORTANTE: Establecemos el host original en SNI para la validez SSL/TLS
            }
        } as any);

        return this.transporter;
    }

    async sendEmail(options: EmailOptions): Promise<void> {
        let emailSent = false;
        let emailErrorMsg = '';

        // 1. Intentar con Resend HTTPS API (si hay API key configurada)
        const resendApiKey = process.env.RESEND_API_KEY?.trim().replace(/^['"]|['"]$/g, '');
        if (resendApiKey) {
            try {
                console.log('[EmailService] Intentando enviar usando Resend HTTPS API (Puerto 443)...');
                await axios.post('https://api.resend.com/emails', {
                    from: process.env.SMTP_FROM || 'RetroFantasy Support <onboarding@resend.dev>',
                    to: options.to,
                    subject: options.subject,
                    html: options.html || options.text,
                    text: options.text
                }, {
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`[EmailService] Correo enviado exitosamente usando Resend a ${options.to}`);
                emailSent = true;
                return;
            } catch (resendErr: any) {
                const errMsg = resendErr.response?.data ? JSON.stringify(resendErr.response.data) : resendErr.message;
                console.error('[EmailService] Error al enviar con Resend:', errMsg);
                emailErrorMsg = `Resend: ${errMsg}`;
            }
        }

        // 2. Fallback/Alternativa con SMTP
        if (!emailSent) {
            try {
                const transporter = await this.getTransporter();
                const info = await transporter.sendMail({
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
                emailSent = true;
            } catch (error: any) {
                console.error('[EmailService] Error inicial al enviar correo vía SMTP:', error);
                
                const smtpHost = (process.env.SMTP_HOST || 'smtp.ethereal.email').trim().replace(/^['"]|['"]$/g, '');
                const smtpUser = (process.env.SMTP_USER || 'ethereal.user@ethereal.email').trim().replace(/^['"]|['"]$/g, '');
                const smtpPass = (process.env.SMTP_PASS || 'etherealpassword').trim().replace(/^['"]|['"]$/g, '');
                
                const isNetworkError = error.code === 'ETIMEDOUT' || 
                                       error.code === 'ENETUNREACH' || 
                                       error.code === 'EHOSTUNREACH' || 
                                       error.code === 'ECONNREFUSED' || 
                                       error.code === 'EADDRNOTAVAIL' || 
                                       error.message?.includes('timeout');
                
                // Si falló por algún error de red, intentamos el reintento/fallback forzando puerto 587 e IPv4
                if (isNetworkError) {
                    console.warn(`[EmailService] Falló el envío inicial (código: ${error.code}). Reintentando automáticamente con puerto 587 (STARTTLS) e IPv4...`);
                    try {
                        const ipv4HostFallback = await resolveIPv4Only(smtpHost);
                        const fallbackTransporter = nodemailer.createTransport({
                            host: ipv4HostFallback,
                            port: 587,
                            secure: false,
                            auth: {
                                user: smtpUser,
                                pass: smtpPass,
                            },
                            connectionTimeout: 5000,
                            greetingTimeout: 5000,
                            socketTimeout: 5000,
                            tls: {
                                rejectUnauthorized: false,
                                servername: smtpHost
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
                        emailSent = true;
                        return;
                    } catch (fallbackError: any) {
                        console.error('[EmailService] Error también en el fallback de puerto 587:', fallbackError);
                        emailErrorMsg = `SMTP (inicial): ${error.message} | SMTP (fallback): ${fallbackError.message}`;
                    }
                } else {
                    emailErrorMsg = `SMTP: ${error.message}`;
                }
            }
        }

        if (!emailSent) {
            throw new Error('No se pudo enviar el correo de soporte ni por API ni por SMTP. Detalles: ' + emailErrorMsg);
        }
    }
}
