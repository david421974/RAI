import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FaqModalComponent, FaqEntry } from '../faq-modal/faq-modal.component';
import { AboutRaiModalComponent } from '../about-rai-modal/about-rai-modal.component';
import { ChatHistorySummary, ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive, 
    FaqModalComponent, 
    AboutRaiModalComponent
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export class LayoutComponent {
  // Mantener estados originales
  sidebarOpen = true;
  faqModalOpen = false;
  misChatsExpanded = false;
  aboutRaiModalOpen = false;

  constructor(
    private chatService: ChatService,
    private router: Router,
  ) {}

  // Getters para el historial de chats
  get chatHistory$() {
    return this.chatService.chatHistory$;
  }

  get activeChatId$() {
    return this.chatService.activeChatId$;
  }

  // Métodos de control de UI
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  openFaqModal(): void {
    this.faqModalOpen = true;
  }

  closeFaqModal(): void {
    this.faqModalOpen = false;
  }

  /**
   * NUEVO MÉTODO: Maneja la pregunta seleccionada en el modal.
   * Envía el payload al servicio de chat y redirige a la vista de conversación.
   */
  onFaqSelected(faq: FaqEntry): void {
    this.chatService.sendMessage(faq.payload);
    this.closeFaqModal();
    void this.router.navigate(['/conversation']);
  }

  toggleMisChatsSection(): void {
    if (!this.sidebarOpen) {
      this.sidebarOpen = true;
    }
    this.misChatsExpanded = !this.misChatsExpanded;
  }

  selectSavedChat(id: string): void {
    this.chatService.loadSavedChat(id);
    void this.router.navigate(['/conversation']);
  }

  isActiveChat(summary: ChatHistorySummary, activeId: string | null): boolean {
    return activeId != null && summary.id === activeId;
  }

  onNuevoChatClick(event: Event): void {
    event.preventDefault();
    this.chatService.startNewChat();
    void this.router.navigate(['/']);
  }

  openAboutRaiModal(): void {
    this.aboutRaiModalOpen = true;
  }

  closeAboutRaiModal(): void {
    this.aboutRaiModalOpen = false;
  }
}
