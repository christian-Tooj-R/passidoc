import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  PaieService,
  EmployeClient,
  VariablePaie,
  ResultatCalculPaie,
  BulletinPaie,
  LignePaieLibre,
  TypeContratEmployePaie,
} from '../../../../../core/services/paie.service';

const TYPES_CONTRAT: { value: TypeContratEmployePaie; label: string }[] = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'APPRENTISSAGE', label: 'Apprentissage' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'INTERIM', label: 'Intérim' },
  { value: 'AUTRE', label: 'Autre' },
];

const MOIS_LABEL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface FormeVariable {
  heuresSupplementaires: number;
  tauxMajorationHeuresSup: number | null;
  primes: LignePaieLibre[];
  absences: LignePaieLibre[];
  avantagesNature: LignePaieLibre[];
  retenuesDiverses: LignePaieLibre[];
  commentaire: string;
}

function formeVide(): FormeVariable {
  return {
    heuresSupplementaires: 0,
    tauxMajorationHeuresSup: null,
    primes: [],
    absences: [],
    avantagesNature: [],
    retenuesDiverses: [],
    commentaire: '',
  };
}

@Component({
  selector: 'app-paie-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSnackBarModule,
  ],
  template: `
<div class="paie-tab">
  <div class="paie-header">
    <h3 class="paie-title"><mat-icon>payments</mat-icon> Paie des employés</h3>
  </div>

  <p class="paie-warning">
    <mat-icon>info</mat-icon>
    Module de démonstration : les taux de cotisations par défaut sont des valeurs d'exemple
    (placeholders) non certifiées — voir <code>Doc/MODULE_PAIE_NOTES.md</code> avant tout usage réel.
  </p>

  <!-- Liste des employés -->
  <div class="paie-list">
    @if (employes().length === 0 && !loading()) {
      <p class="paie-empty">Aucun employé enregistré pour ce dossier.</p>
    }
    @for (e of employes(); track e.id) {
      <div class="employe-item" [class.employe-item--selected]="selectedEmploye()?.id === e.id"
           [class.employe-item--inactive]="!e.isActive"
           (click)="selectionner(e)">
        <div class="employe-item__info">
          <span class="employe-item__nom">{{ e.prenom }} {{ e.nom }}</span>
          <span class="employe-item__matricule">{{ e.matricule }}</span>
          <span class="employe-item__poste">{{ e.poste || '—' }}</span>
          <span class="employe-item__regime">{{ e.regimePaieCode }}</span>
          <span class="employe-item__salaire">{{ e.salaireBase | number:'1.2-2' }} €</span>
        </div>
        <div class="employe-item__actions">
          <button mat-icon-button color="warn" (click)="supprimerEmploye(e); $event.stopPropagation()"
                  matTooltip="Supprimer">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      </div>
    }
  </div>

  <!-- Formulaire d'ajout employé -->
  <div class="paie-form">
    <h4 class="paie-form__title">Ajouter un employé</h4>
    <div class="paie-form__fields">
      <mat-form-field appearance="outline">
        <mat-label>Matricule</mat-label>
        <input matInput [(ngModel)]="nouvelEmploye.matricule" name="matricule" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Nom</mat-label>
        <input matInput [(ngModel)]="nouvelEmploye.nom" name="nom" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Prénom</mat-label>
        <input matInput [(ngModel)]="nouvelEmploye.prenom" name="prenom" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Poste</mat-label>
        <input matInput [(ngModel)]="nouvelEmploye.poste" name="poste" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Type de contrat</mat-label>
        <mat-select [(ngModel)]="nouvelEmploye.typeContrat" name="typeContrat">
          @for (t of typesContrat; track t.value) {
            <mat-option [value]="t.value">{{ t.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Date d'entrée</mat-label>
        <input matInput type="date" [(ngModel)]="nouvelEmploye.dateEntree" name="dateEntree" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Salaire de base brut mensuel (€)</mat-label>
        <input matInput type="number" [(ngModel)]="nouvelEmploye.salaireBase" name="salaireBase" min="0" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Quotité de travail (%)</mat-label>
        <input matInput type="number" [(ngModel)]="nouvelEmploye.quotiteTravail" name="quotiteTravail" min="0" max="100" />
      </mat-form-field>
    </div>
    <button mat-flat-button color="primary" (click)="ajouterEmploye()"
            [disabled]="!nouvelEmploye.matricule || !nouvelEmploye.nom || savingEmploye()">
      <mat-icon>person_add</mat-icon>
      {{ savingEmploye() ? 'Enregistrement...' : 'Ajouter' }}
    </button>
  </div>

  <!-- Détail employé sélectionné : variables du mois + calcul + bulletin -->
  @if (selectedEmploye(); as employe) {
    <div class="paie-detail">
      <h4 class="paie-detail__title">
        <mat-icon>badge</mat-icon>
        Paie de {{ employe.prenom }} {{ employe.nom }} — régime {{ employe.regimePaieCode }}
      </h4>

      <div class="periode-row">
        <mat-form-field appearance="outline" class="periode-field">
          <mat-label>Mois</mat-label>
          <mat-select [(ngModel)]="mois" name="mois" (selectionChange)="chargerVariable()">
            @for (m of moisLabels; track m.value) {
              <mat-option [value]="m.value">{{ m.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="periode-field">
          <mat-label>Année</mat-label>
          <input matInput type="number" [(ngModel)]="annee" name="annee" (change)="chargerVariable()" />
        </mat-form-field>
      </div>

      <div class="variable-form">
        <div class="variable-form__row">
          <mat-form-field appearance="outline">
            <mat-label>Heures supplémentaires</mat-label>
            <input matInput type="number" [(ngModel)]="forme.heuresSupplementaires" name="heuresSup" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Majoration HS (%) — vide = défaut paramétré</mat-label>
            <input matInput type="number" [(ngModel)]="forme.tauxMajorationHeuresSup" name="tauxMajoration" />
          </mat-form-field>
        </div>

        @for (bloc of blocs; track bloc.key) {
          <div class="ligne-libre">
            <div class="ligne-libre__titre">{{ bloc.label }}</div>
            @for (l of forme[bloc.key]; track $index) {
              <div class="ligne-libre__row">
                <input class="ligne-libre__libelle" [(ngModel)]="l.libelle" [name]="bloc.key + '-lib-' + $index"
                       placeholder="Libellé" />
                <input class="ligne-libre__montant" type="number" [(ngModel)]="l.montant"
                       [name]="bloc.key + '-mnt-' + $index" placeholder="Montant (€)" />
                <button mat-icon-button color="warn" (click)="retirerLigne(bloc.key, $index)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
            <button mat-stroked-button (click)="ajouterLigne(bloc.key)">
              <mat-icon>add</mat-icon> Ajouter une ligne
            </button>
          </div>
        }

        <mat-form-field appearance="outline" class="commentaire-field">
          <mat-label>Commentaire</mat-label>
          <input matInput [(ngModel)]="forme.commentaire" name="commentaire" />
        </mat-form-field>

        <div class="variable-actions">
          <button mat-stroked-button (click)="enregistrerVariable()" [disabled]="savingVariable()">
            <mat-icon>save</mat-icon> {{ savingVariable() ? 'Enregistrement...' : 'Enregistrer les variables' }}
          </button>
          <button mat-stroked-button color="accent" (click)="calculerApercu()" [disabled]="calculating()">
            <mat-icon>calculate</mat-icon> {{ calculating() ? 'Calcul...' : 'Calculer (aperçu)' }}
          </button>
          <button mat-flat-button color="primary" (click)="genererBulletin()" [disabled]="generating()">
            <mat-icon>description</mat-icon> {{ generating() ? 'Génération...' : 'Générer le bulletin' }}
          </button>
        </div>
      </div>

      @if (resultat(); as r) {
        <div class="resultat">
          <h5>Aperçu du calcul — {{ labelMois(r.mois) }} {{ r.annee }}</h5>
          <table class="resultat-table">
            <tr><td>Salaire de base</td><td>{{ r.salaireBase | number:'1.2-2' }} €</td></tr>
            <tr class="resultat-table__brut"><td>Total brut</td><td>{{ r.totalBrut | number:'1.2-2' }} €</td></tr>
            <tr><td>Cotisations salariales</td><td>{{ r.totalCotisationsSalariales | number:'1.2-2' }} €</td></tr>
            <tr><td>Cotisations patronales</td><td>{{ r.totalCotisationsPatronales | number:'1.2-2' }} €</td></tr>
            <tr><td>Net imposable</td><td>{{ r.netImposable | number:'1.2-2' }} €</td></tr>
            <tr class="resultat-table__net"><td>Net à payer</td><td>{{ r.netAPayer | number:'1.2-2' }} €</td></tr>
          </table>

          <table class="detail-table">
            <thead>
              <tr><th>Rubrique</th><th>Base</th><th>Taux sal.</th><th>Part sal.</th><th>Taux pat.</th><th>Part pat.</th></tr>
            </thead>
            <tbody>
              @for (l of r.detailRubriques; track l.code) {
                <tr>
                  <td>{{ l.libelle }}</td>
                  <td>{{ l.base | number:'1.2-2' }}</td>
                  <td>{{ l.tauxSalarial != null ? (l.tauxSalarial + '%') : '—' }}</td>
                  <td>{{ l.montantSalarial | number:'1.2-2' }}</td>
                  <td>{{ l.tauxPatronal != null ? (l.tauxPatronal + '%') : '—' }}</td>
                  <td>{{ l.montantPatronal | number:'1.2-2' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <div class="bulletins-historique">
        <h5>Historique des bulletins générés</h5>
        @if (bulletins().length === 0) {
          <p class="paie-empty">Aucun bulletin généré pour cet employé.</p>
        }
        @for (b of bulletins(); track b.id) {
          <div class="bulletin-item">
            <span>{{ labelMois(b.mois) }} {{ b.annee }}</span>
            <span>Net à payer : {{ b.netAPayer | number:'1.2-2' }} €</span>
            <button mat-stroked-button (click)="telechargerPdf(b)">
              <mat-icon>picture_as_pdf</mat-icon> PDF
            </button>
          </div>
        }
      </div>
    </div>
  }
</div>
  `,
  styles: [`
    .paie-tab { padding: 20px; max-width: 960px; }
    .paie-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .paie-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.1rem; font-weight: 600; }
    .paie-warning { display: flex; align-items: center; gap: 8px; background: #fff8e1; color: #8a6d00;
                    border: 1px solid #ffe082; border-radius: 8px; padding: 8px 12px; font-size: .85rem; margin-bottom: 16px; }
    .paie-warning code { background: rgba(0,0,0,.06); padding: 1px 4px; border-radius: 4px; }

    .paie-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .paie-empty { color: #888; font-style: italic; padding: 8px 0; }

    .employe-item { display: flex; align-items: center; justify-content: space-between; cursor: pointer;
                    padding: 10px 14px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; transition: all .15s; }
    .employe-item:hover { border-color: #90caf9; }
    .employe-item--selected { border-color: #1565c0; background: #e3f2fd; }
    .employe-item--inactive { opacity: .5; }
    .employe-item__info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .employe-item__nom { font-weight: 500; }
    .employe-item__matricule, .employe-item__poste, .employe-item__regime { color: #666; font-size: .85rem; }
    .employe-item__salaire { font-weight: 500; color: #2e7d32; }

    .paie-form { border: 1px dashed #bbb; border-radius: 8px; padding: 20px; background: #fafafa; margin-bottom: 24px; }
    .paie-form__title { margin: 0 0 16px; font-size: .95rem; font-weight: 600; color: #555; }
    .paie-form__fields { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .paie-form__fields mat-form-field { flex: 1; min-width: 160px; }

    .paie-detail { border-top: 2px solid #e0e0e0; padding-top: 20px; }
    .paie-detail__title { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; }

    .periode-row { display: flex; gap: 12px; margin-bottom: 12px; }
    .periode-field { width: 160px; }

    .variable-form { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .variable-form__row { display: flex; gap: 12px; }
    .commentaire-field { width: 100%; margin-top: 8px; }

    .ligne-libre { margin: 12px 0; }
    .ligne-libre__titre { font-weight: 600; font-size: .85rem; color: #555; margin-bottom: 6px; }
    .ligne-libre__row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .ligne-libre__libelle { flex: 2; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; }
    .ligne-libre__montant { flex: 1; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; }

    .variable-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }

    .resultat { margin-bottom: 24px; }
    .resultat-table, .detail-table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: .9rem; }
    .resultat-table td { padding: 4px 8px; border-bottom: 1px solid #eee; }
    .resultat-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .resultat-table__brut td { font-weight: 600; }
    .resultat-table__net td { font-weight: 700; color: #1565c0; font-size: 1.05rem; }
    .detail-table th, .detail-table td { padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right; }
    .detail-table th:first-child, .detail-table td:first-child { text-align: left; }

    .bulletins-historique { margin-top: 20px; }
    .bulletin-item { display: flex; align-items: center; gap: 16px; padding: 8px 12px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 6px; }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) .employe-item { background: #1e1e1e; border-color: #333; }
      :root:not([data-theme="light"]) .paie-form { background: #151515; border-color: #444; }
      :root:not([data-theme="light"]) .variable-form { border-color: #333; }
      :root:not([data-theme="light"]) .bulletin-item { border-color: #333; }
    }
  `],
})
export class PaieTabComponent implements OnInit {
  @Input() clientId!: number;

