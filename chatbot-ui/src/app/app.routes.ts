import { Routes } from '@angular/router';
import { LayoutComponent }       from './components/layout/layout.component';
import { HomeComponent }         from './pages/home/home.component';
import { ConversationComponent } from './pages/conversation/conversation.component';
import { AuthComponent }         from './pages/auth/auth.component';
import { authGuard }             from './guards/auth.guard';

export const routes: Routes = [
  // ── Página de autenticación (pública, sin guard) ───────────────────────
  {
    path: 'auth',
    component: AuthComponent,
    data: { renderMode: 'client' },
  },

  // ── Rutas protegidas (requieren sesión activa) ─────────────────────────
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: HomeComponent,
        data: { renderMode: 'prerender' },
      },
      {
        path: 'conversation',
        component: ConversationComponent,
        data: { renderMode: 'prerender' },
      },
    ],
  },

  // ── Cualquier ruta desconocida → login ────────────────────────────────
  { path: '**', redirectTo: '/auth' },
];
