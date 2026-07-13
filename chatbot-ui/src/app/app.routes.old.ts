import { Routes } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';
import { HomeComponent } from './pages/home/home.component';
import { ConversationComponent } from './pages/conversation/conversation.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', component: HomeComponent, data: { renderMode: 'prerender' } },
      { path: 'conversation', component: ConversationComponent, data: { renderMode: 'prerender' } }
    ]
  }
];
