import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessagesComponent } from '../../components/chat-messages/chat-messages.component';
import { ChatInputComponent } from '../../components/chat-input/chat-input.component';
import { ChatService, ChatMessage } from '../../services/chat.service';

@Component({
  selector: 'app-conversation',
  standalone: true,
  imports: [
    CommonModule,
    ChatMessagesComponent,
    ChatInputComponent,
  ],
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.css'],
})
export class ConversationComponent implements OnInit, AfterViewChecked {
  messages: ChatMessage[] = [];
  isLoading = false;

  @ViewChild('messagesArea') private messagesArea!: ElementRef<HTMLDivElement>;
  private shouldScroll = false;

  constructor(private chatService: ChatService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.chatService.messages$.subscribe((msgs) => {
      this.messages = msgs;
      this.shouldScroll = true;
      this.cdr.detectChanges();
    });

    this.chatService.loading$.subscribe((loading) => {
      this.isLoading = loading;
      this.shouldScroll = true;
      this.cdr.detectChanges();
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onSendMessage(text: string): void {
    this.chatService.sendMessage(text);
  }

  private scrollToBottom(): void {
    const el = this.messagesArea?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
