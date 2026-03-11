import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AnalyseStrategiqueService } from '../../../../../core/services/analyse-strategique.service';

@Component({
  selector: 'app-analyse-strategique-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatExpansionModule, MatSnackBarModule,
  ],
  template: `
    <div class="tab">
      <div class="tab-header">
        <h2>Analyse Stratégique</h2>
        <button mat-flat-button color="primary" (click)="save()">
          <mat-icon>save</mat-icon> Enregistrer
        </button>
      </div>

      <form [formGroup]="form">
        <!-- KPIs financiers -->
        <mat-expansion-panel class="panel" [expanded]="true">
          <mat-expansion-panel-header>
            <mat-panel-title><mat-icon>show_chart</mat-icon> Performances financières</mat-panel-title>
          </mat-expansion-panel-header>
          <div class="kpi-grid">
            <div class="kpi-field">
              <label>Exercice</label>
              <mat-form-field appearance="outline">
                <input matInput type="number" formControlName="anneeExercice" placeholder="2025" />
              </mat-form-field>
            </div>
            <div class="kpi-field">
              <label>CA (€)</label>
              <mat-form-field appearance="outline">
                <input matInput type="number" formControlName="ca" placeholder="486 201" />
              </mat-form-field>
            </div>
            <div class="kpi-field">
              <label>CA N-1 (€)</label>
              <mat-form-field appearance="outline">
                <input matInput type="number" formControlName="caPrecedent" />
              </mat-form-field>
            </div>
            <div class="kpi-field">
              <label>EBE (€)</label>
              <mat-form-field appearance="outline">
                <input matInput type="number" formControlName="ebe" />
              </mat-form-field>
            </div>
            <div class="kpi-field">
              <label>Résultat net (€)</label>
              <mat-form-field appearance="outline">
                <input matInput type="number" formControlName="resultatNet" />
              </mat-form-field>
            </div>
            <div class="kpi-field">
              <label>Flux de trésorerie (€)</label>
              <mat-form-field appearance="outline">
                <input matInput type="number" formControlName="fluxTresorerie" />
              </mat-form-field>
            </div>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Commentaire financier</mat-label>
            <textarea matInput rows="3" formControlName="commentaireFinancier"></textarea>
          </mat-form-field>
        </mat-expansion-panel>

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

        <!-- Porter -->
        <mat-expansion-panel class="panel">
          <mat-expansion-panel-header>
            <mat-panel-title><mat-icon>hub</mat-icon> 5 Forces de Porter</mat-panel-title>
          </mat-expansion-panel-header>
          <div class="porter-grid">
            @for (force of porterFields; track force.key) {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ force.label }}</mat-label>
                <textarea matInput rows="2" [formControlName]="force.key"></textarea>
              </mat-form-field>
            }
          </div>
        </mat-expansion-panel>

        <!-- Marché & Digital -->
        <mat-expansion-panel class="panel">
          <mat-expansion-panel-header>
            <mat-panel-title><mat-icon>store</mat-icon> Marché & Présence digitale</mat-panel-title>
          </mat-expansion-panel-header>
          <div class="market-grid">
            <mat-form-field appearance="outline">
              <mat-label>Concurrents dans le quartier</mat-label>
              <input matInput type="number" formControlName="nbConcurrentsQuartier" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Concurrents dans la commune</mat-label>
              <input matInput type="number" formControlName="nbConcurrentsCommune" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Site web</mat-label>
              <input matInput formControlName="siteWeb" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Réseaux sociaux (un par ligne)</mat-label>
            <textarea matInput rows="2" [value]="reseauxText" (input)="updateReseaux($event)" placeholder="Facebook&#10;Instagram"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Évolution du secteur</mat-label>
            <textarea matInput rows="3" formControlName="evolutionSecteur"></textarea>
          </mat-form-field>
        </mat-expansion-panel>
      </form>
    </div>
  `,
  styles: [`
    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .tab-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; }
    .panel { margin-bottom: 12px; border-radius: 10px !important; }
    mat-panel-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    mat-panel-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: #6366f1; }
    .full-width { width: 100%; }

    /* KPIs */
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; }
    .kpi-field label { display: block; font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 4px; }
    .kpi-field mat-form-field { width: 100%; }

    /* SWOT */
    .swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
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
    .swot-forces { background: #f0fdf4; }
    .swot-forces .swot-card__header { background: #dcfce7; color: #15803d; }
    .swot-faiblesses { background: #fff7ed; }
    .swot-faiblesses .swot-card__header { background: #fed7aa; color: #c2410c; }
    .swot-opportunites { background: #eff6ff; }
    .swot-opportunites .swot-card__header { background: #bfdbfe; color: #1d4ed8; }
    .swot-menaces { background: #fef2f2; }
    .swot-menaces .swot-card__header { background: #fecaca; color: #dc2626; }

    /* Porter */
    .porter-grid { display: flex; flex-direction: column; gap: 8px; }

    /* Market */
    .market-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; }
    .market-grid mat-form-field { width: 100%; }
  `],
})
export class AnalyseStrategiqueTabComponent implements OnInit {
  @Input() clientId!: number;
  private fb = inject(FormBuilder);
  private service = inject(AnalyseStrategiqueService);
  private snack = inject(MatSnackBar);

