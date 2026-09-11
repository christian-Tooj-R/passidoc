import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  TacheRecurrenteService,
  TacheRecurrente,
  FrequenceTache,
} from '../../../../../core/services/tache-recurrente.service';
import { AuthService } from '../../../../../core/services/auth.service';

const FREQUENCES: { value: FrequenceTache; label: string }[] = [
  { value: 'MENSUELLE',      label: 'Mensuelle' },
  { value: 'TRIMESTRIELLE',  label: 'Trimestrielle' },
  { value: 'SEMESTRIELLE',   label: 'Semestrielle' },
  { value: 'ANNUELLE',       label: 'Annuelle' },
];

const SERVICES = ['COMPTA', 'SOCIAL', 'JURIDIQUE', 'ADMIN'];

@Component({
  selector: 'app-taches-recurrentes-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule, MatSnackBarModule,
  ],
  template: `
<div class="tr-tab">
  <div class="tr-header">
    <h3 class="tr-title"><mat-icon>repeat</mat-icon> Tâches récurrentes</h3>
    @if (canGenerate()) {
      <button mat-stroked-button color="accent" class="tr-btn-generate"
              (click)="generer()" [disabled]="generating()">
        <mat-icon>play_arrow</mat-icon>
        {{ generating() ? 'Génération...' : 'Générer maintenant' }}
      </button>
    }
  </div>

  <!-- Liste -->
  <div class="tr-list">
    @if (items().length === 0 && !loading()) {
      <p class="tr-empty">Aucune tâche récurrente configurée pour ce dossier.</p>
    }
    @for (tr of items(); track tr.id) {
      <div class="tr-item" [class.tr-item--inactive]="!tr.isActive">
        <div class="tr-item__info">
          <span class="tr-item__titre">{{ tr.titre }}</span>
          <span class="tr-item__freq">{{ labelFreq(tr.frequence) }}</span>
          @if (tr.serviceDestinataire) {
            <span class="tr-item__svc">{{ tr.serviceDestinataire }}</span>
          }
          <span class="tr-item__delai">J-{{ tr.delaiAvantEcheanceJours }}</span>
        </div>
        <div class="tr-item__actions">
          <mat-slide-toggle [checked]="tr.isActive"
                            (change)="toggleActive(tr, $event.checked)"
                            matTooltip="Activer / désactiver">
          </mat-slide-toggle>
          <button mat-icon-button color="warn" (click)="supprimer(tr)"
                  matTooltip="Supprimer">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      </div>
    }
  </div>

  <!-- Formulaire d'ajout -->
  <div class="tr-form">
    <h4 class="tr-form__title">Ajouter une tâche récurrente</h4>
    <div class="tr-form__fields">
      <mat-form-field appearance="outline" class="tr-field--titre">
        <mat-label>Titre</mat-label>
        <input matInput [(ngModel)]="form.titre" name="titre" placeholder="Ex: Déclaration TVA" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Fréquence</mat-label>
        <mat-select [(ngModel)]="form.frequence" name="frequence">
          @for (f of frequences; track f.value) {
            <mat-option [value]="f.value">{{ f.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="tr-field--delai">
        <mat-label>Délai (jours avant)</mat-label>
        <input matInput type="number" [(ngModel)]="form.delaiAvantEcheanceJours"
               name="delai" min="1" max="90" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Service (optionnel)</mat-label>
        <mat-select [(ngModel)]="form.serviceDestinataire" name="service">
          <mat-option value="">—</mat-option>
          @for (s of services; track s) {
            <mat-option [value]="s">{{ s }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    <button mat-flat-button color="primary" class="tr-btn-add"
            (click)="ajouter()" [disabled]="!form.titre || saving()">
      <mat-icon>add</mat-icon>
      {{ saving() ? 'Enregistrement...' : 'Enregistrer' }}
    </button>
  </div>
</div>
  `,
  styles: [`
    .tr-tab { padding: 20px; max-width: 860px; }
    .tr-header { display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; background: white; margin: -20px -20px 16px; padding: 10px 20px; border-bottom: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,.04); }
    .tr-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.1rem; font-weight: 600; }

    .tr-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
    .tr-empty { color: #888; font-style: italic; padding: 16px 0; }

    .tr-item { display: flex; align-items: center; justify-content: space-between;
               padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 8px;
               background: #fff; transition: opacity .2s; }
    .tr-item--inactive { opacity: .5; }
    .tr-item__info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .tr-item__titre { font-weight: 500; }
    .tr-item__freq { background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: .8rem; }
    .tr-item__svc  { background: #f3e5f5; color: #6a1b9a; padding: 2px 8px; border-radius: 12px; font-size: .8rem; }
    .tr-item__delai { color: #888; font-size: .85rem; }
    .tr-item__actions { display: flex; align-items: center; gap: 4px; }

    .tr-form { border: 1px dashed #bbb; border-radius: 8px; padding: 20px; background: #fafafa; }
    .tr-form__title { margin: 0 0 16px; font-size: .95rem; font-weight: 600; color: #555; }
    .tr-form__fields { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .tr-form__fields mat-form-field { flex: 1; min-width: 160px; }
    .tr-field--titre { flex: 2 !important; }
    .tr-field--delai { flex: 0 0 160px !important; }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) .tr-item { background: #1e1e1e; border-color: #333; }
      :root:not([data-theme="light"]) .tr-form { background: #151515; border-color: #444; }
    }
  `],
})
export class TachesRecurrentesTabComponent implements OnInit {
  @Input() clientId!: number;

