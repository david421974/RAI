import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { Router }        from '@angular/router';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { AuthService }   from '../../services/auth.service';

type Step = 'email' | 'token';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
})
export class AuthComponent implements OnDestroy {

  // ── Estado del formulario ─────────────────────────────────────────────────
  step: Step  = 'email';
  email       = '';
  loading     = false;
  errorMsg    = '';
  successMsg  = '';

  // ── OTP (6 cajas individuales) ────────────────────────────────────────────
  otpValues: string[] = Array(6).fill('');
  @ViewChildren('otpBox') otpBoxes!: QueryList<ElementRef<HTMLInputElement>>;

  get otpComplete(): boolean {
    return this.otpValues.every(v => v !== '');
  }

  // ── Cuenta atrás ──────────────────────────────────────────────────────────
  countdown  = 0;
  canResend  = false;
  private timerRef?: ReturnType<typeof setInterval>;

  constructor(
    private authService: AuthService,
    private router: Router,
    private zone: NgZone,
  ) {}

  ngOnDestroy(): void {
    clearInterval(this.timerRef);
  }

  // ── Paso 1: Enviar código ─────────────────────────────────────────────────

  async onRequestToken(): Promise<void> {
    this.clearMessages();

    if (!this.authService.isValidEmail(this.email)) {
      this.errorMsg = 'Introduce un correo válido con el dominio @capgemini.com';
      return;
    }

    this.loading = true;
    try {
      await this.authService.sendVerificationToken(this.email);
      this.step    = 'token';
      this.otpValues = Array(6).fill('');
      this.startCountdown(600);   // 10 minutos

      // Dar foco a la primera caja tras el render
      setTimeout(() => this.focusBox(0), 80);
    } catch (err: any) {
      this.errorMsg = 'No se pudo enviar el correo. Revisa tu conexión o inténtalo de nuevo.';
      console.error('[AuthService] EmailJS error:', err);
    } finally {
      this.loading = false;
    }
  }

  // ── Paso 2: Verificar código ──────────────────────────────────────────────

  onVerifyToken(): void {
    this.clearMessages();
    const token = this.otpValues.join('');

    if (token.length < 6) {
      this.errorMsg = 'Introduce los 6 dígitos del código que recibiste.';
      return;
    }

    const valid = this.authService.verifyToken(this.email, token);
    if (valid) {
      this.router.navigate(['/']);
    } else {
      this.errorMsg  = 'Código incorrecto o expirado. Solicita uno nuevo.';
      this.otpValues = Array(6).fill('');
      setTimeout(() => {
        this.resetBoxValues();
        this.focusBox(0);
      }, 50);
    }
  }

  // ── Acciones secundarias ──────────────────────────────────────────────────

  async onResend(): Promise<void> {
    this.clearMessages();
    this.loading = true;
    try {
      await this.authService.sendVerificationToken(this.email);
      this.successMsg = 'Nuevo código enviado. Revisa tu bandeja de entrada.';
      this.otpValues  = Array(6).fill('');
      this.resetBoxValues();
      this.startCountdown(600);
      setTimeout(() => this.focusBox(0), 80);
    } catch {
      this.errorMsg = 'No se pudo reenviar. Inténtalo de nuevo.';
    } finally {
      this.loading = false;
    }
  }

  onBackToEmail(): void {
    this.step      = 'email';
    this.otpValues = Array(6).fill('');
    this.clearMessages();
    clearInterval(this.timerRef);
    this.countdown = 0;
    this.canResend = false;
  }

  // ── Gestión de las cajas OTP ──────────────────────────────────────────────

  onBoxInput(event: Event, index: number): void {
    const input  = event.target as HTMLInputElement;
    const raw    = input.value.replace(/\D/g, '');

    if (raw.length > 1) {
      // Pegar varios dígitos de golpe
      const digits = raw.slice(0, 6 - index);
      digits.split('').forEach((d, i) => {
        const idx = index + i;
        this.otpValues[idx] = d;
        const box = this.otpBoxes.get(idx);
        if (box) box.nativeElement.value = d;
      });
      const nextIdx = Math.min(index + digits.length, 5);
      this.focusBox(nextIdx);
      input.value = this.otpValues[index];
      return;
    }

    this.otpValues[index] = raw;
    input.value           = raw;

    if (raw && index < 5) this.focusBox(index + 1);
  }

  onBoxKeydown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (input.value) {
        this.otpValues[index] = '';
        input.value           = '';
      } else if (index > 0) {
        this.focusBox(index - 1);
      }
    } else if (event.key === 'ArrowLeft'  && index > 0) {
      this.focusBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.focusBox(index + 1);
    } else if (event.key === 'Enter' && this.otpComplete) {
      this.onVerifyToken();
    }
  }

  onBoxPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text   = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '').slice(0, 6);
    digits.split('').forEach((d, i) => {
      this.otpValues[i] = d;
      const box = this.otpBoxes.get(i);
      if (box) box.nativeElement.value = d;
    });
    this.focusBox(Math.min(digits.length, 5));
  }

  // ── Cuenta atrás ──────────────────────────────────────────────────────────

  get countdownLabel(): string {
    const m = Math.floor(this.countdown / 60).toString().padStart(2, '0');
    const s = (this.countdown % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  private startCountdown(seconds: number): void {
    clearInterval(this.timerRef);
    this.countdown = seconds;
    this.canResend = false;

    this.timerRef = setInterval(() => {
      this.zone.run(() => {
        this.countdown--;
        if (this.countdown <= 540) this.canResend = true;   // reenvío tras 60 s
        if (this.countdown <= 0)   clearInterval(this.timerRef);
      });
    }, 1_000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private focusBox(index: number): void {
    this.otpBoxes.get(index)?.nativeElement.focus();
  }

  private resetBoxValues(): void {
    this.otpBoxes.forEach(box => (box.nativeElement.value = ''));
  }

  private clearMessages(): void {
    this.errorMsg   = '';
    this.successMsg = '';
  }
}
