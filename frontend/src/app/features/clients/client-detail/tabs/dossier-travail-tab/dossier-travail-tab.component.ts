import { Component, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  DossierTravailService,
  DossierTravail,
  CycleRevision,
  TypeCycle,
} from '../../../../../core/services/dossier-travail.service';
import { AiAssistantService } from '../../../../../core/services/ai-assistant.service';
import { ToastService } from '../../../../../core/services/toast.service';

interface CycleUI {
  type: TypeCycle;
  label: string;
  icon: string;
  color: string;
  data: CycleRevision | null;
  saving: boolean;
}

@Component({
  selector: 'app-dossier-travail-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule,
  ],
  template: `
<div class="dt-tab">

  <!-- En-tête -->
  <div class="dt-header">
    <div class="dt-header__left">
      <mat-icon class="dt-header__icon">work_history</mat-icon>
      <div>
        <h2 class="dt-header__title">Dossier de travail</h2>
        <p class="dt-header__sub">Révision par cycle — exercice {{ exerciceId }}</p>
      </div>
    </div>
    <div class="dt-header__actions">
      <button mat-stroked-button class="dt-copy-btn" (click)="copyContent()" matTooltip="Copier tout le contenu">
        <mat-icon>content_copy</mat-icon> Copier
      </button>
      @if (readonly) {
        <span class="dt-badge dt-badge--readonly"><mat-icon>lock</mat-icon> Lecture seule</span>
      }
    </div>
  </div>

  @if (loading) {
    <div class="dt-loading">
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    </div>
  } @else if (dossier) {

    <!-- Note de synthèse -->
    <section class="dt-section dt-section--synthese">
      <div class="dt-section__head">
        <mat-icon>summarize</mat-icon>
        <h3>Note de synthèse</h3>
        @if (!readonly) {
          <button mat-flat-button color="primary" class="dt-save-btn" (click)="saveNote()" [disabled]="savingNote">
            <mat-icon>save</mat-icon> {{ savingNote ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        }
      </div>
      <p class="dt-section__hint">
        Ce texte est automatiquement copié depuis l'exercice précédent lors de la clôture.
        Vous pouvez le modifier pour l'exercice en cours.
      </p>
      <textarea
        class="dt-textarea dt-textarea--synthese"
        [(ngModel)]="dossier.noteSynthese"
        placeholder="Note de synthèse globale du dossier de travail..."
        [readonly]="readonly"
        rows="6">
      </textarea>
    </section>

    <!-- Cycles : navigation latérale -->
    <div class="dt-cycles-layout">

      <!-- Sidebar -->
      <nav class="dt-cycles-nav">
        @for (cycle of cycles; track cycle.type) {
          <button class="dt-nav-item" [class.dt-nav-item--active]="selectedCycleType === cycle.type"
            [style.--nav-color]="cycle.color" (click)="selectedCycleType = cycle.type">
            <div class="dt-nav-item__top">
              <span class="dt-nav-letter" [style.color]="selectedCycleType === cycle.type ? '#fff' : cycle.color"
                [style.background]="selectedCycleType === cycle.type ? cycle.color : 'transparent'">
                {{ cycle.type }}
              </span>
              <span class="dt-nav-name">{{ cycleShortLabel(cycle) }}</span>
              <span class="dt-nav-pct"
                [class.dt-nav-pct--low]="(cycle.data?.pourcentageCouverture ?? 0) < 50"
                [class.dt-nav-pct--mid]="(cycle.data?.pourcentageCouverture ?? 0) >= 50 && (cycle.data?.pourcentageCouverture ?? 0) < 80"
                [class.dt-nav-pct--ok]="(cycle.data?.pourcentageCouverture ?? 0) >= 80">
                {{ cycle.data?.pourcentageCouverture ?? 0 }}%
              </span>
            </div>
            <div class="dt-nav-bar">
              <div class="dt-nav-bar__fill"
                [style.width.%]="cycle.data?.pourcentageCouverture ?? 0"
                [style.background]="cycle.color"></div>
            </div>
          </button>
        }
      </nav>

      <!-- Contenu du cycle sélectionné -->
      @if (selectedCycle) {
        <div class="dt-cycle-content" [style.--cycle-color]="selectedCycle.color">

          <div class="dt-cycle__header">
            <div class="dt-cycle__title-row">
              <mat-icon [style.color]="selectedCycle.color">{{ selectedCycle.icon }}</mat-icon>
              <h3 class="dt-cycle__title">{{ selectedCycle.label }}</h3>
            </div>
            <div class="dt-cycle__actions">
              @if (!readonly) {
                <button mat-flat-button class="dt-save-btn" [style.background]="selectedCycle.color"
                  (click)="saveCycle(selectedCycle)" [disabled]="selectedCycle.saving">
                  <mat-icon>save</mat-icon> {{ selectedCycle.saving ? 'Enregistrement...' : 'Enregistrer' }}
                </button>
              }
              <button mat-icon-button matTooltip="Interroger l'IA sur ce cycle"
                [style.color]="selectedCycle.color" (click)="openIa(selectedCycle)">
                <mat-icon>smart_toy</mat-icon>
              </button>
            </div>
          </div>

          <!-- Taux de couverture -->
          <div class="dt-coverage">
            <label class="dt-field__label">Taux de couverture</label>
            <div class="dt-coverage__row">
              <input
                type="range" min="0" max="100" step="5"
                class="dt-coverage__slider"
                [(ngModel)]="selectedCycle.data!.pourcentageCouverture"
                [disabled]="readonly"
              />
              <span class="dt-coverage__pct"
                [class.dt-coverage__pct--low]="(selectedCycle.data?.pourcentageCouverture ?? 0) < 50"
                [class.dt-coverage__pct--mid]="(selectedCycle.data?.pourcentageCouverture ?? 0) >= 50 && (selectedCycle.data?.pourcentageCouverture ?? 0) < 80"
                [class.dt-coverage__pct--ok]="(selectedCycle.data?.pourcentageCouverture ?? 0) >= 80">
                {{ selectedCycle.data?.pourcentageCouverture ?? 0 }}%
              </span>
            </div>
            <div class="dt-coverage__bar">
              <div class="dt-coverage__fill" [style.width.%]="selectedCycle.data?.pourcentageCouverture ?? 0"
                [style.background]="selectedCycle.color"></div>
            </div>
          </div>

          <!-- Commentaire du logiciel de traitement -->
          <div class="dt-field">
            <label class="dt-field__label">
              <mat-icon>import_contacts</mat-icon> Commentaire issu du logiciel de traitement
            </label>
            <textarea
              class="dt-textarea dt-textarea--logiciel"
              [(ngModel)]="selectedCycle.data!.commentaireLogiciel"
              placeholder="Collez ici le commentaire provenant de votre logiciel comptable..."
              [readonly]="readonly"
              rows="4">
            </textarea>
          </div>

          <!-- Diligences -->
          <div class="dt-field">
            <label class="dt-field__label">
              <mat-icon>checklist</mat-icon> Diligences effectuées
            </label>
            <textarea
              class="dt-textarea"
              [(ngModel)]="selectedCycle.data!.diligences"
              placeholder="Décrivez les diligences réalisées sur ce cycle..."
              [readonly]="readonly"
              rows="5">
            </textarea>
          </div>

          <!-- Conclusion -->
          <div class="dt-field">
            <label class="dt-field__label">
              <mat-icon>rate_review</mat-icon> Conclusion
            </label>
            <textarea
              class="dt-textarea"
              [(ngModel)]="selectedCycle.data!.conclusion"
              placeholder="Conclusion provisoire sur ce cycle..."
              [readonly]="readonly"
              rows="3">
            </textarea>
          </div>

        </div>
      }
    </div>
  }
</div>
  `,
  styles: [`
    .dt-tab { padding: 24px; max-width: 1100px; }

    /* Header */
    .dt-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; gap: 16px; }
    .dt-header__left { display: flex; align-items: center; gap: 16px; }
    .dt-header__icon { font-size: 32px; width: 32px; height: 32px; color: #6366f1; }
    .dt-header__title { margin: 0; font-size: 1.4rem; font-weight: 600; }
    .dt-header__sub { margin: 4px 0 0; color: #888; font-size: 0.875rem; }
    .dt-header__actions { display: flex; align-items: center; gap: 8px; }
    .dt-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
    .dt-badge--readonly { background: #fef3c7; color: #92400e; }
    .dt-badge--readonly mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .dt-copy-btn { height: 32px; font-size: 0.8rem; }

    .dt-loading { padding: 40px 0; }

    /* Section synthèse */
    .dt-section { background: var(--dt-card-bg, #fff); border: 1px solid var(--dt-border, #e5e7eb);
      border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    :host-context(.dark-theme) .dt-section, :host-context([data-theme="dark"]) .dt-section {
      --dt-card-bg: #1e2130; --dt-border: #2e3347; }
    .dt-section__head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .dt-section__head h3 { margin: 0; font-size: 1rem; font-weight: 600; flex: 1; }
    .dt-section__head mat-icon { color: #6366f1; }
    .dt-section__hint { font-size: 0.8rem; color: #888; margin: 0 0 12px; font-style: italic; }
    .dt-section--synthese { border-left: 4px solid #6366f1; }

    /* Layout cycles : sidebar + contenu */
    .dt-cycles-layout {
      display: flex;
      gap: 0;
      border: 1px solid var(--dt-border, #e5e7eb);
      border-radius: 12px;
      overflow: hidden;
      background: var(--dt-card-bg, #fff);
      min-height: 520px;
    }
    :host-context(.dark-theme) .dt-cycles-layout, :host-context([data-theme="dark"]) .dt-cycles-layout {
      --dt-card-bg: #1e2130; --dt-border: #2e3347; }

    /* Sidebar nav */
    .dt-cycles-nav {
      width: 230px;
      flex-shrink: 0;
      border-right: 1px solid var(--dt-border, #e5e7eb);
      overflow-y: auto;
      padding: 8px 0;
      background: var(--dt-nav-bg, #f8fafc);
    }
    :host-context(.dark-theme) .dt-cycles-nav, :host-context([data-theme="dark"]) .dt-cycles-nav {
      --dt-nav-bg: #161825; }

    .dt-nav-item {
      display: block; width: 100%; padding: 8px 12px; border: none; cursor: pointer;
      background: transparent; text-align: left; transition: background 0.15s;
    }
    .dt-nav-item:hover { background: var(--dt-nav-hover, rgba(99,102,241,0.07)); }
    .dt-nav-item--active { background: var(--dt-nav-active, rgba(99,102,241,0.1)); }
    :host-context(.dark-theme) .dt-nav-item--active,
    :host-context([data-theme="dark"]) .dt-nav-item--active { --dt-nav-active: rgba(99,102,241,0.18); }

    .dt-nav-item__top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }

    .dt-nav-letter {
      flex-shrink: 0;
      width: 26px; height: 26px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.9rem;
      transition: background 0.15s, color 0.15s;
    }

    .dt-nav-name {
      flex: 1; font-size: 0.78rem; font-weight: 500; line-height: 1.3;
      color: var(--dt-text, #374151); overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    :host-context(.dark-theme) .dt-nav-name, :host-context([data-theme="dark"]) .dt-nav-name {
      --dt-text: #d1d5db; }

    .dt-nav-pct {
      flex-shrink: 0; font-size: 0.7rem; font-weight: 700;
      padding: 1px 5px; border-radius: 8px; background: #f1f5f9;
    }
    .dt-nav-pct--low { color: #ef4444; background: #fef2f2; }
    .dt-nav-pct--mid { color: #f59e0b; background: #fffbeb; }
    .dt-nav-pct--ok  { color: #22c55e; background: #f0fdf4; }

    .dt-nav-bar { height: 3px; background: var(--dt-border, #e5e7eb); border-radius: 2px; overflow: hidden; }
    .dt-nav-bar__fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

    /* Contenu cycle */
    .dt-cycle-content {
      flex: 1; padding: 24px 28px; overflow-y: auto;
      border-left: 3px solid var(--cycle-color, #6366f1);
    }

    .dt-cycle__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .dt-cycle__title-row { display: flex; align-items: center; gap: 10px; }
    .dt-cycle__title { margin: 0; font-size: 1rem; font-weight: 700; }
    .dt-cycle__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

    /* Coverage */
    .dt-coverage { margin-bottom: 20px; }
    .dt-coverage__row { display: flex; align-items: center; gap: 12px; margin: 6px 0; }
    .dt-coverage__slider { flex: 1; accent-color: var(--cycle-color, #6366f1); }
    .dt-coverage__pct { font-size: 1.1rem; font-weight: 700; min-width: 44px; text-align: right; }
    .dt-coverage__pct--low { color: #ef4444; }
    .dt-coverage__pct--mid { color: #f59e0b; }
    .dt-coverage__pct--ok  { color: #22c55e; }
    .dt-coverage__bar { height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
    .dt-coverage__fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

    /* Fields */
    .dt-field { margin-bottom: 16px; }
    .dt-field__label { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700;
      color: #888; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
    .dt-field__label mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Textareas */
    .dt-textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
      font-family: inherit; font-size: 0.875rem; resize: vertical; background: var(--dt-textarea-bg, #fafafa);
      color: inherit; box-sizing: border-box; }
    .dt-textarea:focus { outline: none; border-color: var(--cycle-color, #6366f1); }
    .dt-textarea--synthese { min-height: 120px; }
    .dt-textarea--logiciel {
      background: var(--dt-logiciel-bg, #f0f4ff);
      border-color: #c7d2fe;
      border-left: 3px solid #6366f1;
      font-size: 0.85rem;
    }
    :host-context(.dark-theme) .dt-textarea--logiciel,
    :host-context([data-theme="dark"]) .dt-textarea--logiciel { --dt-logiciel-bg: #1e2040; border-color: #4338ca; }
    :host-context(.dark-theme) .dt-textarea, :host-context([data-theme="dark"]) .dt-textarea {
      --dt-textarea-bg: #252837; border-color: #374151; }

    .dt-save-btn { height: 32px; font-size: 0.8rem; }
  `],
})
export class DossierTravailTabComponent implements OnInit, OnChanges {
  @Input() clientId!: number;
  @Input() exerciceId!: number;
  @Input() readonly = false;

