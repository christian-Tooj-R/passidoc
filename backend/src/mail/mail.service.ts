import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = config.get<string>('MAIL_HOST');
    if (host) {
      const port   = parseInt(config.get('MAIL_PORT') ?? '587', 10);
      const secure = config.get('MAIL_SECURE') === 'true';
      const user   = config.get<string>('MAIL_USER');
      const pass   = config.get<string>('MAIL_PASS');
      this.logger.log(`SMTP configuré → ${host}:${port} secure=${secure} user=${user}`);
      this.transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, family: 4 } as any);
    } else {
      this.logger.warn('MAIL_HOST non configuré — les emails seront ignorés');
    }
  }

  async sendCongeNotificationManager(opts: {
    managerEmail:  string;
    managerName:   string;
    employeeName:  string;
    employeeEmail: string;
    typeConge:     string;
    dateDebut:     string;
    dateFin:       string;
    nombreJours:   number;
    motif?:        string | null;
    approuverUrl:  string;
    refuserUrl:    string;
  }): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM') ?? 'passidoc@afym.re';
    const subject = `Demande de congé — ${opts.employeeName}`;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1565C0;padding:28px 32px;">
            <p style="margin:0;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.8;">AFYM Audit Expertise — Passidoc</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">📋 Nouvelle demande de congé</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">Bonjour <strong>${opts.managerName}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">
              <strong>${opts.employeeName}</strong> a soumis une demande de congé nécessitant votre validation.
            </p>

            <!-- Fiche -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="8">
                    <tr>
                      <td style="color:#6b7280;font-size:13px;width:140px;padding:6px 0;">Collaborateur</td>
                      <td style="color:#111827;font-size:14px;font-weight:600;padding:6px 0;">${opts.employeeName}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;padding:6px 0;">Type</td>
                      <td style="color:#111827;font-size:14px;padding:6px 0;">${opts.typeConge}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;padding:6px 0;">Période</td>
                      <td style="color:#111827;font-size:14px;font-weight:600;padding:6px 0;">
                        ${opts.dateDebut} → ${opts.dateFin}
                        <span style="color:#6b7280;font-weight:normal;"> (${opts.nombreJours} jour${opts.nombreJours > 1 ? 's' : ''})</span>
                      </td>
                    </tr>
                    ${opts.motif ? `<tr>
                      <td style="color:#6b7280;font-size:13px;padding:6px 0;">Motif</td>
                      <td style="color:#111827;font-size:14px;padding:6px 0;">${opts.motif}</td>
                    </tr>` : ''}
                  </table>
                </td>
              </tr>
            </table>

            <!-- Actions -->
            <p style="margin:0 0 16px;color:#374151;font-size:14px;font-weight:600;">Votre décision :</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;">
                  <a href="${opts.approuverUrl}"
                     style="display:inline-block;background:#16a34a;color:#fff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">
                    ✅ Approuver
                  </a>
                </td>
                <td>
                  <a href="${opts.refuserUrl}"
                     style="display:inline-block;background:#dc2626;color:#fff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">
                    ❌ Refuser
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">
              Ces liens sont valides 72 heures. Si la demande a déjà été traitée, vous serez redirigé vers l'application.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Passidoc — AFYM Audit Expertise</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this._send({ from, to: opts.managerEmail, replyTo: opts.employeeEmail, subject, html });
  }

  async sendCongeStatutEmployee(opts: {
    employeeEmail: string;
    employeeName:  string;
    statut:        'APPROUVEE' | 'REFUSEE';
    typeConge:     string;
    dateDebut:     string;
    dateFin:       string;
    commentaire?:  string | null;
    appUrl:        string;
  }): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM') ?? 'passidoc@afym.re';
    const isApproved = opts.statut === 'APPROUVEE';
    const subject = isApproved
      ? `✅ Votre demande de congé a été approuvée`
      : `❌ Votre demande de congé a été refusée`;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${isApproved ? '#16a34a' : '#dc2626'};padding:28px 32px;">
            <p style="margin:0;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.8;">AFYM Audit Expertise — Passidoc</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">
              ${isApproved ? '✅ Demande approuvée' : '❌ Demande refusée'}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;">Bonjour <strong>${opts.employeeName}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">
              Votre demande de congé (${opts.typeConge}) du <strong>${opts.dateDebut}</strong> au <strong>${opts.dateFin}</strong>
              a été <strong>${isApproved ? 'approuvée' : 'refusée'}</strong>.
            </p>
            ${opts.commentaire ? `<p style="margin:0 0 24px;padding:16px;background:#f8fafc;border-radius:8px;color:#374151;font-size:14px;border-left:4px solid ${isApproved ? '#16a34a' : '#dc2626'};">
              <strong>Commentaire :</strong> ${opts.commentaire}
            </p>` : ''}
            <a href="${opts.appUrl}/rh/conges"
               style="display:inline-block;background:#1565C0;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
              Voir mes congés
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Passidoc — AFYM Audit Expertise</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this._send({ from, to: opts.employeeEmail, subject, html });
  }

  async sendEmailVerificationCode(opts: {
    to: string;
    firstName: string;
    code: string;
  }): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM') ?? 'passidoc@afym.re';
    const subject = `Votre code de vérification — Passidoc`;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1565C0;padding:28px 32px;">
            <p style="margin:0;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.8;">AFYM Audit Expertise — Passidoc</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">Vérification de votre email</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 20px;color:#374151;font-size:15px;">Bonjour <strong>${opts.firstName}</strong>,</p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;">
              Votre compte a été créé avec succès. Pour l'activer, entrez le code ci-dessous dans l'application :
            </p>
            <div style="text-align:center;margin:0 0 28px;">
              <div style="display:inline-block;background:#f0f4ff;border:2px dashed #1565C0;border-radius:12px;padding:20px 40px;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:40px;font-weight:900;letter-spacing:12px;color:#1565C0;">${opts.code}</span>
              </div>
            </div>
            <p style="margin:0 0 12px;color:#6b7280;font-size:13px;text-align:center;">
              Ce code est valable <strong>15 minutes</strong> et ne peut être utilisé qu'une seule fois.
            </p>
            <p style="margin:24px 0 0;padding:16px;background:#fef9c3;border-radius:8px;color:#854d0e;font-size:13px;border-left:4px solid #eab308;">
              Si vous n'avez pas créé de compte sur Passidoc, ignorez cet email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Passidoc — AFYM Audit Expertise</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this._send({ from, to: opts.to, subject, html });
  }

  async sendPasswordResetCode(opts: {
    to: string;
    firstName: string;
    code: string;
  }): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM') ?? 'passidoc@afym.re';
    const subject = `Votre code de réinitialisation — Passidoc`;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1565C0;padding:28px 32px;">
            <p style="margin:0;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.8;">AFYM Audit Expertise — Passidoc</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">Réinitialisation du mot de passe</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 20px;color:#374151;font-size:15px;">Bonjour <strong>${opts.firstName}</strong>,</p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;">
              Vous avez demandé la réinitialisation de votre mot de passe. Voici votre code de vérification :
            </p>
            <div style="text-align:center;margin:0 0 28px;">
              <div style="display:inline-block;background:#f0f4ff;border:2px dashed #1565C0;border-radius:12px;padding:20px 40px;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:40px;font-weight:900;letter-spacing:12px;color:#1565C0;">${opts.code}</span>
              </div>
            </div>
            <p style="margin:0 0 12px;color:#6b7280;font-size:13px;text-align:center;">
              Ce code est valable <strong>15 minutes</strong> et ne peut être utilisé qu'une seule fois.
            </p>
            <p style="margin:24px 0 0;padding:16px;background:#fef9c3;border-radius:8px;color:#854d0e;font-size:13px;border-left:4px solid #eab308;">
              Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe reste inchangé.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Passidoc — AFYM Audit Expertise</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this._send({ from, to: opts.to, subject, html });
  }

  private async _send(opts: { from: string; to: string; replyTo?: string; subject: string; html: string }) {
    if (!this.transporter) {
      this.logger.log(`[MAIL non envoyé — SMTP non configuré] À: ${opts.to} | Sujet: ${opts.subject}`);
      return;
    }
    try {
      await this.transporter.sendMail(opts);
      this.logger.log(`Email envoyé à ${opts.to} : ${opts.subject}`);
    } catch (err: any) {
      this.logger.error(`Échec envoi email à ${opts.to} : ${err.message}`);
    }
  }
}
