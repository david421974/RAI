# 🔐 Guía de configuración — Capa de autenticación OTP

## 1. Instala la dependencia EmailJS

```bash
npm install @emailjs/browser
```

---

## 2. Configura EmailJS (gratuito hasta 200 correos/mes)

### 2a. Crea tu cuenta
Regístrate en **https://www.emailjs.com**

### 2b. Crea un "Email Service"
1. Panel → **Email Services** → **Add New Service**
2. Elige tu proveedor (Gmail, Outlook, SMTP corporativo…)
3. Sigue los pasos de autorización
4. Copia el **Service ID** (ej. `service_abc1234`)

### 2c. Crea un "Email Template"
1. Panel → **Email Templates** → **Create New Template**
2. Configura así:

| Campo | Valor |
|---|---|
| **To Email** | `{{to_email}}` |
| **Subject** | `Tu código de acceso` |
| **Body** | Ver plantilla abajo |

**Ejemplo de cuerpo HTML:**
```html
<p>Hola,</p>
<p>Tu código de verificación para acceder al asistente es:</p>
<h1 style="letter-spacing:8px;font-size:32px;color:#2563eb">{{token}}</h1>
<p>Este código es válido durante <strong>{{expiry_minutes}} minutos</strong>.</p>
<p>Si no has solicitado este código, ignora este mensaje.</p>
<hr>
<p style="font-size:12px;color:#666">Este es un correo automático, no respondas a él.</p>
```

3. Copia el **Template ID** (ej. `template_xyz7890`)

### 2d. Obtén tu Public Key
1. Panel → **Account** → **General** → **Public Key**
2. Copia el valor (ej. `user_ABCDEFGHIJKLMN`)

---

## 3. Actualiza `auth.service.ts`

Sustituye los tres placeholders al principio del archivo:

```typescript
const EMAILJS_SERVICE_ID  = 'service_abc1234';   // ← tu Service ID
const EMAILJS_TEMPLATE_ID = 'template_xyz7890';  // ← tu Template ID
const EMAILJS_PUBLIC_KEY  = 'user_ABCDE12345';   // ← tu Public Key
```

---

## 4. Añade la fuente Sora a `index.html`

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

---

## 5. Copia los archivos a tu proyecto

```
auth.service.ts          → src/app/services/auth.service.ts
auth.guard.ts            → src/app/guards/auth.guard.ts
auth.component.ts        → src/app/pages/auth/auth.component.ts
auth.component.html      → src/app/pages/auth/auth.component.html
auth.component.css       → src/app/pages/auth/auth.component.css
app.routes.ts            → src/app/app.routes.ts   (reemplaza el existente)
```

---

## 6. (Opcional) Añade logout en el Layout

Si quieres un botón de cerrar sesión en el header, inyecta `AuthService` en tu `LayoutComponent`:

```typescript
import { AuthService } from '../../services/auth.service';
import { Router }      from '@angular/router';

constructor(private auth: AuthService, private router: Router) {}

logout(): void {
  this.auth.logout();
  this.router.navigate(['/auth']);
}
```

---

## Flujo de autenticación

```
Usuario → /auth
  → introduce email @capgemini.com
  → recibe OTP por correo (válido 10 min)
  → introduce código de 6 dígitos
  → sesión guardada en sessionStorage (8 h)
  → redirige a /  (HomeComponent)

Visita protegida sin sesión → redirige a /auth automáticamente
Sesión expirada             → redirige a /auth automáticamente
```

---

## Seguridad

- ✅ Solo dominios `@capgemini.com` pueden solicitar un código
- ✅ El OTP expira a los 10 minutos
- ✅ La sesión dura 8 horas (configurable en `auth.service.ts`)
- ✅ El OTP se almacena solo en memoria del servicio (no en localStorage)
- ⚠️  Para mayor seguridad en producción, considera mover la generación y verificación del OTP a un backend propio
