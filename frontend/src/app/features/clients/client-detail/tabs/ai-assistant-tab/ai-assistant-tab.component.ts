import { Component, Input, OnInit, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiAssistantService, ChatMessage, AiContextSummary } from '../../../../../core/services/ai-assistant.service';

interface ContextCategory {
  icon: string;
  label: string;
  detail: string;
  available: boolean;
}

@Component({
  selector: 'app-ai-assistant-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  template: `
<div class="ai-tab">

  <!-- ── Header ──────────────────────────────────────────────────── -->
  <div class="ai-header">
    <div class="ai-header__left">
      <div class="ai-badge">
        <span class="ai-dot"></span>
        <mat-icon class="ai-badge-icon">memory</mat-icon>
        IA Locale · Mistral
      </div>
      <p class="ai-subtitle">
        Assistant dédié au dossier
        <strong>{{ clientName }}</strong> —
        Ne sort jamais du contexte de ce client.
      </p>
    </div>
    <div class="ai-header__right">
      <button class="btn-context" [class.btn-context--active]="showContext"
              (click)="showContext = !showContext"
              matTooltip="Voir les données envoyées à l'IA">
        <mat-icon>{{ showContext ? 'expand_less' : 'dataset' }}</mat-icon>
        Contexte
      </button>
      <button class="btn-icon-sm" (click)="clearHistory()"
              [disabled]="loading || messages.length === 0"
              matTooltip="Effacer la conversation">
        <mat-icon>delete_sweep</mat-icon>
      </button>
    </div>
  </div>

  <!-- ── Panneau contexte ─────────────────────────────────────────── -->
  @if (showContext) {
    <div class="context-panel">
      <div class="context-panel__head">
        <mat-icon>info</mat-icon>
        Données du dossier transmises à l'IA
        @if (ctx) {
          <span class="context-score">
            Score passation : <strong>{{ ctx.santePassation }}%</strong>
          </span>
        }
      </div>
      @if (!ctx) {
        <p class="context-loading">Chargement…</p>
      } @else {
        <div class="context-grid">
          @for (cat of contextCategories; track cat.label) {
            <div class="context-item" [class.context-item--ok]="cat.available" [class.context-item--empty]="!cat.available">
              <mat-icon class="context-item__icon">{{ cat.available ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
              <div>
                <div class="context-item__label">{{ cat.label }}</div>
                <div class="context-item__detail">{{ cat.detail }}</div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  }

  <!-- ── Suggestions initiales ───────────────────────────────────── -->
  @if (messages.length === 0 && !loading) {
    <div class="suggestions">
      <p class="suggestions__label">
        <mat-icon>lightbulb</mat-icon>
        Suggestions pour démarrer
      </p>
      <div class="suggestions__grid">
        @for (s of suggestions; track s.text) {
          <button class="suggestion-chip" (click)="sendSuggestion(s.text)">
            <mat-icon class="suggestion-chip__icon">{{ s.icon }}</mat-icon>
            <span>{{ s.text }}</span>
          </button>
        }
      </div>
    </div>
  }

  <!-- ── Messages ─────────────────────────────────────────────────── -->
  <div class="messages" #messagesContainer>
    @for (msg of messages; track $index) {
      <div class="message" [class.message--user]="msg.role === 'user'" [class.message--ai]="msg.role === 'assistant'">
        @if (msg.role === 'assistant') {
          <div class="msg-avatar msg-avatar--ai">
            <mat-icon>smart_toy</mat-icon>
          </div>
        }
        <div class="msg-bubble">
          <div class="msg-content" [innerHTML]="formatContent(msg.content)"></div>
        </div>
        @if (msg.role === 'user') {
          <div class="msg-avatar msg-avatar--user">
            <mat-icon>person</mat-icon>
          </div>
        }
      </div>
    }

    @if (loading) {
      <div class="message message--ai">
        <div class="msg-avatar msg-avatar--ai">
          <mat-icon>smart_toy</mat-icon>
        </div>
        <div class="msg-bubble">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    }
  </div>

  <!-- ── Input ────────────────────────────────────────────────────── -->
  <div class="ai-input-area">
    <div class="ai-input" [class.ai-input--focused]="inputFocused">
      <textarea
        [(ngModel)]="inputText"
        placeholder="Posez votre question sur ce dossier…"
        rows="1"
        class="ai-textarea"
        (keydown.enter)="onEnter($event)"
        (focus)="inputFocused = true"
        (blur)="inputFocused = false"
        [disabled]="loading"
        #inputArea>
      </textarea>
      <button class="btn-send"
              [disabled]="!inputText.trim() || loading"
              (click)="send()">
        <mat-icon>{{ loading ? 'hourglass_empty' : 'send' }}</mat-icon>
      </button>
    </div>
    <p class="ai-input__hint">
      <kbd>Entrée</kbd> pour envoyer · <kbd>Shift+Entrée</kbd> pour saut de ligne
    </p>
  </div>

</div>
  `,
  styles: [`
    .ai-tab {
      display: flex; flex-direction: column;
      height: calc(100vh - 280px); min-height: 520px;
      padding: 20px 24px; gap: 0;
    }

    /* ── Header ─────────────────────────────────────────────────── */
    .ai-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12px; margin-bottom: 16px; padding-bottom: 16px;
      border-bottom: 1px solid #F1F5F9;
    }
    .ai-header__left { flex: 1; min-width: 0; }
    .ai-header__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

    .ai-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #f0f4ff, #ede9fe);
      border: 1px solid #c7d2fe; border-radius: 20px;
      padding: 4px 12px 4px 8px; font-size: 12px; font-weight: 700;
      color: #4338ca; margin-bottom: 6px;
    }
    .ai-badge-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; }
    .ai-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #22c55e;
      box-shadow: 0 0 0 2px rgba(34,197,94,.25);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    .ai-subtitle { font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.5; }
    .ai-subtitle strong { color: #475569; }

    .btn-context {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 12px; border: 1px solid #E2E8F0; border-radius: 8px;
      background: white; color: #64748B; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all .15s;
      mat-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; }
      &:hover { border-color: #6366F1; color: #4338CA; background: #F0F4FF; }
    }
    .btn-context--active { border-color: #6366F1; color: #4338CA; background: #F0F4FF; }

    .btn-icon-sm {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border: 1px solid #E2E8F0; border-radius: 8px;
      background: white; color: #CBD5E1; cursor: pointer; transition: all .15s;
      mat-icon { font-size: 17px !important; width: 17px !important; height: 17px !important; }
      &:hover:not(:disabled) { border-color: #FCA5A5; color: #F87171; background: #FFF5F5; }
      &:disabled { opacity: .4; cursor: default; }
    }

    /* ── Contexte ─────────────────────────────────────────────────── */
    .context-panel {
      background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;
      padding: 14px 16px; margin-bottom: 16px;
    }
    .context-panel__head {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 700; color: #475569;
      text-transform: uppercase; letter-spacing: .05em; margin-bottom: 12px;
      mat-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; color: #6366F1; }
    }
    .context-score {
      margin-left: auto; font-size: 12px; font-weight: 400; color: #64748B;
      text-transform: none; letter-spacing: 0;
      strong { color: #0F172A; }
    }
    .context-loading { font-size: 12px; color: #94A3B8; font-style: italic; }
    .context-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;
    }
    .context-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 10px; border-radius: 8px; border: 1px solid #E2E8F0;
      background: white;
    }
    .context-item--ok   { border-color: #BBF7D0; background: #F0FDF4; }
    .context-item--empty { opacity: .55; }
    .context-item__icon {
      font-size: 16px !important; width: 16px !important; height: 16px !important;
      flex-shrink: 0; margin-top: 1px;
      color: #CBD5E1;
    }
    .context-item--ok .context-item__icon { color: #22C55E; }
    .context-item__label { font-size: 12px; font-weight: 600; color: #334155; line-height: 1.3; }
    .context-item__detail { font-size: 11px; color: #94A3B8; margin-top: 1px; }

    /* ── Suggestions ──────────────────────────────────────────────── */
    .suggestions { margin-bottom: 16px; }
    .suggestions__label {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; font-weight: 700; color: #94A3B8;
      text-transform: uppercase; letter-spacing: .06em; margin: 0 0 10px;
      mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; color: #FDBA74; }
    }
    .suggestions__grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .suggestion-chip {
      display: inline-flex; align-items: center; gap: 7px;
      border: 1px solid #E2E8F0; background: white; border-radius: 10px;
      padding: 8px 14px; font-size: 13px; color: #475569; cursor: pointer;
      transition: all .15s; font-family: inherit; text-align: left;
    }
    .suggestion-chip__icon {
      font-size: 16px !important; width: 16px !important; height: 16px !important;
      color: #94A3B8; flex-shrink: 0;
    }
    .suggestion-chip:hover {
      border-color: #6366F1; color: #4338CA; background: #F0F4FF;
      .suggestion-chip__icon { color: #6366F1; }
    }

    /* ── Messages ─────────────────────────────────────────────────── */
    .messages {
      flex: 1; overflow-y: auto; padding: 4px 0;
      display: flex; flex-direction: column; gap: 18px;
      scroll-behavior: smooth;
    }
    .message { display: flex; align-items: flex-start; gap: 10px; }
    .message--user { flex-direction: row-reverse; }

    .msg-avatar {
      width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 17px !important; width: 17px !important; height: 17px !important; }
    }
    .msg-avatar--ai {
      background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
      mat-icon { color: #4338CA; }
    }
    .msg-avatar--user {
      background: linear-gradient(135deg, #1e40af, #3730a3);
      mat-icon { color: white; }
    }

    .msg-bubble {
      max-width: 76%; padding: 12px 16px; border-radius: 14px;
      font-size: 14px; line-height: 1.7; color: #1E293B;
    }
    .message--ai .msg-bubble {
      background: #F8FAFC; border: 1px solid #E2E8F0;
      border-top-left-radius: 4px;
    }
    .message--user .msg-bubble {
      background: linear-gradient(135deg, #1e40af, #3730a3);
      color: white; border-top-right-radius: 4px;
    }

    /* Markdown dans les bulles */
    .msg-content {
      p { margin: 0 0 10px; &:last-child { margin-bottom: 0; } }
      h2 { font-size: 15px; font-weight: 700; margin: 12px 0 6px; color: #0F172A; }
      h3, h4 { font-size: 14px; font-weight: 700; margin: 10px 0 4px; color: #1E293B; }
      strong { font-weight: 700; }
      em { font-style: italic; }
      ul, ol { margin: 6px 0 6px 16px; padding: 0; }
      li { margin-bottom: 3px; }
      code {
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 12px; background: rgba(99,102,241,.08);
        color: #4338CA; padding: 1px 5px; border-radius: 4px;
      }
      pre {
        background: #1E293B; color: #E2E8F0; padding: 12px 14px;
        border-radius: 8px; overflow-x: auto; margin: 8px 0;
        code { background: none; color: inherit; padding: 0; font-size: 12px; }
      }
      hr { border: none; border-top: 1px solid #E2E8F0; margin: 10px 0; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
      th { background: #F1F5F9; font-weight: 700; padding: 6px 10px; border: 1px solid #E2E8F0; }
      td { padding: 5px 10px; border: 1px solid #E2E8F0; }
    }
    .message--user .msg-content code { background: rgba(255,255,255,.15); color: #e0e7ff; }

    /* Typing */
    .typing-indicator { display: flex; gap: 4px; align-items: center; padding: 4px 0; }
    .typing-indicator span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #94A3B8; animation: bounce 1.2s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: .2s; }
    .typing-indicator span:nth-child(3) { animation-delay: .4s; }
    @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }

    /* ── Input ────────────────────────────────────────────────────── */
    .ai-input-area { padding-top: 14px; border-top: 1px solid #F1F5F9; margin-top: 14px; }
    .ai-input {
      display: flex; align-items: flex-end; gap: 8px;
      background: white; border: 1.5px solid #E2E8F0; border-radius: 14px;
      padding: 10px 10px 10px 16px; transition: border-color .15s;
    }
    .ai-input--focused { border-color: #6366F1; }
    .ai-textarea {
      flex: 1; border: none; outline: none; resize: none;
      font-size: 14px; font-family: inherit; color: #1E293B;
      background: transparent; line-height: 1.5; max-height: 140px;
      &::placeholder { color: #94A3B8; }
    }
    .btn-send {
      display: flex; align-items: center; justify-content: center;
      width: 38px; height: 38px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #1e40af, #3730a3);
      color: white; cursor: pointer; flex-shrink: 0; transition: opacity .15s;
      mat-icon { font-size: 18px !important; width: 18px !important; height: 18px !important; }
      &:disabled { opacity: .35; cursor: default; }
      &:not(:disabled):hover { opacity: .85; }
    }
    .ai-input__hint {
      font-size: 11px; color: #CBD5E1; margin: 6px 0 0; text-align: center;
      kbd {
        display: inline-block; padding: 1px 5px; border-radius: 4px;
        border: 1px solid #E2E8F0; background: #F8FAFC;
        font-size: 10px; color: #94A3B8; font-family: inherit;
      }
    }
  `],
})
export class AiAssistantTabComponent implements OnInit, AfterViewChecked {
  @Input() clientId!: number;
  @Input() clientName = '';
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  private service = inject(AiAssistantService);

  messages: ChatMessage[] = [];
  inputText = '';
  loading = false;
  inputFocused = false;
  showContext = false;
  ctx: AiContextSummary | null = null;

  get contextCategories(): ContextCategory[] {
    if (!this.ctx) return [];
    return [
      {
        icon: 'business',
        label: 'Fiche identité',
        detail: this.ctx.ficheIdentite
          ? `${this.ctx.gerants} gérant(s) · ${this.ctx.salaries} salarié(s)`
          : 'Non renseignée',
        available: this.ctx.ficheIdentite,
      },
      {
        icon: 'trending_up',
        label: 'Performances financières',
        detail: this.ctx.performances
          ? `Exercice ${this.ctx.derniereAnnee ?? '—'}`
          : 'Aucune synthèse',
        available: this.ctx.performances,
      },
      {
        icon: 'analytics',
        label: 'Analyse stratégique',
        detail: this.ctx.analyseStrategique ? 'SWOT + BMC inclus' : 'Non renseignée',
        available: this.ctx.analyseStrategique,
      },
      {
        icon: 'task_alt',
        label: 'Missions',
        detail: this.ctx.missions > 0 ? `${this.ctx.missions} mission(s)` : 'Aucune mission',
        available: this.ctx.missions > 0,
      },
      {
        icon: 'flag',
        label: 'Objectifs client',
        detail: this.ctx.objectifs ? 'Court / moyen / long terme' : 'Non renseignés',
        available: this.ctx.objectifs,
      },
      {
        icon: 'security',
        label: 'Contrôle interne',
        detail: this.ctx.controleInterne ? 'Process et outils inclus' : 'Non renseigné',
        available: this.ctx.controleInterne,
      },
      {
        icon: 'local_shipping',
        label: 'Fournisseurs',
        detail: this.ctx.fournisseurs > 0 ? `${this.ctx.fournisseurs} fournisseur(s)` : 'Aucun',
        available: this.ctx.fournisseurs > 0,
      },
      {
        icon: 'receipt_long',
        label: 'Flux mensuels',
        detail: this.ctx.fluxMensuels > 0
          ? `${this.ctx.fluxMensuels} flux · ${this.ctx.fluxManquants} en retard`
          : 'Aucun flux',
        available: this.ctx.fluxMensuels > 0,
      },
    ];
  }

  suggestions = [
    { icon: 'summarize',      text: 'Résume-moi ce dossier pour une prise en charge rapide' },
    { icon: 'account_balance', text: 'Quels sont les points d\'attention fiscaux ?' },
    { icon: 'cancel',         text: 'Quelles missions ont été refusées et pourquoi ?' },
    { icon: 'handshake',      text: 'Quel est l\'état de la relation avec ce client ?' },
    { icon: 'local_shipping', text: 'Quels fournisseurs dois-je contacter en priorité ?' },
    { icon: 'warning',        text: 'Y a-t-il des risques identifiés sur ce dossier ?' },
  ];

  private shouldScroll = false;

  ngOnInit() {
    this.service.getHistory(this.clientId).subscribe(history => {
      this.messages = history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.contenu }));
      this.shouldScroll = true;
    });
    this.service.getContextSummary(this.clientId).subscribe(ctx => { this.ctx = ctx; });
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  onEnter(event: Event) {
    if (!(event as KeyboardEvent).shiftKey) { event.preventDefault(); this.send(); }
  }

  sendSuggestion(text: string) { this.inputText = text; this.send(); }

  async send() {
    const content = this.inputText.trim();
    if (!content || this.loading) return;
    this.inputText = '';
    this.loading = true;
    this.messages.push({ role: 'user', content });
    this.messages.push({ role: 'assistant', content: '' });
    this.shouldScroll = true;
    const assistantIndex = this.messages.length - 1;
    const toSend = this.messages.slice(0, -1).filter(m => m.content.trim()).slice(-10);
    await this.service.chatStream(
      this.clientId, toSend,
      chunk => { this.messages[assistantIndex].content += chunk; this.shouldScroll = true; },
      ()    => { this.loading = false; this.shouldScroll = true; },
      err   => { this.messages[assistantIndex].content = `⚠️ ${err}`; this.loading = false; },
    );
  }

  clearHistory() {
    this.service.clearHistory(this.clientId).subscribe(() => { this.messages = []; });
  }

  formatContent(text: string): string {
    if (!text) return '';

    // Sauvegarde les blocs de code pour ne pas les transformer
    const codeBlocks: string[] = [];
    text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
      const safe = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      codeBlocks.push(`<pre><code>${safe}</code></pre>`);
      return `\x00CODE${codeBlocks.length - 1}\x00`;
    });

    // Tableaux markdown
    text = text.replace(/((?:\|.+\|\n?)+)/g, match => {
      const rows = match.trim().split('\n').filter(r => !/^\|[-| :]+\|$/.test(r));
      if (rows.length === 0) return match;
      const toRow = (r: string, tag: string) =>
        '<tr>' + r.replace(/^\||\|$/g, '').split('|').map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
      const head = toRow(rows[0], 'th');
      const body = rows.slice(1).map(r => toRow(r, 'td')).join('');
      return `<table>${head}${body}</table>`;
    });

    // Code inline
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // Headers
    text = text.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // Séparateurs
    text = text.replace(/^[-*_]{3,}$/gm, '<hr>');
    // Gras + italique
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/\*([^\s*][^*]*[^\s*])\*/g, '<em>$1</em>');
    text = text.replace(/_([^\s_][^_]*[^\s_])_/g, '<em>$1</em>');

    // Listes (traitement ligne par ligne)
    const lines = text.split('\n');
    const out: string[] = [];
    let inList = false;
    for (const line of lines) {
      const listMatch = line.match(/^[-•*]\s+(.+)$/);
      if (listMatch) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${listMatch[1]}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(line);
      }
    }
    if (inList) out.push('</ul>');
    text = out.join('\n');

    // Paragraphes (double saut de ligne)
    const blocks = text.split(/\n\n+/);
    text = blocks.map(b => {
      b = b.trim();
      if (!b) return '';
      if (/^<(h[2-4]|ul|pre|table|hr)/.test(b)) return b;
      return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
    }).join('');

    // Restaure les blocs de code
    text = text.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]);
    return text;
  }

  private scrollToBottom() {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
