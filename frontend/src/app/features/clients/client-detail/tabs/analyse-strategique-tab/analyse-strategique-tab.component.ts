import { Component, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { ToastService } from '../../../../../core/services/toast.service';
import { AnalyseStrategiqueService } from '../../../../../core/services/analyse-strategique.service';

@Component({
  selector: 'app-analyse-strategique-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatExpansionModule,
  ],
  template: `
    <div class="tab">
      <div class="tab-header">
        <h2>Analyse Stratégique</h2>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="readonly">
          <mat-icon>save</mat-icon> {{ readonly ? 'Lecture seule' : 'Enregistrer' }}
        </button>
      </div>

      <form [formGroup]="form">

        <!-- SWOT -->
        <mat-expansion-panel class="panel" [expanded]="true">
          <mat-expansion-panel-header>
            <mat-panel-title><mat-icon>grid_view</mat-icon> Analyse SWOT</mat-panel-title>
          </mat-expansion-panel-header>
          <div class="swot-grid">
            <div class="swot-card swot-forces">
              <div class="swot-card__header"><mat-icon>thumb_up</mat-icon> Forces</div>
              <textarea [value]="swot.forces" (input)="updateSwot('forces', $event)" placeholder="Une force par ligne..."></textarea>
            </div>
            <div class="swot-card swot-faiblesses">
              <div class="swot-card__header"><mat-icon>thumb_down</mat-icon> Faiblesses</div>
              <textarea [value]="swot.faiblesses" (input)="updateSwot('faiblesses', $event)" placeholder="Une faiblesse par ligne..."></textarea>
            </div>
            <div class="swot-card swot-opportunites">
              <div class="swot-card__header"><mat-icon>trending_up</mat-icon> Opportunités</div>
              <textarea [value]="swot.opportunites" (input)="updateSwot('opportunites', $event)" placeholder="Une opportunité par ligne..."></textarea>
            </div>
            <div class="swot-card swot-menaces">
              <div class="swot-card__header"><mat-icon>warning</mat-icon> Menaces</div>
              <textarea [value]="swot.menaces" (input)="updateSwot('menaces', $event)" placeholder="Une menace par ligne..."></textarea>
            </div>
          </div>
        </mat-expansion-panel>

        <!-- 5 Forces de Porter -->
        <mat-expansion-panel class="panel">
          <mat-expansion-panel-header>
            <mat-panel-title><mat-icon>hub</mat-icon> 5 Forces de Porter</mat-panel-title>
          </mat-expansion-panel-header>
          <div class="porter-grid">
            @for (force of porterFields; track force.key) {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ force.label }}</mat-label>
                <textarea matInput rows="2" [formControlName]="force.key" [placeholder]="force.hint"></textarea>
              </mat-form-field>
            }
          </div>
        </mat-expansion-panel>

        <!-- Business Model Canvas -->
        <mat-expansion-panel class="panel">
          <mat-expansion-panel-header>
            <mat-panel-title><mat-icon>dashboard</mat-icon> Business Model Canvas</mat-panel-title>
          </mat-expansion-panel-header>
          <p class="bmc-hint">Décrivez le modèle économique du client : proposition de valeur, segments clients, canaux, sources de revenus, structure de coûts…</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Business Model Canvas</mat-label>
            <textarea matInput rows="8" formControlName="businessModelCanvas"
              placeholder="Ex : Boulangerie artisanale, clientèle locale, fabrication sur place, vente directe en boutique. Revenus : vente au comptoir + commandes événementielles. Coûts principaux : masse salariale + matières premières + énergie..."></textarea>
          </mat-form-field>
        </mat-expansion-panel>

      </form>
    </div>
  `,
  styles: [`
    .tab { padding: 24px; }
    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .tab-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
    .panel { margin-bottom: 16px; border-radius: 14px !important; }
    mat-panel-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    mat-panel-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: #6366f1; }
    .full-width { width: 100%; }

    /* SWOT */
    .swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 12px 0; }
    .swot-card { border-radius: 10px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); }
    .swot-card__header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; font-size: 13px; font-weight: 600;
    }
    .swot-card__header mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .swot-card textarea {
      width: 100%; min-height: 120px; padding: 12px; border: none;
      font-size: 13px; line-height: 1.6; resize: vertical; font-family: inherit;
      background: transparent;
    }
    .swot-card textarea:focus { outline: none; }
    .swot-forces      { background: #f0fdf4; }
    .swot-forces      .swot-card__header { background: #dcfce7; color: #15803d; }
    .swot-faiblesses  { background: #fff7ed; }
    .swot-faiblesses  .swot-card__header { background: #fed7aa; color: #c2410c; }
    .swot-opportunites{ background: #eff6ff; }
    .swot-opportunites.swot-card__header { background: #bfdbfe; color: #1d4ed8; }
    .swot-opportunites .swot-card__header { background: #bfdbfe; color: #1d4ed8; }
    .swot-menaces     { background: #fef2f2; }
    .swot-menaces     .swot-card__header { background: #fecaca; color: #dc2626; }

    /* Porter */
    .porter-grid { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; }

    /* BMC */
    .bmc-hint { font-size: 12px; color: #94a3b8; margin: 4px 0 16px; }
  `],
})
export class AnalyseStrategiqueTabComponent implements OnInit, OnChanges {
  @Input() clientId!: number;
  @Input() exerciceId!: number;
  @Input() readonly = false;
  private fb = inject(FormBuilder);
  private service = inject(AnalyseStrategiqueService);
  private toast = inject(ToastService);

