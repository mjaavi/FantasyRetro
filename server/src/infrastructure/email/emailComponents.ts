// ─────────────────────────────────────────────────────────────────────────────
// emailComponents.ts — Reusable atomic components for RetroFantasy emails
//
// Minimal, no-emoji building blocks with liquid glass aesthetic.
// ─────────────────────────────────────────────────────────────────────────────

const FONT = "&quot;Plus Jakarta Sans&quot;, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Helvetica, Arial, sans-serif";

/**
 * Primary CTA button — matches the web's btn-primary exactly:
 * bg-slate-800 (#1e293b), border-2 border-blue-500, rounded-2xl.
 */
export function emailButton(label: string, href: string): string {
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px auto 0;">
            <tr>
                <td align="center" style="border-radius:16px; background-color:#1e293b; border:2px solid #3b82f6;">
                    <a href="${href}" target="_blank" style="display:inline-block; padding:15px 38px; font-family:${FONT}; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:16px; letter-spacing:-0.01em; line-height:1;">
                        ${label}
                    </a>
                </td>
            </tr>
        </table>`;
}

/**
 * Horizontal divider — barely visible line.
 */
export function emailDivider(): string {
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td style="padding:20px 0;">
                    <hr style="border:0; height:1px; background-color:#1e293b; margin:0;" />
                </td>
            </tr>
        </table>`;
}

/**
 * Section heading.
 */
export function emailHeading(text: string, options?: { align?: 'left' | 'center'; size?: 'lg' | 'md' }): string {
    const align = options?.align ?? 'center';
    const fontSize = options?.size === 'md' ? '18px' : '22px';

    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td align="${align}" style="padding-bottom:4px;">
                    <h1 style="margin:0; font-family:${FONT}; font-size:${fontSize}; font-weight:800; color:#ffffff; letter-spacing:-0.04em; line-height:1.2;">
                        ${text}
                    </h1>
                </td>
            </tr>
        </table>`;
}

/**
 * Body paragraph text.
 */
export function emailText(html: string, options?: { align?: 'left' | 'center'; muted?: boolean; small?: boolean }): string {
    const align = options?.align ?? 'left';
    const color = options?.muted ? '#475569' : '#94a3b8';
    const fontSize = options?.small ? '12px' : '13px';
    return `
        <p style="margin:0; padding:6px 0; font-family:${FONT}; font-size:${fontSize}; font-weight:500; color:${color}; line-height:1.6; text-align:${align};">
            ${html}
        </p>`;
}

/**
 * Highlighted info badge — liquid glass sub-card for ticket IDs, codes, etc.
 */
export function emailInfoBadge(label: string, value: string): string {
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td style="padding:12px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius:16px; border-collapse:separate;">
                        <tr>
                            <td style="padding:1px; border-radius:16px; background-color:#1e293b; background: linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius:15px; border-collapse:separate;">
                                    <tr>
                                        <td align="center" style="padding:18px 20px; background-color:#0f172a; border-radius:15px;">
                                            <p style="margin:0 0 4px; font-family:${FONT}; font-size:10px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.12em;">
                                                ${label}
                                            </p>
                                            <p style="margin:0; font-family:${FONT}; font-size:18px; font-weight:800; color:#e2e8f0; letter-spacing:0.04em; line-height:1.3;">
                                                ${value}
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>`;
}

/**
 * Key-value info row.
 */
export function emailInfoRow(label: string, value: string): string {
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td style="padding:6px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                            <td style="font-family:${FONT}; font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.08em; padding-right:12px; white-space:nowrap;">
                                ${label}
                            </td>
                            <td align="right" style="font-family:${FONT}; font-size:13px; font-weight:600; color:#cbd5e1; line-height:1.4;">
                                ${value}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>`;
}

/**
 * Blockquote — left border accent for quoted content.
 */
export function emailBlockquote(content: string): string {
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td style="padding:8px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                            <td style="border-left:2px solid rgba(59,130,246,0.25); padding:10px 14px;">
                                <p style="margin:0; font-family:${FONT}; font-size:12px; font-weight:500; color:#64748b; line-height:1.6; font-style:italic;">
                                    ${content}
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>`;
}

/**
 * Spacer.
 */
export function emailSpacer(height: number = 16): string {
    return `<div style="height:${height}px; line-height:${height}px; font-size:1px;">&nbsp;</div>`;
}

/**
 * Subtle notice box — solid color backgrounds matching alerts.
 */
export function emailNotice(text: string, type: 'info' | 'warning' | 'success' = 'info'): string {
    const border = type === 'warning'
        ? '#d97706'
        : type === 'success'
            ? '#16a34a'
            : '#3b82f6';
    const bgColor = type === 'warning'
        ? '#24211b'
        : type === 'success'
            ? '#16241a'
            : '#182235';
    const color = type === 'warning'
        ? '#fbbf24'
        : type === 'success'
            ? '#22c55e'
            : '#60a5fa';

    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td style="padding:8px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius:12px; border-collapse:separate;">
                        <tr>
                            <td style="padding:12px 16px; background-color:${bgColor}; border:1px solid ${border}; border-radius:12px;">
                                <p style="margin:0; font-family:${FONT}; font-size:11px; font-weight:600; color:${color}; line-height:1.5;">
                                    ${text}
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>`;
}
