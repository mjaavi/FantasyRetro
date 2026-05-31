// ─────────────────────────────────────────────────────────────────────────────
// emailBaseLayout.ts — Base HTML layout for all RetroFantasy transactional emails
//
// Replicates the app's visual identity: football pitch lines background,
// blue/indigo gradient blobs, Plus Jakarta Sans typography, liquid glass card.
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailLayoutOptions {
    /** Main content HTML to inject inside the card */
    body: string;
    /** Optional: year override for footer (defaults to current year) */
    year?: number;
    /** Optional: preview text for email clients (appears in inbox preview) */
    previewText?: string;
}

// Football pitch lines as inline SVG (matches the rotated field from index.html)
// Encoded as data URI for email client compatibility.
function buildPitchSvgDataUri(): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1400" viewBox="0 0 900 1400">
        <g transform="rotate(-12 450 700)" opacity="0.03">
            <rect x="120" y="60" width="660" height="1280" rx="70" fill="none" stroke="white" stroke-width="3"/>
            <line x1="120" y1="700" x2="780" y2="700" stroke="white" stroke-width="3"/>
            <circle cx="450" cy="700" r="160" fill="none" stroke="white" stroke-width="3"/>
            <path d="M225 60 L225 300 Q225 340 265 340 L635 340 Q675 340 675 300 L675 60" fill="none" stroke="white" stroke-width="3"/>
            <path d="M225 1340 L225 1040 Q225 1000 265 1000 L635 1000 Q675 1000 675 1040 L675 1340" fill="none" stroke="white" stroke-width="3"/>
        </g>
    </svg>`;
    const encoded = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${encoded}`;
}

export function wrapInBaseLayout({ body, year, previewText }: EmailLayoutOptions): string {
    const currentYear = year ?? new Date().getFullYear();
    const pitchBg = buildPitchSvgDataUri();
    const preview = previewText
        ? `<div style="display:none;font-size:1px;color:#0b1120;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>RetroFantasy</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style type="text/css">
        body, table, td, a, h1, p, span, strong {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        }
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
        @media (prefers-color-scheme: dark) {
            .email-bg { background-color: #060d1b !important; }
        }
        @media only screen and (max-width: 620px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .content-padding { padding-left: 20px !important; padding-right: 20px !important; }
        }
    </style>
</head>
<body style="margin:0; padding:0; background-color:#0b1120; font-family:&quot;Plus Jakarta Sans&quot;, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Helvetica, Arial, sans-serif;">
    ${preview}

    <!-- Outer wrapper — app background with gradient blobs + pitch lines -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-bg" style="
        background-color: #0b1120;
        background-image:
            radial-gradient(circle at 8% 8%, rgba(37,99,235,0.15), transparent 45%),
            radial-gradient(circle at 92% 92%, rgba(79,70,229,0.10), transparent 45%),
            url('${pitchBg}');
        background-repeat: no-repeat;
        background-position: center center;
        background-size: cover;
    ">
        <tr>
            <td align="center" style="padding: 48px 16px 24px;">

                <!-- Main container -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="520" class="email-container" style="max-width:520px; width:100%;">

                    <!-- ═══ HEADER ═══ -->
                    <tr>
                        <td align="center" style="padding: 0 0 36px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="font-family:&quot;Plus Jakarta Sans&quot;, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Helvetica, Arial, sans-serif; font-size:28px; font-weight:800; letter-spacing:-0.5px; color:#ffffff; text-align:center; line-height:1;">
                                        RETRO <span style="color:#3b82f6;">FANTASY</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ═══ LIQUID GLASS CARD ═══ -->
                    <tr>
                        <td>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius:28px; border-collapse:separate;">
                                <tr>
                                    <td style="padding:1px; border-radius:28px; background-color:#1e293b; background: linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, rgba(59,130,246,0.08) 100%);">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius:27px; border-collapse:separate;">
                                            <tr>
                                                <td class="content-padding" style="padding:44px 40px; background-color:#0f172a; background: linear-gradient(160deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.92) 50%, rgba(11,17,32,0.95) 100%); border-radius:27px; box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);">
                                                    ${body}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ═══ FOOTER ═══ -->
                    <tr>
                        <td style="padding:28px 0 16px; text-align:center;">
                            <p style="margin:0; font-family:&quot;Plus Jakarta Sans&quot;, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Helvetica, Arial, sans-serif; font-size:11px; color:#334155; line-height:1.5; font-weight:500;">
                                &copy; ${currentYear} RetroFantasy
                            </p>
                            <p style="margin:4px 0 0; font-family:&quot;Plus Jakarta Sans&quot;, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Helvetica, Arial, sans-serif; font-size:10px; color:#475569; line-height:1.4; font-weight:500;">
                                Correo autom&aacute;tico &middot; No respondas directamente
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
