import { Component, Input, OnInit, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiAssistantService, ChatMessage } from '../../../../../core/services/ai-assistant.service';

@Component({
  selector: 'app-ai-assistant-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="ai-tab">

      <!-- Header -->
      <div class="ai-header">
        <div class="ai-header__left">
          <div class="ai-badge">
            <span class="ai-dot"></span>
            <span>Mistral IA — Dossier {{ clientId }}</span>
          </div>
          <p class="ai-header__sub">Assistant entraîné sur les données de ce client. Ne sort jamais du contexte du dossier.</p>
        </div>
        <button mat-icon-button (click)="clearHistory()" matTooltip="Effacer la conversation"
                [disabled]="loading" class="btn-clear">
          <mat-icon>delete_sweep</mat-icon>
        </button>
      </div>

      <!-- Suggestions initiales -->
      @if (messages.length === 0 && !loading) {
        <div class="suggestions">
          <p class="suggestions__label">Suggestions pour démarrer</p>
          <div class="suggestions__grid">
            @for (s of suggestions; track s) {
              <button class="suggestion-chip" (click)="sendSuggestion(s)">{{ s }}</button>
            }
          </div>
        </div>
      }

      <!-- Messages -->
      <div class="messages" #messagesContainer>
        @for (msg of messages; track $index) {
          <div class="message" [class.message--user]="msg.role === 'user'" [class.message--assistant]="msg.role === 'assistant'">
            @if (msg.role === 'assistant') {
              <div class="message__avatar">
                <mat-icon>smart_toy</mat-icon>
              </div>
            }
            <div class="message__bubble">
              <div class="message__content" [innerHTML]="formatContent(msg.content)"></div>
            </div>
            @if (msg.role === 'user') {
              <div class="message__avatar message__avatar--user">
                <mat-icon>person</mat-icon>
              </div>
            }
          </div>
        }

        @if (loading) {
          <div class="message message--assistant">
            <div class="message__avatar">
              <mat-icon>smart_toy</mat-icon>
            </div>
            <div class="message__bubble">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Input -->
      <div class="ai-input-wrap">
        <div class="ai-input">
          <textarea
            [(ngModel)]="inputText"
            placeholder="Posez votre question sur ce client..."
            rows="1"
            class="ai-textarea"
            (keydown.enter)="onEnter($event)"
            [disabled]="loading"
            #inputArea>
          </textarea>
          <button mat-icon-button class="btn-send"
                  [disabled]="!inputText.trim() || loading"
                  (click)="send()">
            <mat-icon>{{ loading ? 'hourglass_empty' : 'send' }}</mat-icon>
          </button>
        </div>
        <p class="ai-input__hint">Entrée pour envoyer · Shift+Entrée pour saut de ligne · Les données restent sur le serveur</p>
      </div>
    </div>
  `,
  styles: [`
    .ai-tab {
      display: flex; flex-direction: column;
      height: calc(100vh - 280px); min-height: 500px;
      padding: 20px 24px;
    }

    /* Header */
    .ai-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 20px; padding-bottom: 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    .ai-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, #f0f4ff, #ede9fe);
      border: 1px solid #c7d2fe; border-radius: 20px;
      padding: 5px 14px; font-size: 13px; font-weight: 600; color: #4338ca;
      margin-bottom: 6px;
    }
    .ai-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 2px rgba(34,197,94,0.25);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .ai-header__sub { font-size: 12px; color: #94a3b8; margin: 0; }
    .btn-clear { color: #cbd5e1 !important; }
    .btn-clear:hover { color: #f87171 !important; }

    /* Suggestions */
    .suggestions { margin-bottom: 20px; }
    .suggestions__label { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 10px; }
    .suggestions__grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .suggestion-chip {
      border: 1px solid #e2e8f0; background: white;
      border-radius: 20px; padding: 7px 14px;
      font-size: 13px; color: #475569; cursor: pointer;
      transition: all 0.15s; font-family: inherit;
    }
    .suggestion-chip:hover { border-color: #6366f1; color: #4338ca; background: #f0f4ff; }

    /* Messages */
    .messages {
      flex: 1; overflow-y: auto; padding: 8px 0;
      display: flex; flex-direction: column; gap: 20px;
      scroll-behavior: smooth;
    }
    .message {
      display: flex; align-items: flex-start; gap: 10px;
    }
    .message--user { flex-direction: row-reverse; }

    .message__avatar {
      width: 32px; height: 32px; border-radius: 10px;
      background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .message__avatar mat-icon { font-size: 17px; width: 17px; height: 17px; color: #4338ca; }
    .message__avatar--user { background: linear-gradient(135deg, #1e40af, #3730a3); }
    .message__avatar--user mat-icon { color: white; }

    .message__bubble {
      max-width: 75%; padding: 12px 16px; border-radius: 14px;
      font-size: 14px; line-height: 1.65; color: #1e293b;
    }
    .message--assistant .message__bubble {
      background: #f8fafc; border: 1px solid #e8ecf0;
      border-top-left-radius: 4px;
    }
    .message--user .message__bubble {
      background: linear-gradient(135deg, #1e40af, #3730a3);
      color: white; border-top-right-radius: 4px;
    }

    .message__content :global(strong) { font-weight: 700; }
    .message__content :global(ul) { margin: 8px 0; padding-left: 20px; }
    .message__content :global(li) { margin-bottom: 4px; }

    /* Typing indicator */
    .typing-indicator { display: flex; gap: 4px; align-items: center; padding: 4px 0; }
    .typing-indicator span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #94a3b8; animation: bounce 1.2s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }

    /* Input */
    .ai-input-wrap { padding-top: 16px; border-top: 1px solid #f1f5f9; margin-top: 16px; }
    .ai-input {
      display: flex; align-items: flex-end; gap: 8px;
      background: white; border: 1.5px solid #e2e8f0;
      border-radius: 14px; padding: 10px 10px 10px 16px;
      transition: border-color 0.15s;
    }
    .ai-input:focus-within { border-color: #6366f1; }
    .ai-textarea {
      flex: 1; border: none; outline: none; resize: none;
      font-size: 14px; font-family: inherit; color: #1e293b;
      background: transparent; line-height: 1.5; max-height: 120px;
    }
    .ai-textarea::placeholder { color: #94a3b8; }
    .btn-send {
      background: linear-gradient(135deg, #1e40af, #3730a3) !important;
      color: white !important; border-radius: 10px !important;
      width: 38px !important; height: 38px !important;
      flex-shrink: 0;
    }
    .btn-send:disabled { opacity: 0.4; }
    .ai-input__hint { font-size: 11px; color: #cbd5e1; margin: 6px 0 0; text-align: center; }
  `],
})
export class AiAssistantTabComponent implements OnInit, AfterViewChecked {
  @Input() clientId!: number;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  private service = inject(AiAssistantService);

  messages: ChatMessage[] = [];
  inputText = '';
  loading = false;
  private shouldScroll = false;

  suggestions = [
    'Résume-moi ce dossier pour une prise en charge rapide',
    'Quels sont les points d\'attention fiscaux ?',
    'Quelles missions ont été refusées et pourquoi ?',
    'Quel est l\'état de la relation avec ce client ?',
    'Quels fournisseurs dois-je contacter en priorité ?',
    'Y a-t-il des risques identifiés sur ce dossier ?',
  ];

  ngOnInit() {
    this.service.getHistory(this.clientId).subscribe((history) => {
      this.messages = history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.contenu,
      }));
      this.shouldScroll = true;
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onEnter(event: Event) {
    if (!(event as KeyboardEvent).shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  sendSuggestion(text: string) {
    this.inputText = text;
    this.send();
  }

  async send() {
    const content = this.inputText.trim();
    if (!content || this.loading) return;

    this.inputText = '';
    this.loading = true;

    this.messages.push({ role: 'user', content });
    this.messages.push({ role: 'assistant', content: '' });
    this.shouldScroll = true;

    const assistantIndex = this.messages.length - 1;
    const messagesToSend = this.messages
      .slice(0, -1)
      .filter((m) => m.content.trim())
      .slice(-10); // keep last 10 for context

    await this.service.chatStream(
      this.clientId,
      messagesToSend,
      (chunk) => {
        this.messages[assistantIndex].content += chunk;
        this.shouldScroll = true;
      },
      () => {
        this.loading = false;
        this.shouldScroll = true;
      },
      (err) => {
        this.messages[assistantIndex].content = `⚠️ ${err}`;
        this.loading = false;
      },
    );
  }

  clearHistory() {
    this.service.clearHistory(this.clientId).subscribe(() => {
      this.messages = [];
    });
  }

  formatContent(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
  }

  private scrollToBottom() {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
