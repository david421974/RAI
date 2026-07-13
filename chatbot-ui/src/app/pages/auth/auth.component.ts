import { Component } from '@angular/core';
import { Router }        from '@angular/router';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { AuthService }   from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
})
export class AuthComponent {
  email    = '';
  password = '';
  loading  = false;
  errorMsg = '';
  showPwd  = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  async onLogin(): Promise<void> {
    this.errorMsg = '';

    if (!this.authService.isValidEmail(this.email)) {
      this.errorMsg = 'Introduce un correo válido con el dominio @capgemini.com';
      return;
    }

    if (!this.password) {
      this.errorMsg = 'Introduce tu contraseña';
      return;
    }

    this.loading = true;
    try {
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/']);
    } catch (err: any) {
      this.errorMsg = err.message ?? 'Error al iniciar sesión';
    } finally {
      this.loading = false;
    }
  }

  togglePwd(): void {
    this.showPwd = !this.showPwd;
  }
}
