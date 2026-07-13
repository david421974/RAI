import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';

// ─── CONFIGURACIÓN EMAILJS ───────────────────────────────────────────────────
// 1. Crea una cuenta en https://www.emailjs.com (plan gratuito: 200 emails/mes)
// 2. En "Email Services", conecta tu proveedor (Gmail, Outlook, SMTP propio…)
// 3. En "Email Templates", crea una plantilla con estas variables:
//      {{to_email}}       → destinatario
//      {{token}}          → código de 6 dígitos
//      {{expiry_minutes}} → minutos de validez
// 4. Sustituye los valores siguientes con los de tu cuenta:
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';   // ej. 'service_abc123'
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';  // ej. 'template_xyz789'
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';   // ej. 'user_ABCDEFGHIJK'
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_DOMAIN      = 'capgemini.com';
const TOKEN_TTL_MS        = 10 * 60 * 1000;   // 10 minutos
const SESSION_TTL_MS      = 8  * 60 * 60 * 1000; // 8 horas
const SESSION_KEY         = 'chatbot_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private pendingEmail  = '';
  private pendingToken  = '';
  private tokenExpiry   = 0;

  constructor() {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  // ── Sesión ────────────────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    try {
      const { expiresAt } = JSON.parse(raw) as { expiresAt: number };
      return Date.now() < expiresAt;
    } catch {
      return false;
    }
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ── Validación ────────────────────────────────────────────────────────────

  isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
  }

  // ── OTP ───────────────────────────────────────────────────────────────────

  async sendVerificationToken(email: string): Promise<void> {
    if (!this.isValidEmail(email)) {
      throw new Error(`Solo se permiten correos @${ALLOWED_DOMAIN}`);
    }

    const token = this.generateOTP();
    this.pendingEmail  = email.toLowerCase().trim();
    this.pendingToken  = token;
    this.tokenExpiry   = Date.now() + TOKEN_TTL_MS;

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:       email,
      token:          token,
      expiry_minutes: '10',
    });
  }

  verifyToken(email: string, token: string): boolean {
    const match =
      email.toLowerCase().trim() === this.pendingEmail &&
      token.trim()               === this.pendingToken &&
      Date.now() < this.tokenExpiry;

    if (match) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ email: this.pendingEmail, expiresAt: Date.now() + SESSION_TTL_MS })
      );
      this.clearPending();
    }
    return match;
  }

  // ── Privados ──────────────────────────────────────────────────────────────

  private generateOTP(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }

  private clearPending(): void {
    this.pendingEmail = '';
    this.pendingToken = '';
    this.tokenExpiry  = 0;
  }
}
