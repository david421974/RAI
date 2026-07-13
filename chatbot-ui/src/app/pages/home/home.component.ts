import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WelcomeMessageComponent } from '../../components/welcome-message/welcome-message.component';
import { ChatInputComponent } from '../../components/chat-input/chat-input.component';
import { FaqSectionComponent } from '../../components/faq-section/faq-section.component';
import { ChatService, FaqItem } from '../../services/chat.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    WelcomeMessageComponent,
    ChatInputComponent,
    FaqSectionComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  faqs: FaqItem[] = [];

  constructor(
    private chatService: ChatService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.faqs = this.chatService.faqs;
  }

  onSendMessage(text: string): void {
    this.chatService.sendMessage(text);
    this.router.navigate(['/conversation']);
  }

  onFaqSelected(payload: string): void {
    this.chatService.sendMessage(payload);
    this.router.navigate(['/conversation']);
  }
}
