import { Component, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
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
    MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, MatTabsModule,
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
    @if (readonly) {
      <span class="dt-badge dt-badge--readonly"><mat-icon>lock</mat-icon> Lecture seule</span>
    }
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

    <!-- Cycles de révision en onglets -->
    <mat-tab-group class="dt-cycle-tabs" animationDuration="150ms">
      @for (cycle of cycles; track cycle.type) {
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="dt-tab-icon" [style.color]="cycle.color">{{ cycle.icon }}</mat-icon>
            <span class="dt-tab-label">{{ cycle.label }}</span>
            <span class="dt-tab-pct"
              [class.dt-tab-pct--low]="(cycle.data?.pourcentageCouverture ?? 0) < 50"
              [class.dt-tab-pct--mid]="(cycle.data?.pourcentageCouverture ?? 0) >= 50 && (cycle.data?.pourcentageCouverture ?? 0) < 80"
              [class.dt-tab-pct--ok]="(cycle.data?.pourcentageCouverture ?? 0) >= 80">
              {{ cycle.data?.pourcentageCouverture ?? 0 }}%
            </span>
          </ng-template>

          <div class="dt-cycle-content" [style.--cycle-color]="cycle.color">

            <!-- Actions -->
            <div class="dt-cycle__actions">
              @if (!readonly) {
                <button mat-flat-button class="dt-save-btn" [style.background]="cycle.color"
                  (click)="saveCycle(cycle)" [disabled]="cycle.saving">
                  <mat-icon>save</mat-icon> {{ cycle.saving ? 'Enregistrement...' : 'Enregistrer' }}
                </button>
              }
              <button mat-icon-button matTooltip="Interroger l'IA sur ce cycle"
                [style.color]="cycle.color" (click)="openIa(cycle)">
                <mat-icon>smart_toy</mat-icon>
              </button>
            </div>

            <!-- Taux de couverture -->
            <div class="dt-coverage">
              <label class="dt-coverage__label">Taux de couverture</label>
              <div class="dt-coverage__row">
                <input
                  type="range" min="0" max="100" step="5"
                  class="dt-coverage__slider"
                  [(ngModel)]="cycle.data!.pourcentageCouverture"
                  [disabled]="readonly"
                />
                <span class="dt-coverage__pct"
                  [class.dt-coverage__pct--low]="(cycle.data?.pourcentageCouverture ?? 0) < 50"
                  [class.dt-coverage__pct--mid]="(cycle.data?.pourcentageCouverture ?? 0) >= 50 && (cycle.data?.pourcentageCouverture ?? 0) < 80"
                  [class.dt-coverage__pct--ok]="(cycle.data?.pourcentageCouverture ?? 0) >= 80">
                  {{ cycle.data?.pourcentageCouverture ?? 0 }}%
                </span>
              </div>
              <div class="dt-coverage__bar">
                <div class="dt-coverage__fill" [style.width.%]="cycle.data?.pourcentageCouverture ?? 0"
                  [style.background]="cycle.color"></div>
              </div>
            </div>

            <!-- Diligences -->
            <div class="dt-field">
              <label class="dt-field__label">
                <mat-icon>checklist</mat-icon> Diligences effectuées
              </label>
              <textarea
                class="dt-textarea"
                [(ngModel)]="cycle.data!.diligences"
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
                [(ngModel)]="cycle.data!.conclusion"
                placeholder="Conclusion provisoire sur ce cycle..."
                [readonly]="readonly"
                rows="3">
              </textarea>
            </div>

          </div>
        </mat-tab>
      }
    </mat-tab-group>
  }
</div>
  `,
  styles: [`
    .dt-tab { padding: 24px; max-width: 900px; }

    /* Header */
    .dt-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; gap: 16px; }
    .dt-header__left { display: flex; align-items: center; gap: 16px; }
    .dt-header__icon { font-size: 32px; width: 32px; height: 32px; color: #6366f1; }
    .dt-header__title { margin: 0; font-size: 1.4rem; font-weight: 600; }
    .dt-header__sub { margin: 4px 0 0; color: #888; font-size: 0.875rem; }
    .dt-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
    .dt-badge--readonly { background: #fef3c7; color: #92400e; }
    .dt-badge--readonly mat-icon { font-size: 14px; width: 14px; height: 14px; }

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

    /* Tab group cycles */
    .dt-cycle-tabs { margin-top: 4px; }
    .dt-cycle-tabs .mat-mdc-tab-header { border-bottom: 2px solid var(--dt-border, #e5e7eb); margin-bottom: 0; }
    .dt-tab-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; }
    .dt-tab-label { font-weight: 600; margin-right: 8px; }
    .dt-tab-pct { font-size: 0.75rem; font-weight: 700; padding: 1px 6px; border-radius: 10px; background: #f1f5f9; }
    .dt-tab-pct--low  { color: #ef4444; background: #fef2f2; }
    .dt-tab-pct--mid  { color: #f59e0b; background: #fffbeb; }
    .dt-tab-pct--ok   { color: #22c55e; background: #f0fdf4; }
    .dt-cycle-content { padding: 20px 0; border-left: 3px solid var(--cycle-color, #6366f1);
      padding-left: 20px; margin-top: 16px; }
    .dt-cycle__actions { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }

    /* Coverage */
    .dt-coverage { margin-bottom: 16px; }
    .dt-coverage__label { font-size: 0.8rem; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px; }
    .dt-coverage__row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .dt-coverage__slider { flex: 1; accent-color: var(--cycle-color, #6366f1); }
    .dt-coverage__pct { font-size: 1.1rem; font-weight: 700; min-width: 44px; text-align: right; }
    .dt-coverage__pct--low  { color: #ef4444; }
    .dt-coverage__pct--mid  { color: #f59e0b; }
    .dt-coverage__pct--ok   { color: #22c55e; }
    .dt-coverage__bar { height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
    .dt-coverage__fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

    /* Fields */
    .dt-field { margin-bottom: 16px; }
    .dt-field__label { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 600;
      color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .dt-field__label mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Textareas */
    .dt-textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
      font-family: inherit; font-size: 0.875rem; resize: vertical; background: var(--dt-textarea-bg, #fafafa);
      color: inherit; box-sizing: border-box; }
    .dt-textarea:focus { outline: none; border-color: #6366f1; }
    .dt-textarea--synthese { min-height: 120px; }
    :host-context(.dark-theme) .dt-textarea, :host-context([data-theme="dark"]) .dt-textarea {
      --dt-textarea-bg: #252837; border-color: #374151; }

    /* Save button override */
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

  cycles: CycleUI[] = [
    { type: 'VENTE',  label: 'Ventes',  icon: 'storefront',    color: '#10b981', data: null, saving: false },
    { type: 'ACHAT',  label: 'Achats',  icon: 'shopping_cart', color: '#f59e0b', data: null, saving: false },
    { type: 'SOCIAL', label: 'Social',  icon: 'group',         color: '#6366f1', data: null, saving: false },
  ];

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
      cycle.data = found ?? { id: 0, typeCycle: cycle.type, pourcentageCouverture: 0, diligences: '', conclusion: '', updatedAt: '' };
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
    const { pourcentageCouverture, diligences, conclusion } = cycle.data;
    this.svc.updateCycle(this.clientId, this.exerciceId, cycle.type, { pourcentageCouverture, diligences, conclusion }).subscribe({
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
}