  form = this.fb.group({
    porterConcurrence:      [''],
    porterNouveauxEntrants: [''],
    porterClients:          [''],
    porterFournisseurs:     [''],
    porterSubstituts:       [''],
    businessModelCanvas:    [''],
  });

  swot = { forces: '', faiblesses: '', opportunites: '', menaces: '' };

  porterFields = [
    { key: 'porterConcurrence',      label: 'Intensité de la concurrence',              hint: 'Ex : Forte — 43 concurrents sur la commune' },
    { key: 'porterNouveauxEntrants', label: 'Menace des nouveaux entrants',              hint: 'Ex : Moyenne — barrières réglementaires (ERP, hygiène)' },
    { key: 'porterClients',          label: 'Pouvoir de négociation des clients',        hint: 'Ex : Élevé — faible coût de changement' },
    { key: 'porterFournisseurs',     label: 'Pouvoir de négociation des fournisseurs',   hint: 'Ex : Moyen — matières premières standardisées' },
    { key: 'porterSubstituts',       label: 'Menace des produits de substitution',       hint: 'Ex : Moyenne — grande distribution, snacking industriel' },
  ];

  ngOnInit() { this.load(); }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['exerciceId'] || changes['clientId']) && this.exerciceId) {
      this.load();
    }
  }

  private load() {
    if (!this.clientId || !this.exerciceId) return;
    this.service.get(this.clientId, this.exerciceId).subscribe((data) => {
      if (data) {
        this.form.patchValue(data);
        this.swot.forces       = (data.forces      || []).join('\n');
        this.swot.faiblesses   = (data.faiblesses  || []).join('\n');
        this.swot.opportunites = (data.opportunites || []).join('\n');
        this.swot.menaces      = (data.menaces      || []).join('\n');
      }
    });
  }

  updateSwot(key: keyof typeof this.swot, event: Event) {
    this.swot[key] = (event.target as HTMLTextAreaElement).value;
  }

  save() {
    if (this.readonly) return;
    const toArray = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);
    this.service.save(this.clientId, this.exerciceId, {
      ...this.form.value,
      forces:       toArray(this.swot.forces),
      faiblesses:   toArray(this.swot.faiblesses),
      opportunites: toArray(this.swot.opportunites),
      menaces:      toArray(this.swot.menaces),
    }).subscribe(() => this.toast.success('Analyse stratégique enregistrée'));
  }
}