  private svc    = inject(DossierTravailService);
  private aiSvc  = inject(AiAssistantService);
  private toast  = inject(ToastService);

  dossier: DossierTravail | null = null;
  loading     = false;
  savingNote  = false;
  selectedCycleType: TypeCycle = 'A';

  get selectedCycle(): CycleUI | undefined {
    return this.cycles.find(c => c.type === this.selectedCycleType);
  }

  cycles: CycleUI[] = [
    { type: 'A', label: 'A — Régularités formelles et synthèse', icon: 'rule',            color: '#6366f1', data: null, saving: false },
    { type: 'B', label: 'B — Trésorerie et financement',         icon: 'account_balance', color: '#0ea5e9', data: null, saving: false },
    { type: 'C', label: 'C — Achats et fournisseurs',            icon: 'shopping_cart',   color: '#f59e0b', data: null, saving: false },
    { type: 'D', label: 'D — Charges externes',                  icon: 'receipt_long',    color: '#f97316', data: null, saving: false },
    { type: 'E', label: 'E — Ventes et clients',                 icon: 'storefront',      color: '#10b981', data: null, saving: false },
    { type: 'F', label: 'F — Stock et en cours',                 icon: 'inventory_2',     color: '#84cc16', data: null, saving: false },
    { type: 'G', label: 'G — Immobilisations',                   icon: 'business',        color: '#64748b', data: null, saving: false },
    { type: 'H', label: 'H — Social',                            icon: 'group',           color: '#ec4899', data: null, saving: false },
    { type: 'I', label: 'I — Impôts',                            icon: 'calculate',       color: '#ef4444', data: null, saving: false },
    { type: 'J', label: 'J — Capitaux propres et provisions',    icon: 'savings',         color: '#8b5cf6', data: null, saving: false },
    { type: 'K', label: 'K — Autres comptes',                    icon: 'more_horiz',      color: '#94a3b8', data: null, saving: false },
  ];

