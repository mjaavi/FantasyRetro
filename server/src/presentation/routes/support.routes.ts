import { Router } from 'express';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../../infrastructure/supabase.client';
import { SupportController } from '../controllers/support.controller';

export function createSupportRouter(): Router {
    const router = Router();
    const supportController = new SupportController();

    // 1. Endpoint /api/support/ticket (compatible con la implementación remota de SupportController)
    router.post('/support/ticket', (req, res) => supportController.submitTicket(req, res));

    // 2. Endpoint /api/support (compatible con la implementación simplificada del cliente)
    router.post('/support', async (req, res, next) => {
        try {
            const { subject, message, email } = req.body;

            if (!message) {
                return res.status(400).json({
                    status: 'error',
                    message: 'El mensaje es obligatorio.'
                });
            }

            const senderEmail = email || 'anónimo';
            const ticketSubject = subject || 'Consulta de soporte';

            // 1. Guardar ticket en Supabase de forma segura (usando supabaseAdmin)
            let savedInDb = false;
            try {
                const { error: dbError } = await supabaseAdmin
                    .from('support_tickets')
                    .insert({
                        subject: ticketSubject,
                        message: message,
                        email: senderEmail,
                        user_id: req.body.userId || req.body.user_id || null
                    });

                if (dbError) {
                    console.warn('[Soporte] Advertencia guardando en base de datos:', dbError.message);
                } else {
                    savedInDb = true;
                    console.log('[Soporte] Ticket guardado correctamente en la tabla support_tickets');
                }
            } catch (dbErr: any) {
                console.warn('[Soporte] No se pudo guardar en base de datos:', dbErr.message);
            }

            // 2. Enviar por correo usando Nodemailer
            const smtpHost = process.env.SMTP_HOST?.trim().replace(/^['"]|['"]$/g, '');
            const smtpPortRaw = (process.env.SMTP_PORT ?? '465').trim().replace(/^['"]|['"]$/g, '');
            const smtpPort = parseInt(smtpPortRaw, 10);
            const smtpUser = process.env.SMTP_USER?.trim().replace(/^['"]|['"]$/g, '');
            const smtpPass = process.env.SMTP_PASS?.trim().replace(/^['"]|['"]$/g, '');
            const supportEmail = (process.env.SUPPORT_EMAIL ?? process.env.SUPPORT_ADMIN_EMAIL ?? smtpUser)?.trim().replace(/^['"]|['"]$/g, '');

            const isConfigured = smtpUser && smtpPass && 
                !smtpUser.includes('tu_correo') && 
                !smtpPass.includes('tu_contrasea') &&
                smtpHost && !smtpHost.includes('tu_host');

            if (!isConfigured) {
                console.log('\n┌────────────────────────────────────────────────────────┐');
                console.log('│ ✉️  [Soporte] MODO SIMULADO ACTIVO                     │');
                console.log('│ No hay credenciales SMTP reales configuradas en .env.  │');
                console.log('├────────────────────────────────────────────────────────┤');
                console.log(`│ De:      ${senderEmail.padEnd(46)} │`);
                console.log(`│ Asunto:  ${ticketSubject.padEnd(46)} │`);
                console.log(`│ Mensaje: ${message.substring(0, 42).padEnd(42)}... │`);
                console.log('└────────────────────────────────────────────────────────┘\n');

                return res.json({
                    status: 'ok',
                    message: 'Mensaje recibido correctamente (Simulado localmente sin SMTP).',
                    savedInDb,
                    simulated: true
                });
            }

            // Detectar automáticamente el modo secure adecuado según el puerto si no está forzado por env
            let isSecure = smtpPort === 465;
            if (process.env.SMTP_SECURE !== undefined) {
                isSecure = process.env.SMTP_SECURE.trim().replace(/^['"]|['"]$/g, '') === 'true';
            }

            let finalPort = smtpPort;
            let finalSecure = isSecure;

            // Render bloquea el puerto 465, si estamos allí reconfiguramos al 587
            if (process.env.RENDER === 'true' && finalPort === 465) {
                console.warn('[Soporte] Detectado entorno Render con puerto 465. Reconfigurando automáticamente a puerto 587 (STARTTLS) para evitar bloqueo de red.');
                finalPort = 587;
                finalSecure = false;
            }

            console.log('[Soporte] Intentando conectar al servidor SMTP:');
            console.log(`  - Host: "${smtpHost}"`);
            console.log(`  - Port original: ${smtpPort} -> Final: ${finalPort}`);
            console.log(`  - Secure original: ${isSecure} -> Final: ${finalSecure}`);
            console.log(`  - User: "${smtpUser}"`);
            console.log(`  - Destinatario: "${supportEmail}"`);

            // Crear transporter con las credenciales SMTP
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: finalPort,
                secure: finalSecure,
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                },
                connectionTimeout: 5000, // 5 segundos
                greetingTimeout: 5000,   // 5 segundos
                socketTimeout: 5000,     // 5 segundos
                family: 4,               // FORZAR IPv4 únicamente para evitar errores ENETUNREACH en Render (que carece de IPv6 outbound)
                tls: {
                    rejectUnauthorized: false // Evita fallos por certificados autofirmados o problemas de CA en hosting
                }
            } as any);

            const htmlContent = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg: 8px;">
                    <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Nuevo Ticket de Soporte - Retro Fantasy</h2>
                    <p><strong>De:</strong> ${senderEmail}</p>
                    <p><strong>Asunto:</strong> ${ticketSubject}</p>
                    <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 15px; margin-top: 15px; border-radius: 4px; font-style: italic; white-space: pre-wrap;">
                        ${message}
                    </div>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 11px; color: #64748b; text-align: center;">Este es un correo automático enviado desde el servidor de Retro Fantasy.</p>
                </div>
            `;

            // Enviar el correo electrónico con fallback automático
            try {
                await transporter.sendMail({
                    from: `"${senderEmail}" <${smtpUser}>`, // Enviado a través de nuestro SMTP pero indicando el remitente original
                    replyTo: senderEmail,
                    to: supportEmail,
                    subject: `[RetroFantasy Soporte] ${ticketSubject}`,
                    text: `Nuevo ticket de soporte de: ${senderEmail}\nAsunto: ${ticketSubject}\n\nMensaje:\n${message}`,
                    html: htmlContent
                });
            } catch (mailErr: any) {
                console.error('[Soporte] Error inicial al enviar correo:', mailErr);
                
                // Si falló por timeout/bloqueo de red y se usó puerto 465
                const isTimeoutOrBlocked = mailErr.code === 'ETIMEDOUT' || mailErr.message?.includes('timeout') || mailErr.code === 'ECONNREFUSED' || mailErr.code === 'EADDRNOTAVAIL';
                if (isTimeoutOrBlocked && finalPort === 465) {
                    console.warn('[Soporte] Falló el envío en puerto 465. Intentando fallback automático con puerto 587 (STARTTLS)...');
                    const fallbackTransporter = nodemailer.createTransport({
                        host: smtpHost,
                        port: 587,
                        secure: false,
                        auth: {
                            user: smtpUser,
                            pass: smtpPass
                        },
                        connectionTimeout: 5000,
                        greetingTimeout: 5000,
                        socketTimeout: 5000,
                        family: 4,
                        tls: {
                            rejectUnauthorized: false
                        }
                    } as any);

                    await fallbackTransporter.sendMail({
                        from: `"${senderEmail}" <${smtpUser}>`,
                        replyTo: senderEmail,
                        to: supportEmail,
                        subject: `[RetroFantasy Soporte] ${ticketSubject}`,
                        text: `Nuevo ticket de soporte de: ${senderEmail}\nAsunto: ${ticketSubject}\n\nMensaje:\n${message}`,
                        html: htmlContent
                    });
                    console.log('[Soporte] Envío de soporte exitoso en puerto 587 mediante fallback!');
                } else {
                    throw mailErr;
                }
            }

            console.log(`[Soporte] Correo de soporte enviado correctamente a ${supportEmail}`);

            return res.json({
                status: 'ok',
                message: '✓ Mensaje enviado por correo electrónico correctamente.',
                savedInDb,
                simulated: false
            });

        } catch (err: any) {
            console.error('[Soporte] Error al procesar el ticket de soporte:', err);
            
            let userFriendlyMessage = err.message || 'Error al procesar la solicitud.';
            if (err.message?.includes('timeout') || err.code === 'ETIMEDOUT') {
                userFriendlyMessage = 'Error de timeout SMTP. Verifica que tu host SMTP, puerto (465/587) y SSL/TLS coincidan en Render (p. ej. usa puerto 587 si tienes problemas con el 465).';
            }

            return res.status(500).json({
                status: 'error',
                message: userFriendlyMessage
            });
        }
    });

    return router;
}
