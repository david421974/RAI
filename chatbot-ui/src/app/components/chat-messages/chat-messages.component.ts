import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  SimpleChanges,
  OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../services/chat.service';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-messages.component.html',
  styleUrl: './chat-messages.component.css',
})
export class ChatMessagesComponent implements OnChanges {
  @Input() messages: ChatMessage[] = [];
  @Input() isLoading = false;

  @ViewChild('viewport', { static: true }) viewport!: ElementRef<HTMLElement>;

  private lastHandledBotTs?: number;
  private prevLen = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['messages']) return;

    const newLen = this.messages?.length ?? 0;
    if (newLen <= this.prevLen) {
      this.prevLen = newLen;
      return;
    }

    // Mensaje nuevo añadido => miramos el último
    const last = this.messages[newLen - 1];
    this.prevLen = newLen;

    // Solo nos interesa cuando la respuesta es del bot (no usuario)
    if (!last || last.isUser) return;

    // Evita repetir scroll para el mismo mensaje
    if (this.lastHandledBotTs === (last as any).timestamp) return;
    this.lastHandledBotTs = (last as any).timestamp;

    // Espera a que Angular pinte el DOM
    requestAnimationFrame(() => {
      const vp = this.viewport.nativeElement;
      const el = vp.querySelector(`[data-ts="${(last as any).timestamp}"]`) as HTMLElement | null;

      // Scroll para que se vea el inicio del mensaje (primeras líneas)
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
}