  cycleShortLabel(cycle: CycleUI): string {
    const dash = cycle.label.indexOf(' — ');
    return dash !== -1 ? cycle.label.slice(dash + 3) : cycle.label;
  }

  ngOnInit() { this.load(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['exerciceId'] && !changes['exerciceId'].firstChange) this.load();
  }

  load() {
    if (!this.exerciceId) return;
    this.loading = true;
    this.svc.get(this.clientId, this.exerciceId).subscribe({
      next: (d) => {
        this.dossier = d;
        this.syncCycles(d);
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  private syncCycles(d: DossierTravail) {
    for (const cycle of this.cycles) {
      const found = d.cycles?.find((c) => c.typeCycle === cycle.type);
      cycle.data = found ?? { id: 0, typeCycle: cycle.type, pourcentageCouverture: 0, commentaireLogiciel: '', diligences: '', conclusion: '', updatedAt: '' };
    }
  }

  saveNote() {
    if (!this.dossier) return;
    this.savingNote = true;
    this.svc.updateNote(this.clientId, this.exerciceId, this.dossier.noteSynthese).subscribe({
      next: () => { this.toast.success('Note de synthèse enregistrée'); this.savingNote = false; },
      error: () => this.savingNote = false,
    });
  }

  saveCycle(cycle: CycleUI) {
    if (!cycle.data) return;
    cycle.saving = true;
    const { pourcentageCouverture, commentaireLogiciel, diligences, conclusion } = cycle.data;
    this.svc.updateCycle(this.clientId, this.exerciceId, cycle.type, { pourcentageCouverture, commentaireLogiciel, diligences, conclusion }).subscribe({
      next: (updated) => {
        cycle.data = updated;
        cycle.saving = false;
        this.toast.success(`Cycle ${cycle.label} enregistré`);
      },
      error: () => cycle.saving = false,
    });
  }

  openIa(cycle: CycleUI) {
    const pct = cycle.data?.pourcentageCouverture ?? 0;
    const prefill = `Cycle ${cycle.label} — exercice ${this.exerciceId}. Taux de couverture : ${pct}%. `;
    this.aiSvc.requestOpen(prefill);
  }

  copyContent() {
    if (!this.dossier) return;
    const lines: string[] = [`DOSSIER DE TRAVAIL — Exercice ${this.exerciceId}`];
    if (this.dossier.noteSynthese) {
      lines.push('', '== NOTE DE SYNTHÈSE ==', this.dossier.noteSynthese);
    }
    for (const cycle of this.cycles) {
      if (!cycle.data) continue;
      lines.push('', `== ${cycle.label.toUpperCase()} (${cycle.data.pourcentageCouverture}%) ==`);
      if (cycle.data.diligences) lines.push('Diligences :', cycle.data.diligences);
      if (cycle.data.conclusion) lines.push('Conclusion :', cycle.data.conclusion);
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.toast.success('Contenu copié dans le presse-papiers');
    });
  }
}