  form = this.fb.group({
    anneeExercice: [null as number | null],
    ca: [null as number | null],
    caPrecedent: [null as number | null],
    ebe: [null as number | null],
    resultatNet: [null as number | null],
    fluxTresorerie: [null as number | null],
    commentaireFinancier: [''],
    porterConcurrence: [''],
    porterNouveauxEntrants: [''],
    porterClients: [''],
    porterFournisseurs: [''],
    porterSubstituts: [''],
    nbConcurrentsQuartier: [null as number | null],
    nbConcurrentsCommune: [null as number | null],
    siteWeb: [''],
    evolutionSecteur: [''],
  });

  swot = { forces: '', faiblesses: '', opportunites: '', menaces: '' };
  reseauxText = '';

  porterFields = [
    { key: 'porterConcurrence', label: 'Intensité de la concurrence' },
    { key: 'porterNouveauxEntrants', label: 'Menace des nouveaux entrants' },
    { key: 'porterClients', label: 'Pouvoir de négociation des clients' },
    { key: 'porterFournisseurs', label: 'Pouvoir de négociation des fournisseurs' },
    { key: 'porterSubstituts', label: 'Menace des produits de substitution' },
  ];

  ngOnInit() {
    this.service.get(this.clientId).subscribe((data) => {
      if (data) {
        this.form.patchValue(data);
        this.swot.forces = (data.forces || []).join('\n');
        this.swot.faiblesses = (data.faiblesses || []).join('\n');
        this.swot.opportunites = (data.opportunites || []).join('\n');
        this.swot.menaces = (data.menaces || []).join('\n');
        this.reseauxText = (data.reseauxSociaux || []).join('\n');
      }
    });
  }

  updateSwot(key: keyof typeof this.swot, event: Event) {
    this.swot[key] = (event.target as HTMLTextAreaElement).value;
  }

  updateReseaux(event: Event) {
    this.reseauxText = (event.target as HTMLTextAreaElement).value;
  }

  save() {
    const toArray = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);
    const payload = {
      ...this.form.value,
      forces: toArray(this.swot.forces),
      faiblesses: toArray(this.swot.faiblesses),
      opportunites: toArray(this.swot.opportunites),
      menaces: toArray(this.swot.menaces),
      reseauxSociaux: toArray(this.reseauxText),
    };
    this.service.save(this.clientId, payload).subscribe(() => {
      this.snack.open('Analyse stratégique enregistrée', 'OK', { duration: 2500 });
    });
  }
}
