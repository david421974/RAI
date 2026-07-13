import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface ChatButton {
  title: string;
  payload: string;
}

export interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  buttons?: ChatButton[];
}

interface ChatMessageStored {
  text: string;
  isUser: boolean;
  timestamp: string;
  buttons?: ChatButton[];
}

interface SavedChatSession {
  id: string;
  title: string;
  sessionId: string;
  messages: ChatMessageStored[];
  updatedAt: string;
}

export interface ChatHistorySummary {
  id: string;
  title: string;
  updatedAt: Date;
}

export interface FaqItem {
  label: string;
  payload: string;
}

const STORAGE_KEY = 'rai-chat-sessions';
const MAX_STORED_SESSIONS = 80;

function serializeMessages(msgs: ChatMessage[]): ChatMessageStored[] {
  return msgs.map((m) => ({
    text: m.text,
    isUser: m.isUser,
    timestamp: (m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp)).toISOString(),
    buttons: m.buttons,
  }));
}

function deserializeMessages(msgs: ChatMessageStored[]): ChatMessage[] {
  return msgs.map((m) => ({
    ...m,
    timestamp: new Date(m.timestamp),
    buttons: m.buttons,
  }));
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly platformId = inject(PLATFORM_ID);

  private rasaApiUrl = 'http://localhost:5005/webhooks/rest/webhook';
  private statsApiUrl = 'http://localhost:7000';
  private sessionId = 'session-' + Math.random().toString(36).substr(2, 9);
  private activeChatIdSubject = new BehaviorSubject<string | null>(null);
  /** Id del chat persistente cargado / en edición (null antes del primer mensaje de un chat nuevo). */
  readonly activeChatId$ = this.activeChatIdSubject.asObservable();

  private savedSessionsSubject = new BehaviorSubject<SavedChatSession[]>([]);

  readonly chatHistory$: Observable<ChatHistorySummary[]> = this.savedSessionsSubject.pipe(
    map((rows: SavedChatSession[]) =>
      [...rows]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((r) => ({
          id: r.id,
          title: r.title,
          updatedAt: new Date(r.updatedAt),
        })),
    ),
  );

  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  readonly faqs: FaqItem[] = [];

  constructor(private http: HttpClient) {
    if (isPlatformBrowser(this.platformId)) {
      this.reloadSessionsFromStorage();
    }
  }

  private reloadSessionsFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as SavedChatSession[]) : [];
      this.savedSessionsSubject.next(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.savedSessionsSubject.next([]);
    }
  }

  private persistSessions(rows: SavedChatSession[]): void {
    this.savedSessionsSubject.next(rows);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      /* ignore quota / privacy mode */
    }
  }

  private deriveTitle(messages: ChatMessage[]): string {
    const firstUser = messages.find((m) => m.isUser);
    const source = firstUser?.text?.trim() || 'Chat sin título';
    const maxLen = 48;
    return source.length > maxLen ? source.slice(0, maxLen) + '…' : source;
  }

  private syncCurrentConversationToStorage(): void {
    const msgs = this.messagesSubject.value;
    if (msgs.length === 0) return;

    const rows = [...this.savedSessionsSubject.value];
    const nowIso = new Date().toISOString();

    let id = this.activeChatIdSubject.value;
    if (!id) {
      id = 'chat-' + Math.random().toString(36).slice(2, 11);
      this.activeChatIdSubject.next(id);
    }

    const stored: ChatMessageStored[] = serializeMessages(msgs);
    const title = this.deriveTitle(msgs);
    const idx = rows.findIndex((r) => r.id === id);
    const entry: SavedChatSession = {
      id,
      title,
      sessionId: this.sessionId,
      messages: stored,
      updatedAt: nowIso,
    };

    if (idx >= 0) {
      rows[idx] = entry;
    } else {
      rows.unshift(entry);
      if (rows.length > MAX_STORED_SESSIONS) {
        rows.length = MAX_STORED_SESSIONS;
      }
    }
    this.persistSessions(rows);
  }

  getMessages(): ChatMessage[] {
    return this.messagesSubject.value;
  }

  sendMessage(text: string): void {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      text,
      isUser: true,
      timestamp: new Date(),
    };

    const currentMessages = [...this.messagesSubject.value, userMessage];
    this.messagesSubject.next(currentMessages);
    this.loadingSubject.next(true);
    this.syncCurrentConversationToStorage();

    const payload = {
      sender: this.sessionId,
      message: text,
    };

    // Best-effort: registra el intent detectado para construir "top intents".
    this.http
      .post(`${this.statsApiUrl}/intents/log-from-message`, { message: text, sender: this.sessionId })
      .subscribe({ next: () => {}, error: () => {} });

    this.http.post<Array<{ text?: string; buttons?: ChatButton[] }>>(this.rasaApiUrl, payload).subscribe({
      next: (response) => {
        const data = Array.isArray(response) ? response : [response];
       
        // 1. Filtramos los datos válidos que llegan de Rasa
        const validResponses = data.filter((r) => r && (r.text || r.buttons));
        const botMessages: ChatMessage[] = [];

        if (validResponses.length > 0) {
          // 2. Concatenamos todos los textos en un solo string, separados por doble salto de línea
          const combinedText = validResponses
            .map((r) => r.text)
            .filter((text) => !!text) // Ignorar los que vengan sin texto
            .join('\n\n');

          // 3. Agrupamos los botones en caso de que vengan repartidos en varios mensajes
          const allButtons = validResponses.reduce((acc, curr) => {
            return curr.buttons ? acc.concat(curr.buttons) : acc;
          }, [] as ChatButton[]);

          // 4. Creamos un único mensaje de bot con todo el contenido consolidado
          botMessages.push({
            text: combinedText || '', // Por si solo enviara botones sin texto
            isUser: false,
            timestamp: new Date(),
            buttons: allButtons.length > 0 ? allButtons : undefined,
          });
        } else {
          // Fallback si la respuesta viene vacía
          botMessages.push({
            text: 'Lo siento, no he podido entender tu mensaje. ¿Podrías reformularlo?',
            isUser: false,
            timestamp: new Date(),
          });
        }

        this.messagesSubject.next([...this.messagesSubject.value, ...botMessages]);
        this.loadingSubject.next(false);
        this.syncCurrentConversationToStorage();
      },
      error: () => {
        const errorMsg: ChatMessage = {
          text: 'Error de conexión con el servidor. Inténtalo más tarde.',
          isUser: false,
          timestamp: new Date(),
        };
        this.messagesSubject.next([...this.messagesSubject.value, errorMsg]);
        this.loadingSubject.next(false);
        this.syncCurrentConversationToStorage();
      },
    });
  }

  sendButtonPayload(payload: string): void {
    this.sendMessage(payload);
  }

  /** Nueva conversación vacía en memoria y nuevo sender en Rasa (no borra el historial guardado). */
  startNewChat(): void {
    this.sessionId = 'session-' + Math.random().toString(36).substr(2, 9);
    this.activeChatIdSubject.next(null);
    this.messagesSubject.next([]);
  }

  /** Carga mensajes y sesión Rasa de un chat guardado y lo deja como conversación actual. */
  loadSavedChat(id: string): void {
    const row = this.savedSessionsSubject.value.find((r: SavedChatSession) => r.id === id);
    if (!row) return;

    this.sessionId = row.sessionId;
    this.activeChatIdSubject.next(row.id);
    this.messagesSubject.next(deserializeMessages(row.messages));

    const nowIso = new Date().toISOString();
    const rows = [...this.savedSessionsSubject.value];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], updatedAt: nowIso };
      this.persistSessions(rows);
    }
  }

}
