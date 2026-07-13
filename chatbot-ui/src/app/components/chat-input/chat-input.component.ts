import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.css',
})
export class ChatInputComponent {
  @Input() showLabel = true;
  @Output() messageSent = new EventEmitter<string>();

  userInput = '';

  onSend(): void {
    const text = this.userInput.trim();
    if (!text) return;
    this.messageSent.emit(text);
    this.userInput = '';
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }
}