  private svc   = inject(TacheRecurrenteService);
  private auth  = inject(AuthService);
  private snack = inject(MatSnackBar);

  items     = signal<TacheRecurrente[]>([]);
  loading   = signal(false);
  saving    = signal(false);
  generating = signal(false);

  frequences = FREQUENCES;
  services   = SERVICES;

  form: { titre: string; frequence: FrequenceTache; delaiAvantEcheanceJours: number; serviceDestinataire: string } = {
    titre: '',
    frequence: 'MENSUELLE',
    delaiAvantEcheanceJours: 7,
    serviceDestinataire: '',
  };

  canGenerate() {
    return this.auth.isAdmin() || this.auth.isExpert();
  }

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.loading.set(true);
    this.svc.findByClient(this.clientId).subscribe({
      next: data => { this.items.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  ajouter() {
    if (!this.form.titre) return;
    this.saving.set(true);
    this.svc.create({
      titre: this.form.titre,
      frequence: this.form.frequence,
      delaiAvantEcheanceJours: this.form.delaiAvantEcheanceJours,
      serviceDestinataire: this.form.serviceDestinataire || undefined,
      clientId: this.clientId,
    }).subscribe({
      next: tr => {
        this.items.update(list => [...list, tr]);
        this.form = { titre: '', frequence: 'MENSUELLE', delaiAvantEcheanceJours: 7, serviceDestinataire: '' };
        this.saving.set(false);
        this.snack.open('Tâche récurrente enregistrée', 'OK', { duration: 3000 });
      },
      error: () => { this.saving.set(false); this.snack.open('Erreur lors de l\'enregistrement', 'OK', { duration: 3000 }); },
    });
  }

  toggleActive(tr: TacheRecurrente, active: boolean) {
    this.svc.update(tr.id, { isActive: active }).subscribe({
      next: updated => this.items.update(list => list.map(t => t.id === tr.id ? updated : t)),
    });
  }

  supprimer(tr: TacheRecurrente) {
    this.svc.remove(tr.id).subscribe({
      next: () => {
        this.items.update(list => list.filter(t => t.id !== tr.id));
        this.snack.open('Tâche récurrente supprimée', 'OK', { duration: 2000 });
      },
    });
  }

  generer() {
    this.generating.set(true);
    this.svc.generer().subscribe({
      next: res => {
        this.generating.set(false);
        this.snack.open(`${res.created} tâche(s) générée(s)`, 'OK', { duration: 3000 });
      },
      error: () => { this.generating.set(false); },
    });
  }

  labelFreq(f: FrequenceTache): string {
    return FREQUENCES.find(x => x.value === f)?.label ?? f;
  }
}
