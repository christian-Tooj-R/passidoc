import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotesService, Note } from '../../core/services/notes.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { debounceTime, Subject } from 'rxjs';

const PALETTE = [
  { bg: '#FFFDE7', border: '#F9A825', dot: '#F9A825' },
  { bg: '#E8F5E9', border: '#43A047', dot: '#43A047' },
  { bg: '#E3F2FD', border: '#1E88E5', dot: '#1E88E5' },
  { bg: '#FCE4EC', border: '#E91E63', dot: '#E91E63' },
  { bg: '#F3E5F5', border: '#8E24AA', dot: '#8E24AA' },
  { bg: '#FBE9E7', border: '#F4511E', dot: '#F4511E' },
];

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="notes-page">

      <!-- ── Header ── -->
      <div class="page-header">
        <div class="page-header__left">
          <div class="page-header__icon">
            <mat-icon>sticky_note_2</mat-icon>
          </div>
          <div>
            <h1>Mes Notes</h1>
            <span class="page-header__sub">{{ notes().length }} note{{ notes().length !== 1 ? 's' : '' }}</span>
          </div>
        </div>
        <button class="btn-add" (click)="addNote()" [disabled]="saving()">
          <mat-icon>add</mat-icon>
          Nouvelle note
        </button>
      </div>

      <!-- ── Loading ── -->
      @if (loading()) {
        <div class="skeleton-grid">
          @for (_ of [1,2,3,4]; track $index) {
            <div class="skeleton-card">
              <div class="sk-line sk-line--short"></div>
              <div class="sk-line"></div>
              <div class="sk-line"></div>
              <div class="sk-line sk-line--med"></div>
            </div>
          }
        </div>
      }

      <!-- ── Empty state ── -->
      @if (!loading() && notes().length === 0) {
        <div class="empty-state">
          <div class="empty-state__icon">
            <mat-icon>edit_note</mat-icon>
          </div>
          <h2>Aucune note pour l'instant</h2>
          <p>Créez votre première note pour garder vos idées et mémos à portée de main.</p>
          <button class="btn-add" (click)="addNote()">
            <mat-icon>add</mat-icon> Commencer
          </button>
        </div>
      }

      <!-- ── Notes grid ── -->
      @if (!loading() && notes().length > 0) {
        @if (pinnedNotes().length > 0) {
          <div class="section-label">
            <mat-icon>push_pin</mat-icon> Épinglées
          </div>
          <div class="notes-grid">
            @for (note of pinnedNotes(); track note.id) {
              <div class="note-card" [style.background]="getPalette(note.color).bg"
                   [style.border-color]="getPalette(note.color).border">
                <ng-container *ngTemplateOutlet="noteCard; context: { note: note }"></ng-container>
              </div>
            }
          </div>
        }

        @if (otherNotes().length > 0) {
          @if (pinnedNotes().length > 0) {
            <div class="section-label">
              <mat-icon>notes</mat-icon> Autres
            </div>
          }
          <div class="notes-grid">
            @for (note of otherNotes(); track note.id) {
              <div class="note-card" [style.background]="getPalette(note.color).bg"
                   [style.border-color]="getPalette(note.color).border">
                <ng-container *ngTemplateOutlet="noteCard; context: { note: note }"></ng-container>
              </div>
            }
          </div>
        }
      }
    </div>

    <!-- ── Note card template ── -->
    <ng-template #noteCard let-note="note">
      <div class="note-topbar">
        <div class="color-dots">
          @for (p of palette; track $index) {
            <button class="color-dot"
                    [style.background]="p.dot"
                    [class.selected]="note.color === $index.toString()"
                    (click)="setColor(note, $index.toString())"
                    matTooltip="Changer la couleur"></button>
          }
        </div>
        <div class="note-actions">
          <button mat-icon-button class="action-btn"
                  [matTooltip]="note.pinned ? 'Désépingler' : 'Épingler'"
                  (click)="togglePin(note)">
            <mat-icon [class.pinned]="note.pinned">push_pin</mat-icon>
          </button>
          <button mat-icon-button class="action-btn delete-btn"
                  matTooltip="Supprimer"
                  (click)="deleteNote(note.id)">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      </div>

      <input class="note-title"
             [(ngModel)]="note.title"
             (ngModelChange)="scheduleUpdate(note)"
             placeholder="Titre..."
             [style.border-bottom-color]="getPalette(note.color).border + '55'" />

      <textarea class="note-body"
                [(ngModel)]="note.content"
                (ngModelChange)="scheduleUpdate(note)"
                placeholder="Écris ici..."></textarea>

      <div class="note-footer">
        <span>{{ note.createdAt | date:'dd MMM yyyy' }}</span>
        <span class="note-chars">{{ note.content.length }} car.</span>
      </div>
    </ng-template>
  `,
  styles: [`
    .notes-page {
      padding: 32px 36px;
      min-height: 100%;
    }

    /* ── Header ──────────────────────────────────── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 32px;
    }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-header__icon {
      width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
      background: linear-gradient(135deg, #F59E0B, #FBBF24);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(245,158,11,.30);
    }
    .page-header__icon mat-icon { color: #fff; font-size: 24px; width: 24px; height: 24px; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
    .page-header__sub { font-size: 13px; color: #94a3b8; }

    .btn-add {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 20px; border-radius: 24px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #F59E0B, #FBBF24);
      color: white; font-size: 14px; font-weight: 600;
      box-shadow: 0 3px 10px rgba(245,158,11,.35);
      transition: transform .15s, box-shadow .15s;
    }
    .btn-add:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(245,158,11,.45); }
    .btn-add:disabled { opacity: .6; cursor: default; }
    .btn-add mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ── Skeleton ─────────────────────────────────── */
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 20px; margin-bottom: 32px;
    }
    .skeleton-card {
      border-radius: 16px; border: 1.5px solid #e2e8f0;
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
      min-height: 200px; background: white;
    }
    .sk-line {
      height: 12px; border-radius: 6px; background: #e2e8f0;
      animation: shimmer 1.4s infinite;
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
      background-size: 200% 100%;
    }
    .sk-line--short { width: 50%; }
    .sk-line--med   { width: 70%; }
    @keyframes shimmer { to { background-position: -200% 0; } }

    /* ── Section labels ───────────────────────────── */
    .section-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 700; color: #64748b;
      text-transform: uppercase; letter-spacing: .8px;
      margin: 0 0 12px;
    }
    .section-label mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* ── Grid ─────────────────────────────────────── */
    .notes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 20px; margin-bottom: 32px;
    }

    /* ── Card ─────────────────────────────────────── */
    .note-card {
      border-radius: 16px; border: 1.5px solid transparent;
      padding: 16px; display: flex; flex-direction: column; gap: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
      transition: box-shadow .18s, transform .18s;
      min-height: 200px;
    }
    .note-card:hover {
      box-shadow: 0 6px 20px rgba(0,0,0,.10);
      transform: translateY(-2px);
    }

    .note-topbar { display: flex; align-items: center; justify-content: space-between; }
    .color-dots { display: flex; gap: 5px; align-items: center; }
    .color-dot {
      width: 13px; height: 13px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; transition: transform .12s, border-color .12s; padding: 0;
    }
    .color-dot:hover { transform: scale(1.25); }
    .color-dot.selected { border-color: rgba(0,0,0,.35); transform: scale(1.15); }

    .note-actions { display: flex; gap: 2px; }
    .action-btn { width: 28px !important; height: 28px !important; color: #94a3b8 !important; }
    .action-btn mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .action-btn:hover { color: #475569 !important; }
    .action-btn mat-icon.pinned { color: #F59E0B !important; }
    .delete-btn:hover { color: #ef4444 !important; }

    .note-title {
      font-size: 15px; font-weight: 700; color: #1e293b;
      border: none; background: transparent; width: 100%;
      border-bottom: 1.5px solid transparent;
      padding: 4px 0; font-family: inherit;
      transition: border-color .15s;
    }
    .note-title:focus { outline: none; border-bottom-color: currentColor; }
    .note-title::placeholder { color: #94a3b8; font-weight: 400; }

    .note-body {
      flex: 1; min-height: 100px; resize: none;
      border: none; background: transparent; width: 100%;
      font-size: 13.5px; color: #334155; line-height: 1.7;
      font-family: inherit; padding: 0;
    }
    .note-body:focus { outline: none; }
    .note-body::placeholder { color: #94a3b8; }

    .note-footer {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 11px; color: #94a3b8; padding-top: 8px;
      border-top: 1px solid rgba(0,0,0,.06);
    }
    .note-chars { font-weight: 600; }

    /* ── Empty state ──────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px 0; text-align: center; gap: 16px;
    }
    .empty-state__icon {
      width: 72px; height: 72px; border-radius: 20px;
      background: linear-gradient(135deg, #FEF3C7, #FDE68A);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(245,158,11,.20);
    }
    .empty-state__icon mat-icon { font-size: 36px; width: 36px; height: 36px; color: #F59E0B; }
    .empty-state h2 { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }
    .empty-state p { font-size: 14px; color: #64748b; max-width: 340px; margin: 0; line-height: 1.6; }
  `],
})
export class NotesComponent implements OnInit {
  notes = signal<Note[]>([]);
  loading = signal(true);
  saving = signal(false);
  palette = PALETTE;

  private updateSubjects = new Map<number, Subject<Note>>();
  private confirm = inject(ConfirmService);

  constructor(private service: NotesService) {}

  ngOnInit() {
    this.service.getAll().subscribe({
      next: (notes) => { this.notes.set(notes); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  pinnedNotes() { return this.notes().filter(n => n.pinned); }
  otherNotes()  { return this.notes().filter(n => !n.pinned); }

  getPalette(colorIdx: string) {
    return PALETTE[parseInt(colorIdx, 10) % PALETTE.length] ?? PALETTE[0];
  }

  addNote() {
    const colorIdx = (this.notes().length % PALETTE.length).toString();
    this.saving.set(true);
    this.service.create({ title: '', content: '', color: colorIdx, pinned: false }).subscribe(note => {
      this.notes.update(n => [note, ...n]);
      this.saving.set(false);
    });
  }

  deleteNote(id: number) {
    this.confirm.confirm('Supprimer cette note ?').subscribe((ok: boolean) => {
      if (!ok) return;
      this.service.delete(id).subscribe(() => {
        this.notes.update(n => n.filter(x => x.id !== id));
      });
    });
  }

  togglePin(note: Note) {
    note.pinned = !note.pinned;
    this.notes.update(n => [...n]);
    this.service.update(note.id, { pinned: note.pinned }).subscribe();
  }

  setColor(note: Note, idx: string) {
    note.color = idx;
    this.notes.update(n => [...n]);
    this.service.update(note.id, { color: idx }).subscribe();
  }

  scheduleUpdate(note: Note) {
    if (!this.updateSubjects.has(note.id)) {
      const subject = new Subject<Note>();
      subject.pipe(debounceTime(800)).subscribe(n => {
        this.service.update(n.id, { title: n.title, content: n.content }).subscribe();
      });
      this.updateSubjects.set(note.id, subject);
    }
    this.updateSubjects.get(note.id)!.next(note);
  }
}
