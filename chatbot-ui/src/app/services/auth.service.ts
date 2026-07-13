import { Injectable } from '@angular/core';

// ─── URL de la auth_api ───────────────────────────────────────────────────────
// En desarrollo apunta a localhost. En producción, cambia por el host/dominio real.
// También puedes moverlo a src/environments/environment.ts
const AUTH_API_URL   = 'http://localhost:7001';
const ALLOWED_DOMAIN = 'capgemini.com';
const SESSION_KEY    = 'chatbot_jwt';

@Injectable({ providedIn: 'root' })
export class AuthService {

  // ── Sesión ─────────────────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return false;
    try {
      // Decodifica el payload del JWT sin verificación (solo para leer exp)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() < payload.exp * 1000;
    } catch {
      return false;
    }
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ── Validación ─────────────────────────────────────────────────────────────

  isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  /**
   * Envía las credenciales a la auth_api.
   * Si son válidas, guarda el JWT en sessionStorage.
   * Si no, lanza un Error con el mensaje del servidor.
   */
  async login(email: string, password: string): Promise<void> {
    let res: Response;

    try {
      res = await fetch(`${AUTH_API_URL}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as any).detail ?? 'Error de autenticación');
    }

    const data = await res.json() as { access_token: string };
    sessionStorage.setItem(SESSION_KEY, data.access_token);
  }
}
