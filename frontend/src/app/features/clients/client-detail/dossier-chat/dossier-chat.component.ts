import {
  Component, Input, OnInit, OnDestroy, signal, inject,
  ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, interval, takeUntil } from 'rxjs';
import { DossierMessagesService, DossierMessage } from '../../../../core/services/dossier-messages.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-dossier-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
<div class="chat-wrap" [class.chat-wrap--open]="open()">

  <!-- ── Barre de titre (toujours visible) ── -->
  <button class="chat-bar" (click)="togglePanel()">
    <mat-icon class="chat-bar__icon">forum</mat-icon>
    <span class="chat-bar__label">Fil de discussion</span>
    @if (unread() > 0) {
      <span class="chat-bar__badge">{{ unread() }}</span>
    }
    <mat-icon class="chat-bar__chevron">{{ open() ? 'expand_more' : 'expand_less' }}</mat-icon>
  </button>

  <!-- ── Panneau messages ── -->
  @if (open()) {
    <div class="chat-panel">

      <div class="chat-body" #scrollEl>
        @if (messages().length === 0) {
          <div class="chat-empty">
            <mat-icon>chat_bubble_outline</mat-icon>
            <p>Aucun message pour l'instant.<br>Démarrez la discussion !</p>
          </div>
        }
        @for (msg of messages(); track msg.id) {
          <div class="msg" [class.msg--me]="msg.userId === currentUserId">
            <div class="msg__bubble-wrap">
              <div class="msg__name">{{ msg.user?.firstName }} {{ msg.user?.lastName }}</div>
              <div class="msg__bubble">{{ msg.contenu }}</div>
              <div class="msg__time">{{ msg.createdAt | date:'dd/MM HH:mm' }}</div>
            </div>
            @if (msg.userId === currentUserId) {
              <button class="msg__del" (click)="deleteMsg(msg)" title="Supprimer">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
        }
      </div>

      <form class="chat-input" (ngSubmit)="send()">
        <input class="chat-input__field"
               [(ngModel)]="draft"
               name="draft"
               placeholder="Écrire un message…"
               autocomplete="off"
               [disabled]="sending()">
        <button type="submit" class="chat-input__btn" [disabled]="!draft.trim() || sending()">
          <mat-icon>send</mat-icon>
        </button>
      </form>

    </div>
  }

</div>
  `,
  styles: [`
    .chat-wrap {
      position: sticky; bottom: 0; z-index: 100;
      border-top: 1px solid #E8E4F4;
      background: white;
      box-shadow: 0 -2px 12px rgba(109,40,217,.08);
    }

    /* ── Barre titre ── */
    .chat-bar {
      display: flex; align-items: center; gap: 8px;
      width: 100%; padding: 10px 16px;
      background: none; border: none; cursor: pointer;
      color: #5B21B6; font-weight: 600; font-size: 13px;
      transition: background .12s;
    }
    .chat-bar:hover { background: #F5F3FF; }
    .chat-bar__icon { font-size: 18px; width: 18px; height: 18px; }
    .chat-bar__label { flex: 1; text-align: left; }
    .chat-bar__badge {
      background: #7C3AED; color: white;
      font-size: 10px; font-weight: 700;
      padding: 1px 6px; border-radius: 10px;
    }
    .chat-bar__chevron { font-size: 18px; width: 18px; height: 18px; color: #94A3B8; }

    /* ── Panneau ── */
    .chat-panel {
      display: flex; flex-direction: column;
      height: 420px;
      border-top: 1px solid #EDE9F8;
    }

    /* ── Corps messages ── */
    .chat-body {
      flex: 1; overflow-y: auto;
      padding: 12px 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .chat-empty {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100%; gap: 8px;
      color: #CBD5E1; text-align: center; font-size: 13px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; }
    }

    /* ── Message ── */
    .msg {
      display: flex; align-items: flex-end; gap: 8px;
      max-width: 80%;
    }
    .msg--me {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    .msg__bubble-wrap { display: flex; flex-direction: column; gap: 2px; }
    .msg__name { font-size: 11px; font-weight: 600; color: #64748B; padding-left: 4px; }
    .msg--me .msg__name { text-align: right; padding-left: 0; padding-right: 4px; }
    .msg__bubble {
      background: #F1F0FB; color: #1E293B;
      padding: 7px 11px; border-radius: 14px 14px 14px 4px;
      font-size: 13px; line-height: 1.45; word-break: break-word;
    }
    .msg--me .msg__bubble {
      background: linear-gradient(135deg, #7C3AED, #6D28D9);
      color: white;
      border-radius: 14px 14px 4px 14px;
    }
    .msg__time { font-size: 10px; color: #CBD5E1; padding-left: 2px; }
    .msg--me .msg__time { text-align: right; padding-right: 2px; }
    .msg__del {
      background: none; border: none; cursor: pointer;
      color: #CBD5E1; padding: 2px;
      opacity: 0; transition: opacity .15s;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .msg:hover .msg__del { opacity: 1; }

    /* ── Input ── */
    .chat-input {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px;
      border-top: 1px solid #EDE9F8;
    }
    .chat-input__field {
      flex: 1; padding: 8px 12px;
      border: 1.5px solid #E2E8F0; border-radius: 20px;
      font-size: 13px; outline: none;
      transition: border-color .15s;
      background: #FAFAFA;
    }
    .chat-input__field:focus { border-color: #7C3AED; background: white; }
    .chat-input__btn {
      width: 34px; height: 34px; border-radius: 50%;
      background: #7C3AED; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: white; transition: background .12s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .chat-input__btn:hover:not(:disabled) { background: #6D28D9; }
    .chat-input__btn:disabled { background: #E2E8F0; cursor: default; }

    @media (prefers-color-scheme: dark) {
      .chat-wrap { background: #1e1b2e; border-color: #2d2448; }
      .chat-bar { color: #a78bfa; }
      .chat-bar:hover { background: #2d2448; }
      .msg__bubble { background: #2d2448; color: #e2e8f0; }
      .chat-input__field { background: #2d2448; border-color: #3d3060; color: #e2e8f0; }
      .chat-input__field:focus { border-color: #7c3aed; }
    }
    :root[data-theme="dark"] .chat-wrap { background: #1e1b2e; border-color: #2d2448; }
    :root[data-theme="dark"] .chat-bar { color: #a78bfa; }
    :root[data-theme="dark"] .msg__bubble { background: #2d2448; color: #e2e8f0; }
    :root[data-theme="dark"] .chat-input__field { background: #2d2448; border-color: #3d3060; color: #e2e8f0; }
  `],
})
export class DossierChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input({ required: true }) clientId!: number;
  @ViewChild('scrollEl') scrollEl!: ElementRef<HTMLElement>;

  private svc    = inject(DossierMessagesService);
  private auth   = inject(AuthService);
  private cdr    = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  open     = signal(false);
  messages = signal<DossierMessage[]>([]);
  unread   = signal(0);
  sending  = signal(false);
  draft    = '';
  currentUserId!: number;
  private lastCount = 0;
  private shouldScroll = false;

  ngOnInit() {
    const u = this.auth.currentUser();
    this.currentUserId = u?.id ?? 0;
    this.load();
    // Polling toutes les 15s
    interval(15000).pipe(takeUntil(this.destroy$)).subscribe(() => this.load());
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  ngAfterViewChecked() {
    if (this.shouldScroll && this.scrollEl) {
      this.scrollEl.nativeElement.scrollTop = this.scrollEl.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  load() {
    this.svc.getAll(this.clientId).subscribe(msgs => {
      const prev = this.lastCount;
      this.messages.set(msgs);
      this.lastCount = msgs.length;
      if (msgs.length > prev && !this.open()) {
        this.unread.set(this.unread() + (msgs.length - prev));
      }
      if (msgs.length > prev) this.shouldScroll = true;
      this.cdr.markForCheck();
    });
  }

  send() {
    const txt = this.draft.trim();
    if (!txt) return;
    this.sending.set(true);
    this.svc.send(this.clientId, txt).subscribe({
      next: msg => {
        this.messages.update(m => [...m, msg]);
        this.draft = '';
        this.sending.set(false);
        this.shouldScroll = true;
      },
      error: () => this.sending.set(false),
    });
  }

  deleteMsg(msg: DossierMessage) {
    this.svc.delete(this.clientId, msg.id).subscribe(() => {
      this.messages.update(m => m.filter(x => x.id !== msg.id));
    });
  }

  togglePanel() {
    const opening = !this.open();
    this.open.set(opening);
    if (opening) {
      this.unread.set(0);
      this.shouldScroll = true;
    }
  }

  openPanel() {
    this.open.set(true);
    this.unread.set(0);
    this.shouldScroll = true;
  }

  initials(msg: DossierMessage): string {
    const u = msg.user;
    if (!u) return '?';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  }
}