  private svc = inject(PaieService);
  private snack = inject(MatSnackBar);

  employes = signal<EmployeClient[]>([]);
  selectedEmploye = signal<EmployeClient | null>(null);
  resultat = signal<ResultatCalculPaie | null>(null);
  bulletins = signal<BulletinPaie[]>([]);

  loading = signal(false);
  savingEmploye = signal(false);
  savingVariable = signal(false);
  calculating = signal(false);
  generating = signal(false);

  typesContrat = TYPES_CONTRAT;
  moisLabels = MOIS_LABEL.map((label, i) => ({ value: i + 1, label }));

  mois = new Date().getMonth() + 1;
  annee = new Date().getFullYear();

  forme: FormeVariable = formeVide();

  blocs: { key: 'primes' | 'absences' | 'avantagesNature' | 'retenuesDiverses'; label: string }[] = [
    { key: 'primes', label: 'Primes' },
    { key: 'absences', label: 'Absences (montant déduit du brut)' },
    { key: 'avantagesNature', label: 'Avantages en nature' },
    { key: 'retenuesDiverses', label: 'Retenues diverses (acompte, saisie...)' },
  ];

  nouvelEmploye: {
    matricule: string; nom: string; prenom: string; poste: string;
    typeContrat: TypeContratEmployePaie; dateEntree: string; salaireBase: number; quotiteTravail: number;
  } = {
    matricule: '', nom: '', prenom: '', poste: '',
    typeContrat: 'CDI', dateEntree: '', salaireBase: 0, quotiteTravail: 100,
  };

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.loading.set(true);
    this.svc.findEmployesByClient(this.clientId).subscribe({
      next: data => { this.employes.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  ajouterEmploye() {
    if (!this.nouvelEmploye.matricule || !this.nouvelEmploye.nom) return;
    this.savingEmploye.set(true);
    this.svc.createEmploye({
      clientId: this.clientId,
      matricule: this.nouvelEmploye.matricule,
      nom: this.nouvelEmploye.nom,
      prenom: this.nouvelEmploye.prenom,
      poste: this.nouvelEmploye.poste || undefined,
      typeContrat: this.nouvelEmploye.typeContrat,
      dateEntree: this.nouvelEmploye.dateEntree || undefined,
      salaireBase: Number(this.nouvelEmploye.salaireBase) || 0,
      quotiteTravail: Number(this.nouvelEmploye.quotiteTravail) || 100,
    }).subscribe({
      next: e => {
        this.employes.update(list => [...list, e]);
        this.nouvelEmploye = { matricule: '', nom: '', prenom: '', poste: '', typeContrat: 'CDI', dateEntree: '', salaireBase: 0, quotiteTravail: 100 };
        this.savingEmploye.set(false);
        this.snack.open('Employé ajouté', 'OK', { duration: 3000 });
      },
      error: () => { this.savingEmploye.set(false); this.snack.open("Erreur lors de l'ajout", 'OK', { duration: 3000 }); },
    });
  }

  supprimerEmploye(e: EmployeClient) {
    this.svc.removeEmploye(e.id).subscribe({
      next: () => {
        this.employes.update(list => list.filter(x => x.id !== e.id));
        if (this.selectedEmploye()?.id === e.id) this.selectedEmploye.set(null);
        this.snack.open('Employé supprimé', 'OK', { duration: 2000 });
      },
    });
  }

  selectionner(e: EmployeClient) {
    this.selectedEmploye.set(e);
    this.resultat.set(null);
    this.chargerVariable();
    this.chargerBulletins();
  }

  chargerVariable() {
    const employe = this.selectedEmploye();
    if (!employe) return;
    this.forme = formeVide();
    this.resultat.set(null);
    this.svc.findVariablePeriode(employe.id, this.mois, this.annee).subscribe({
      next: (v: VariablePaie | null) => {
        if (v) {
          this.forme = {
            heuresSupplementaires: Number(v.heuresSupplementaires) || 0,
            tauxMajorationHeuresSup: v.tauxMajorationHeuresSup != null ? Number(v.tauxMajorationHeuresSup) : null,
            primes: v.primes ?? [],
            absences: v.absences ?? [],
            avantagesNature: v.avantagesNature ?? [],
            retenuesDiverses: v.retenuesDiverses ?? [],
            commentaire: v.commentaire ?? '',
          };
        }
      },
    });
  }

  chargerBulletins() {
    const employe = this.selectedEmploye();
    if (!employe) return;
    this.svc.findBulletinsByEmploye(employe.id).subscribe({
      next: data => this.bulletins.set(data),
    });
  }

  ajouterLigne(key: 'primes' | 'absences' | 'avantagesNature' | 'retenuesDiverses') {
    this.forme[key] = [...this.forme[key], { libelle: '', montant: 0 }];
  }

  retirerLigne(key: 'primes' | 'absences' | 'avantagesNature' | 'retenuesDiverses', index: number) {
    this.forme[key] = this.forme[key].filter((_, i) => i !== index);
  }

  enregistrerVariable() {
    const employe = this.selectedEmploye();
    if (!employe) return;
    this.savingVariable.set(true);
    this.svc.upsertVariable({
      employeClientId: employe.id,
      mois: this.mois,
      annee: this.annee,
      heuresSupplementaires: Number(this.forme.heuresSupplementaires) || 0,
      tauxMajorationHeuresSup: this.forme.tauxMajorationHeuresSup ?? undefined,
      primes: this.forme.primes,
      absences: this.forme.absences,
      avantagesNature: this.forme.avantagesNature,
      retenuesDiverses: this.forme.retenuesDiverses,
      commentaire: this.forme.commentaire || undefined,
    }).subscribe({
      next: () => { this.savingVariable.set(false); this.snack.open('Variables de paie enregistrées', 'OK', { duration: 3000 }); },
      error: () => { this.savingVariable.set(false); this.snack.open("Erreur lors de l'enregistrement", 'OK', { duration: 3000 }); },
    });
  }

  calculerApercu() {
    const employe = this.selectedEmploye();
    if (!employe) return;
    this.calculating.set(true);
    this.enregistrerAvantCalcul(() => {
      this.svc.calculerBulletin(employe.id, this.mois, this.annee).subscribe({
        next: r => { this.resultat.set(r); this.calculating.set(false); },
        error: () => { this.calculating.set(false); this.snack.open('Erreur lors du calcul', 'OK', { duration: 3000 }); },
      });
    });
  }

  genererBulletin() {
    const employe = this.selectedEmploye();
    if (!employe) return;
    this.generating.set(true);
    this.enregistrerAvantCalcul(() => {
      this.svc.genererBulletin(employe.id, this.mois, this.annee).subscribe({
        next: () => {
          this.generating.set(false);
          this.snack.open('Bulletin de paie généré', 'OK', { duration: 3000 });
          this.chargerBulletins();
        },
        error: () => { this.generating.set(false); this.snack.open('Erreur lors de la génération', 'OK', { duration: 3000 }); },
      });
    });
  }

  /** Enregistre systématiquement les variables avant calcul/génération pour ne jamais calculer sur des données non sauvegardées. */
  private enregistrerAvantCalcul(then: () => void) {
    const employe = this.selectedEmploye();
    if (!employe) return;
    this.svc.upsertVariable({
      employeClientId: employe.id,
      mois: this.mois,
      annee: this.annee,
      heuresSupplementaires: Number(this.forme.heuresSupplementaires) || 0,
      tauxMajorationHeuresSup: this.forme.tauxMajorationHeuresSup ?? undefined,
      primes: this.forme.primes,
      absences: this.forme.absences,
      avantagesNature: this.forme.avantagesNature,
      retenuesDiverses: this.forme.retenuesDiverses,
      commentaire: this.forme.commentaire || undefined,
    }).subscribe({ next: then, error: then });
  }

  telechargerPdf(b: BulletinPaie) {
    this.svc.telechargerBulletinPdf(b.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletin-paie-${b.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  labelMois(m: number): string {
    return MOIS_LABEL[m - 1] ?? String(m);
  }
}
