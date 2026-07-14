import {
  Component, OnInit, signal, computed, ViewChild, ElementRef, AfterViewChecked, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiAssistantService, ChatMessage } from '../../../core/services/ai-assistant.service';
import { ClientsService } from '../../../core/services/clients.service';
import { Client } from '../../../core/models/client.model';

@Component({
  selector: 'app-ai-chat-fullscreen',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatTooltipModule],
  template: `
<div class="page">

  <!-- ── Header ──────────────────────────────────────────────────── -->
  <header class="topbar">
    <a [routerLink]="['/clients', clientId]" class="btn-back">
      <mat-icon>arrow_back</mat-icon>
      <span>{{ client()?.nom ?? 'Dossier' }}</span>
    </a>

    <div class="topbar-center">
      <div class="ai-title">
        <mat-icon>smart_toy</mat-icon>
        <span>Assistant IA</span>
      </div>
      @if (client()) {
        <span class="ai-sep">·</span>
        <span class="ai-client">{{ client()!.nom }}</span>
      }
      <div class="ai-live">
        <span class="ai-live__dot"></span>
        En ligne
      </div>
    </div>

    <div class="topbar-right">
      @if (messages().length > 0) {
        <button class="btn-icon btn-icon--danger"
                (click)="clearHistory()"
                matTooltip="Effacer la conversation">
          <mat-icon>delete_sweep</mat-icon>
        </button>
      }
    </div>
  </header>

  <!-- ── Corps ───────────────────────────────────────────────────── -->
  <div class="body">
    <div class="messages" #messagesContainer>

      <!-- Écran d'accueil -->
      @if (messages().length === 0 && !loading()) {
        <div class="welcome">
          <div class="welcome-avatar">
            <mat-icon>smart_toy</mat-icon>
          </div>
          <h2>Bonjour, je suis votre assistant dédié au dossier<br><strong>{{ client()?.nom }}</strong>.</h2>
          <p>Posez-moi vos questions sur ce dossier : identité, performances financières, missions, analyse stratégique, contrôle interne…</p>
          <div class="welcome-chips">
            @for (s of suggestions; track s.text) {
              <button class="welcome-chip" (click)="sendSuggestion(s.text)">
                <mat-icon>{{ s.icon }}</mat-icon>{{ s.text }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Conversations -->
      @for (pair of messagePairs(); track $index) {
        <div class="msg-group">
          <!-- Question utilisateur -->
          <div class="msg-user">
            <div class="msg-user__bubble" [innerHTML]="formatContent(pair.user.content)"></div>
          </div>
          <!-- Réponse IA -->
          @if (pair.ai) {
            <div class="msg-ai">
              <div class="msg-ai__avatar"><mat-icon>smart_toy</mat-icon></div>
              <div class="msg-ai__content">
                <div class="msg-ai__name">Assistant IA</div>
                <div class="msg-ai__bubble">
                  @if (pair.ai.content) {
                    <span [innerHTML]="formatContent(pair.ai.content)"></span>
                  } @else {
                    <div class="typing-dots">
                      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

    </div>
  </div>

  <!-- ── Input ────────────────────────────────────────────────────── -->
  <footer class="footer">
    <div class="input-shell" [class.input-shell--focused]="focused()">
      <textarea
        [(ngModel)]="inputText"
        placeholder="Posez votre question sur le dossier…"
        class="input-field"
        rows="1"
        (keydown.enter)="onEnter($event)"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
        [disabled]="loading()">
      </textarea>
      <div class="input-bar">
        <span class="input-hint">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</span>
        <button class="btn-send" [disabled]="!inputText.trim() || loading()" (click)="send()">
          <mat-icon>{{ loading() ? 'hourglass_empty' : 'send' }}</mat-icon>
          <span>{{ loading() ? 'En cours…' : 'Envoyer' }}</span>
        </button>
      </div>
    </div>
  </footer>

</div>
  `,
  styles: [`
    /* ── Layout racine ───────────────────────────────────────────────
       CRITIQUE : min-height:0 sur .body pour que le scroll fonctionne
       dans un conteneur flex column.
    ───────────────────────────────────────────────────────────────── */
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
      background: #F1F5F9;
      font-family: inherit;
    }
    .page {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* ── Topbar ───────────────────────────────────────────────────── */
    .topbar {
      display: flex; align-items: center; gap: 12px;
      padding: 0 20px; height: 58px; flex-shrink: 0;
      background: white;
      border-bottom: 1px solid #E2E8F0;
      box-shadow: 0 1px 6px rgba(0,0,0,.06);
      z-index: 10;
    }
    .btn-back {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 14px 6px 10px; border-radius: 10px;
      background: #F1F5F9; color: #475569;
      text-decoration: none; font-size: 13.5px; font-weight: 600;
      transition: all .15s; white-space: nowrap; flex-shrink: 0;
      mat-icon { font-size: 17px !important; width: 17px !important; height: 17px !important; }
      &:hover { background: #E2E8F0; color: #1E293B; }
    }
    .topbar-center {
      flex: 1; display: flex; justify-content: center; align-items: center; gap: 10px;
      min-width: 0;
    }
    .ai-title {
      display: flex; align-items: center; gap: 8px;
      color: #1E293B; font-size: 15px; font-weight: 700;
      mat-icon { font-size: 20px !important; width: 20px !important; height: 20px !important; color: #4338CA; }
    }
    .ai-sep { color: #CBD5E1; font-weight: 300; }
    .ai-client {
      font-size: 14px; font-weight: 500; color: #4338CA;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;
    }
    .ai-live {
      display: flex; align-items: center; gap: 5px;
      padding: 3px 9px; border-radius: 100px;
      background: #ECFDF5; color: #059669; font-size: 11px; font-weight: 600;
    }
    .ai-live__dot {
      width: 6px; height: 6px; border-radius: 50%; background: #22C55E;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    .topbar-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .btn-icon {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 9px; border: none;
      background: transparent; color: #94A3B8; cursor: pointer; transition: all .15s;
      mat-icon { font-size: 19px !important; width: 19px !important; height: 19px !important; }
      &:hover { background: #F1F5F9; color: #475569; }
    }
    .btn-icon--danger:hover { background: #FEE2E2 !important; color: #EF4444 !important; }

    /* ── Body — min-height:0 est LA correction critique ─────────────  */
    .body {
      flex: 1;
      min-height: 0;   /* empêche le flex item de déborder */
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .messages {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 36px 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 0;
      scroll-behavior: smooth;
    }
    /* Scrollbar discrète */
    .messages::-webkit-scrollbar { width: 5px; }
    .messages::-webkit-scrollbar-track { background: transparent; }
    .messages::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }

    /* ── Welcome ──────────────────────────────────────────────────── */
    .welcome {
      max-width: 680px; width: 100%;
      margin: auto;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      text-align: center; padding: 0 8px;
    }
    .welcome-avatar {
      width: 72px; height: 72px; border-radius: 22px;
      background: linear-gradient(135deg, #1e40af, #4338ca);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 28px rgba(67,56,202,.28);
      mat-icon { font-size: 36px !important; width: 36px !important; height: 36px !important; color: white; }
    }
    .welcome h2 {
      font-size: 20px; font-weight: 600; color: #1E293B; margin: 0; line-height: 1.45;
      strong { color: #3730A3; }
    }
    .welcome p {
      font-size: 14px; color: #64748B; margin: 0; line-height: 1.65; max-width: 500px;
    }
    .welcome-chips {
      display: flex; flex-wrap: wrap; gap: 9px; justify-content: center; margin-top: 4px;
    }
    .welcome-chip {
      display: flex; align-items: center; gap: 7px;
      padding: 10px 18px; border: 1.5px solid #E2E8F0; border-radius: 14px;
      background: white; color: #475569; font-size: 13px; font-weight: 500;
      cursor: pointer; font-family: inherit; transition: all .18s;
      box-shadow: 0 1px 3px rgba(0,0,0,.05);
      mat-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; color: #94A3B8; flex-shrink: 0; }
      &:hover {
        border-color: #6366F1; color: #3730A3; background: #EEF2FF;
        transform: translateY(-1px); box-shadow: 0 3px 10px rgba(99,102,241,.15);
        mat-icon { color: #6366F1; }
      }
    }

    /* ── Groupes de messages ──────────────────────────────────────── */
    .msg-group {
      display: flex; flex-direction: column;
      max-width: 820px; width: 100%; margin: 0 auto;
      padding: 10px 0;
    }
    .msg-group + .msg-group { border-top: 1px solid #F1F5F9; }

    /* Message utilisateur */
    .msg-user {
      display: flex; justify-content: flex-end; padding: 4px 0 8px;
    }
    .msg-user__bubble {
      max-width: 72%; padding: 12px 18px; border-radius: 18px 18px 5px 18px;
      background: linear-gradient(135deg, #1e40af, #3730a3);
      color: white; font-size: 14.5px; line-height: 1.65;
      box-shadow: 0 3px 12px rgba(30,64,175,.22);
    }

    /* Message IA */
    .msg-ai { display: flex; gap: 12px; align-items: flex-start; padding: 8px 0 4px; }
    .msg-ai__avatar {
      width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; margin-top: 2px;
      background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 17px !important; width: 17px !important; height: 17px !important; color: #4338CA; }
    }
    .msg-ai__content { flex: 1; min-width: 0; }
    .msg-ai__name { font-size: 11.5px; font-weight: 700; color: #6366F1; margin-bottom: 5px; letter-spacing: .3px; }
    .msg-ai__bubble {
      display: inline-block; padding: 13px 18px; border-radius: 5px 18px 18px 18px;
      background: white; border: 1px solid #E8EEFF;
      font-size: 14.5px; line-height: 1.75; color: #1E293B;
      box-shadow: 0 1px 6px rgba(0,0,0,.06);
      max-width: 100%;
    }

    /* Markdown dans les bulles */
    .msg-ai__bubble, .msg-user__bubble {
      p      { margin: 0 0 8px; &:last-child { margin: 0; } }
      strong { font-weight: 700; }
      em     { font-style: italic; }
      ul, ol { margin: 6px 0 6px 20px; padding: 0; }
      li     { margin-bottom: 4px; }
      h2,h3,h4 { font-size: 14.5px; font-weight: 700; margin: 10px 0 4px; }
      pre    { border-radius: 8px; padding: 12px; overflow-x: auto; margin: 8px 0; }
    }
    .msg-ai__bubble {
      code { font-size: 12.5px; background: #EEF2FF; color: #4338CA;
             padding: 2px 6px; border-radius: 4px; font-family: monospace; }
      pre  { background: #F8FAFC; border: 1px solid #E2E8F0;
             code { background: none; color: #334155; padding: 0; } }
    }
    .msg-user__bubble {
      code { background: rgba(255,255,255,.18); color: #e0e7ff; padding: 2px 5px; border-radius: 3px; }
    }

    /* Typing */
    .typing-dots { display: flex; align-items: center; gap: 5px; padding: 4px 0; }
    .dot {
      width: 7px; height: 7px; border-radius: 50%; background: #94A3B8;
      animation: bounce 1.2s infinite;
      &:nth-child(2) { animation-delay: .2s; }
      &:nth-child(3) { animation-delay: .4s; }
    }
    @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }

    /* ── Footer / Input ───────────────────────────────────────────── */
    .footer {
      flex-shrink: 0;
      padding: 14px 24px 18px;
      background: white;
      border-top: 1px solid #E2E8F0;
      box-shadow: 0 -2px 12px rgba(0,0,0,.05);
    }
    .input-shell {
      max-width: 820px; margin: 0 auto;
      border: 1.5px solid #CBD5E1; border-radius: 16px;
      background: #F8FAFC; transition: border-color .18s, box-shadow .18s;
      overflow: hidden;
    }
    .input-shell--focused {
      border-color: #6366F1; background: white;
      box-shadow: 0 0 0 3px rgba(99,102,241,.1);
    }
    .input-field {
      display: block; width: 100%; box-sizing: border-box;
      border: none; outline: none;
      padding: 14px 18px 8px; font-size: 14.5px; font-family: inherit;
      color: #1E293B; background: transparent; resize: none;
      line-height: 1.6; max-height: 150px;
      &::placeholder { color: #94A3B8; }
    }
    .input-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 10px 10px 14px; gap: 12px;
    }
    .input-hint { font-size: 11.5px; color: #B0BAC7; }
    .btn-send {
      display: flex; align-items: center; gap: 7px;
      padding: 8px 20px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #1e40af, #3730a3);
      color: white; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all .15s;
      mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
      &:disabled { opacity: .35; cursor: default; }
      &:not(:disabled):hover { opacity: .88; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(30,64,175,.3); }
    }
  `],
})
export class AiChatFullscreenComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private aiService = inject(AiAssistantService);
  private clientsSvc = inject(ClientsService);

  clientId!: number;
  client   = signal<Client | null>(null);
  messages = signal<ChatMessage[]>([]);
  loading  = signal(false);
  focused  = signal(false);
  inputText = '';

  private shouldScroll = false;

  messagePairs = computed(() => {
    const msgs = this.messages();
    const pairs: { user: ChatMessage; ai: ChatMessage | null }[] = [];
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'user') {
        const ai = msgs[i + 1]?.role === 'assistant' ? msgs[i + 1] : null;
        pairs.push({ user: msgs[i], ai });
        if (ai) i++;
      }
    }
    return pairs;
  });

  suggestions = [
    { icon: 'summarize',       text: 'Résume ce dossier rapidement' },
    { icon: 'warning',         text: 'Quels sont les risques identifiés ?' },
    { icon: 'account_balance', text: 'Points d\'attention fiscaux ?' },
    { icon: 'handshake',       text: 'État de la relation client ?' },
    { icon: 'trending_up',     text: 'Analyse les performances financières' },
    { icon: 'security',        text: 'État du contrôle interne' },
  ];

  ngOnInit() {
    this.clientId = +this.route.snapshot.paramMap.get('id')!;
    this.clientsSvc.getOne(this.clientId).subscribe(c => this.client.set(c));
    this.aiService.getHistory(this.clientId).subscribe(h => {
      this.messages.set(h.map(m => ({ role: m.role as 'user' | 'assistant', content: m.contenu })));
      this.shouldScroll = true;
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  onEnter(e: Event) {
    if (!(e as KeyboardEvent).shiftKey) { e.preventDefault(); this.send(); }
  }

  sendSuggestion(text: string) { this.inputText = text; this.send(); }

  async send() {
    const content = this.inputText.trim();
    if (!content || this.loading()) return;
    this.inputText = '';
    this.loading.set(true);

    const msgs = [...this.messages()];
    msgs.push({ role: 'user', content });
    msgs.push({ role: 'assistant', content: '' });
    this.messages.set(msgs);
    this.shouldScroll = true;

    const idx = this.messages().length - 1;
    const toSend = this.messages().slice(0, -1).filter(m => m.content.trim()).slice(-10);

    await this.aiService.chatStream(
      this.clientId, toSend,
      chunk => {
        const updated = [...this.messages()];
        updated[idx] = { ...updated[idx], content: updated[idx].content + chunk };
        this.messages.set(updated);
        this.shouldScroll = true;
      },
      () => { this.loading.set(false); this.shouldScroll = true; },
      err => {
        const updated = [...this.messages()];
        updated[idx] = { ...updated[idx], content: `⚠️ ${err}` };
        this.messages.set(updated);
        this.loading.set(false);
      },
    );
  }

  clearHistory() {
    this.aiService.clearHistory(this.clientId).subscribe(() => this.messages.set([]));
  }

  formatContent(text: string): string {
    if (!text) return '';
    const blocks: string[] = [];
    text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => {
      const safe = c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      blocks.push(`<pre><code>${safe}</code></pre>`);
      return `\x00B${blocks.length - 1}\x00`;
    });
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/^#{1,4} (.+)$/gm, '<strong>$1</strong>');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^\s*][^*]*)\*/g, '<em>$1</em>');
    const lines = text.split('\n');
    const out: string[] = []; let inList = false;
    for (const ln of lines) {
      const m = ln.match(/^[-•*]\s+(.+)$/);
      if (m)  { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${m[1]}</li>`); }
      else    { if (inList)  { out.push('</ul>'); inList = false; } out.push(ln); }
    }
    if (inList) out.push('</ul>');
    text = out.join('\n');
    text = text.split(/\n\n+/).map(b => {
      b = b.trim(); if (!b) return '';
      if (/^<(strong|ul|pre)/.test(b)) return b;
      return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
    }).join('');
    return text.replace(/\x00B(\d+)\x00/g, (_, i) => blocks[+i]);
  }

  private scrollToBottom() {
    try { const el = this.messagesContainer?.nativeElement; if (el) el.scrollTop = el.scrollHeight; } catch {}
  }
}
