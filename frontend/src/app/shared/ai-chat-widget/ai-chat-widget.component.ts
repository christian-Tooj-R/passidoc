import {
  Component, OnInit, OnDestroy, inject,
  signal, computed, ViewChild, ElementRef, AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, Subscription } from 'rxjs';
import { AiAssistantService, ChatMessage } from '../../core/services/ai-assistant.service';
import { AuthService } from '../../core/services/auth.service';
import { ClientsService } from '../../core/services/clients.service';

@Component({
  selector: 'app-ai-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  template: `
@if (checkLoggedIn() && clientId() && !isFullscreen()) {

  <!-- ── FAB ──────────────────────────────────────────────────────── -->
  <button class="fab"
          [class.fab--active]="!!clientId()"
          [class.fab--open]="isOpen()"
          (click)="togglePanel()"
          [matTooltip]="fabTooltip"
          matTooltipPosition="left">
    <mat-icon class="fab-icon">{{ isOpen() ? 'close' : 'smart_toy' }}</mat-icon>
    @if (!isOpen() && unread() > 0) {
      <span class="fab-badge">{{ unread() }}</span>
    }
  </button>

  <!-- ── Panel ─────────────────────────────────────────────────────── -->
  @if (isOpen()) {
    <div class="chat-panel" (click)="$event.stopPropagation()">

      <!-- Header -->
      <div class="panel-header">
        <div class="panel-header__ai">
          <div class="panel-avatar">
            <mat-icon>smart_toy</mat-icon>
            <span class="panel-avatar__dot"></span>
          </div>
          <div class="panel-header__info">
            <div class="panel-title">Assistant IA</div>
            <div class="panel-subtitle">
              @if (clientId()) { Dossier : <strong>{{ clientName() }}</strong> }
              @else { Aucun dossier sélectionné }
            </div>
          </div>
        </div>
        @if (clientId()) {
          <button class="panel-expand"
                  (click)="openFullscreen()"
                  matTooltip="Plein écran"
                  matTooltipPosition="below">
            <mat-icon>open_in_full</mat-icon>
          </button>
        }
        <button class="panel-close" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Corps : chat actif -->
      @if (clientId()) {

        <!-- Messages -->
        <div class="panel-messages" #messagesContainer>
          @if (messages().length === 0 && !loading()) {
            <div class="panel-suggestions">
              @for (s of suggestions; track s.text) {
                <button class="sugg-chip" (click)="sendSuggestion(s.text)">
                  <mat-icon>{{ s.icon }}</mat-icon>{{ s.text }}
                </button>
              }
            </div>
          }

          @for (msg of messages(); track $index) {
            <div class="msg" [class.msg--user]="msg.role === 'user'" [class.msg--ai]="msg.role === 'assistant'">
              @if (msg.role === 'assistant') {
                <div class="msg-av msg-av--ai"><mat-icon>smart_toy</mat-icon></div>
              }
              <div class="msg-bubble" [innerHTML]="formatContent(msg.content)"></div>
              @if (msg.role === 'user') {
                <div class="msg-av msg-av--user"><mat-icon>person</mat-icon></div>
              }
            </div>
          }

          @if (loading()) {
            <div class="msg msg--ai">
              <div class="msg-av msg-av--ai"><mat-icon>smart_toy</mat-icon></div>
              <div class="msg-bubble">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              </div>
            </div>
          }
        </div>

        <!-- Input -->
        <div class="panel-input" [class.panel-input--focused]="inputFocused()">
          <textarea
            [(ngModel)]="inputText"
            placeholder="Votre question…"
            rows="1"
            class="panel-textarea"
            (keydown.enter)="onEnter($event)"
            (focus)="inputFocused.set(true)"
            (blur)="inputFocused.set(false)"
            [disabled]="loading()"
            #inputArea>
          </textarea>
          <button class="panel-send"
                  [disabled]="!inputText.trim() || loading()"
                  (click)="send()">
            <mat-icon>{{ loading() ? 'hourglass_empty' : 'send' }}</mat-icon>
          </button>
        </div>
      }

    </div>
  }

}
  `,
  styles: [`
    /* ── FAB ─────────────────────────────────────────────────────── */
    .fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 1000;
      width: 56px; height: 56px; border-radius: 50%; border: none;
      background: #94A3B8; color: white; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,.2);
      transition: all .25s cubic-bezier(.34,1.56,.64,1);
    }
    .fab--active {
      background: linear-gradient(135deg, #1e40af, #4338ca);
      box-shadow: 0 4px 24px rgba(67,56,202,.4);
    }
    .fab:hover { transform: scale(1.08); }
    .fab--open { transform: scale(1) rotate(0deg); background: #475569; box-shadow: 0 4px 14px rgba(0,0,0,.25); }

    .fab-icon { font-size: 24px !important; width: 24px !important; height: 24px !important; }

    .fab-badge {
      position: absolute; top: 4px; right: 4px;
      background: #EF4444; color: white; border-radius: 50%;
      min-width: 18px; height: 18px; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid white; padding: 0 3px;
    }

    /* ── Panel ────────────────────────────────────────────────────── */
    .chat-panel {
      position: fixed; bottom: 92px; right: 24px; z-index: 999;
      width: 360px; height: 500px;
      background: white; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      display: flex; flex-direction: column; overflow: hidden;
      animation: slideUp .2s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(.96); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }

    /* Header */
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; gap: 10px;
      background: linear-gradient(135deg, #1e40af, #4338ca);
      color: white; flex-shrink: 0;
    }
    .panel-header__ai { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .panel-avatar {
      position: relative; width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,.18);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 20px !important; width: 20px !important; height: 20px !important; color: white; }
    }
    .panel-avatar__dot {
      position: absolute; bottom: 1px; right: 1px;
      width: 9px; height: 9px; border-radius: 50%;
      background: #22C55E; border: 2px solid #1e40af;
    }
    .panel-header__info { min-width: 0; }
    .panel-title   { font-size: 14px; font-weight: 700; }
    .panel-subtitle { font-size: 11px; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      strong { opacity: 1; font-weight: 700; } }
    .panel-expand, .panel-close {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 8px; border: none;
      background: rgba(255,255,255,.15); color: white; cursor: pointer; flex-shrink: 0;
      mat-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; }
      &:hover { background: rgba(255,255,255,.28); }
    }


    /* Suggestions */
    .panel-suggestions {
      display: flex; flex-direction: column; gap: 6px; padding: 12px 12px 0;
    }
    .sugg-chip {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border: 1px solid #E2E8F0; border-radius: 10px;
      background: white; color: #475569; font-size: 12px; cursor: pointer;
      font-family: inherit; text-align: left; transition: all .15s;
      mat-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; color: #94A3B8; flex-shrink: 0; }
      &:hover { border-color: #6366F1; color: #4338CA; background: #F0F4FF;
        mat-icon { color: #6366F1; } }
    }

    /* Messages */
    .panel-messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 12px;
      scroll-behavior: smooth;
    }
    .msg { display: flex; align-items: flex-end; gap: 7px; }
    .msg--user { flex-direction: row-reverse; }

    .msg-av {
      width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }
    }
    .msg-av--ai   { background: linear-gradient(135deg,#e0e7ff,#c7d2fe); mat-icon { color: #4338CA; } }
    .msg-av--user { background: linear-gradient(135deg,#1e40af,#3730a3); mat-icon { color: white; } }

    .msg-bubble {
      max-width: 78%; padding: 9px 12px; border-radius: 12px;
      font-size: 13px; line-height: 1.6; color: #1E293B;
    }
    .msg--ai   .msg-bubble { background: #F1F5F9; border-bottom-left-radius: 4px; }
    .msg--user .msg-bubble { background: linear-gradient(135deg,#1e40af,#3730a3); color: white; border-bottom-right-radius: 4px; }

    /* Markdown minimal */
    .msg-bubble {
      p      { margin: 0 0 6px; &:last-child { margin: 0; } }
      strong { font-weight: 700; }
      em     { font-style: italic; }
      ul     { margin: 4px 0 4px 14px; padding: 0; }
      li     { margin-bottom: 2px; }
      code   { font-size: 11px; background: rgba(99,102,241,.1); color: #4338CA; padding: 1px 4px; border-radius: 3px; }
      h2,h3,h4 { font-size: 13px; font-weight: 700; margin: 6px 0 2px; }
    }
    .msg--user .msg-bubble code { background: rgba(255,255,255,.15); color: #e0e7ff; }

    /* Typing dots */
    .dot {
      display: inline-block; width: 6px; height: 6px; border-radius: 50%;
      background: #94A3B8; margin: 0 2px;
      animation: bounce 1.2s infinite;
      &:nth-child(2) { animation-delay: .2s; }
      &:nth-child(3) { animation-delay: .4s; }
    }
    @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }

    /* Input */
    .panel-input {
      display: flex; align-items: flex-end; gap: 6px;
      padding: 10px 12px; border-top: 1px solid #F1F5F9;
      background: white; flex-shrink: 0;
      border-radius: 0 0 16px 16px;
    }
    .panel-textarea {
      flex: 1; border: 1.5px solid #E2E8F0; border-radius: 10px;
      padding: 8px 12px; font-size: 13px; font-family: inherit;
      color: #1E293B; resize: none; outline: none;
      max-height: 80px; line-height: 1.4; background: #F8FAFC;
      transition: border-color .15s;
      &::placeholder { color: #94A3B8; }
      &:focus { border-color: #6366F1; background: white; }
    }
    .panel-input--focused .panel-textarea { border-color: #6366F1; background: white; }
    .panel-send {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 9px; border: none; flex-shrink: 0;
      background: linear-gradient(135deg,#1e40af,#3730a3); color: white; cursor: pointer;
      transition: opacity .15s;
      mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
      &:disabled { opacity: .35; cursor: default; }
      &:not(:disabled):hover { opacity: .85; }
    }
  `],
})
export class AiChatWidgetComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  private router      = inject(Router);
  private aiService   = inject(AiAssistantService);
  private authService = inject(AuthService);
  private clientsSvc  = inject(ClientsService);
  private sub         = new Subscription();

  isOpen       = signal(false);
  isFullscreen = signal(false);
  clientId     = signal<number | null>(null);
  clientName  = signal('');
  messages    = signal<ChatMessage[]>([]);
  loading     = signal(false);
  inputFocused = signal(false);
  unread      = signal(0);
  inputText   = '';

  private shouldScroll = false;
  private loadedClientId: number | null = null;

  checkLoggedIn() { return this.authService.isLoggedIn(); }
  get fabTooltip() {
    return `Assistant IA — ${this.clientName()}`;
  }

  suggestions = [
    { icon: 'summarize',      text: 'Résume ce dossier rapidement' },
    { icon: 'warning',        text: 'Quels sont les risques identifiés ?' },
    { icon: 'account_balance', text: 'Points d\'attention fiscaux ?' },
    { icon: 'handshake',      text: 'État de la relation client ?' },
  ];

  ngOnInit() {
    this.extractClientFromUrl(this.router.url);
    this.sub.add(
      this.router.events
        .pipe(filter(e => e instanceof NavigationEnd))
        .subscribe((e: any) => this.extractClientFromUrl(e.urlAfterRedirects)),
    );
  }

  ngOnDestroy() { this.sub.unsubscribe(); }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  private extractClientFromUrl(url: string) {
    this.isFullscreen.set(/\/clients\/\d+\/ai$/.test(url));
    const match = url.match(/\/clients\/(\d+)/);
    const newId = match ? +match[1] : null;
    if (newId === this.clientId()) return;
    this.clientId.set(newId);
    if (newId && newId !== this.loadedClientId) {
      this.messages.set([]);
      this.loadedClientId = newId;
      this.clientsSvc.getOne(newId).subscribe(c => this.clientName.set(c.nom));
      this.aiService.getHistory(newId).subscribe(h => {
        this.messages.set(h.map(m => ({ role: m.role as 'user' | 'assistant', content: m.contenu })));
        this.shouldScroll = true;
      });
    }
  }

  togglePanel() { this.isOpen.update(v => !v); if (this.isOpen()) { this.unread.set(0); this.shouldScroll = true; } }
  close() { this.isOpen.set(false); }
  openFullscreen() { this.close(); this.router.navigate(['/clients', this.clientId(), 'ai']); }

  onEnter(e: Event) {
    if (!(e as KeyboardEvent).shiftKey) { e.preventDefault(); this.send(); }
  }

  sendSuggestion(text: string) { this.inputText = text; this.send(); }

  async send() {
    const content = this.inputText.trim();
    if (!content || this.loading() || !this.clientId()) return;
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
      this.clientId()!, toSend,
      chunk => {
        const updated = [...this.messages()];
        updated[idx] = { ...updated[idx], content: updated[idx].content + chunk };
        this.messages.set(updated);
        this.shouldScroll = true;
        if (!this.isOpen()) this.unread.update(n => n + 1);
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
