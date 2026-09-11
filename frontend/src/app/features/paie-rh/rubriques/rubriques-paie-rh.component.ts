import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  PaieRhService, RubriquePaieRh, ConstantePaieRh, ImputationRubriqueRh, NatureRubriqueRh,
  TypeCalculRubriqueRh, ElementCalculPartRubriqueRh, SourceOperandeRubriqueRh,
  IMPUTATION_RUBRIQUE_LABELS, NATURE_RUBRIQUE_LABELS, TYPE_CALCUL_RUBRIQUE_LABELS,
  deriverNatureRubriqueRh, elementVide,
} from '../../../core/services/paie-rh.service';

type FiltreNature = 'TOUTES' | NatureRubriqueRh;

const NATURES_ARBORESCENCE: NatureRubriqueRh[] = ['DE_BRUT', 'DE_COTISATION', 'NON_SOUMISE'];
const SOURCES_OPERANDE: { v: SourceOperandeRubriqueRh; l: string }[] = [
  { v: 'VALEUR', l: 'Valeur saisie' },
  { v: 'CONSTANTE', l: 'Constante (picker)' },
  { v: 'BRUT', l: 'Total brut (calculé)' },
  { v: 'SALAIRE_BASE', l: 'Salaire de base (contrat)' },
];

/**
 * Écran "Liste des rubriques" (~Sage 100 Paie & RH, refonte — voir Doc/MODULE_PAIE_RH_NOTES.md) :
 * arborescence par nature à gauche (De brut / De cotisation / Non soumises), liste plate
 * filtrée à droite, formulaire de création/édition avec le calcul guidé (type de calcul +
 * grille Nombre/Base/Taux par part salariale/patronale + flags Report/Impression/Saisie).
 * Remplace l'ancien écran "taux ou montant fixe" simpliste. Intégré comme sous-onglet du
 * hub `/rh/paie` (`paie-rh-hub.component.ts`).
 */
@Component({
  selector: 'app-rubriques-paie-rh',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatCheckboxModule, MatTooltipModule, MatSnackBarModule,
  ],
  template: `
<div class="rpr-wrap">
  <p class="rpr-hint">
    Lignes de calcul du bulletin (cotisations, primes, retenues…) : type de calcul + grille
    Nombre / Base / Taux pour chaque part salariale et patronale, par pôle et par date d'effet.
    Les lignes marquées <strong>Placeholder</strong> sont des exemples à remplacer par les vrais taux.
  </p>

  @if (!editing()) {
  <div class="rpr-body">

    <!-- ═══ ARBORESCENCE PAR NATURE ═══ -->
    <aside class="rpr-tree">
      <button class="rpr-tree-item" [class.active]="natureFiltre()==='TOUTES'" (click)="natureFiltre.set('TOUTES')">
        <mat-icon>account_tree</mat-icon>
        <span>Toutes les rubriques</span>
        <span class="rpr-count">{{ rubriques().length }}</span>
      </button>
      @for (n of natures; track n) {
        <button class="rpr-tree-item rpr-tree-item--child" [class.active]="natureFiltre()===n" (click)="natureFiltre.set(n)">
          <mat-icon>{{ n === 'DE_BRUT' ? 'trending_up' : n === 'DE_COTISATION' ? 'account_balance' : 'info' }}</mat-icon>
          <span>{{ natureLabel(n) }}</span>
          <span class="rpr-count">{{ groupes()[n].length }}</span>
        </button>
      }
    </aside>

    <!-- ═══ LISTE PLATE ═══ -->
    <section class="rpr-list">
      <div class="rpr-toolbar">
        <mat-form-field appearance="outline" class="rpr-search">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput placeholder="Rechercher (code, libellé)" [ngModel]="recherche()" (ngModelChange)="recherche.set($event)" />
        </mat-form-field>
        <button mat-flat-button color="primary" (click)="startCreate()">
          <mat-icon>add</mat-icon> Créer une rubrique
        </button>
      </div>

      <table class="rpr-table rhx-table">
        <thead>
          <tr><th>Code</th><th>Libellé</th><th>Type de calcul</th><th>Imputation</th><th>Pôle</th><th>Effet</th><th></th></tr>
        </thead>
        <tbody>
          @for (r of filtered(); track r.id) {
            <tr [class.rpr-row--placeholder]="r.estPlaceholder" [class.rpr-row--inactive]="!r.isActive">
              <td><span class="rpr-code">{{ r.code }}</span></td>
              <td>
                <span class="strong">{{ r.libelle }}</span>
                @if (r.estPlaceholder) { <span class="rhx-chip rhx-chip--amber rhx-chip--nodot badge-ph">Placeholder</span> }
                @if (!r.isActive) { <span class="rhx-chip rhx-chip--muted rhx-chip--nodot badge-off">Inactive</span> }
              </td>
              <td class="muted">{{ typeCalculLabel(r.typeCalcul) }}</td>
              <td><span class="rhx-chip rhx-chip--nodot" [class.rhx-chip--rose]="r.imputation === 'COTISATION'" [class.rhx-chip--teal]="r.imputation === 'PRIME' || r.imputation === 'AVANTAGE'" [class.rhx-chip--amber]="r.imputation === 'RETENUE'" [class.rhx-chip--muted]="r.imputation === 'INFORMATION'">{{ imputationLabel(r.imputation) }}</span></td>
              <td><span class="rhx-chip" [class.rhx-chip--violet]="r.regimePaieCode === 'EST'" [class.rhx-chip--blue]="r.regimePaieCode === 'OUEST'" [class.rhx-chip--muted]="r.regimePaieCode !== 'EST' && r.regimePaieCode !== 'OUEST'">{{ r.regimePaieCode }}</span></td>
              <td class="muted">{{ r.dateEffet | date:'dd/MM/yyyy' }}</td>
              <td class="rpr-actions-cell actions">
                <button mat-icon-button matTooltip="Modifier" aria-label="Modifier" (click)="startEdit(r)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button matTooltip="Dupliquer" aria-label="Dupliquer" (click)="dupliquer(r)"><mat-icon>content_copy</mat-icon></button>
                <button mat-icon-button matTooltip="Supprimer" aria-label="Supprimer" (click)="remove(r)"><mat-icon>delete</mat-icon></button>
              </td>
            </tr>
          }
          @if (!filtered().length) {
            <tr><td colspan="7" class="rpr-empty-row">
              <div class="rhx-empty"><mat-icon>list_alt</mat-icon><div class="rhx-empty__title">Aucune rubrique</div><div class="rhx-empty__hint">Créez une rubrique pour définir une ligne de calcul du bulletin.</div></div>
            </td></tr>
          }
        </tbody>
      </table>
    </section>
  </div>
  }

  <!-- ═══ FORMULAIRE CRÉATION/ÉDITION ═══ -->
  @if (editing()) {
  <div class="rpr-form-card">
    <div class="rpr-form-header">
      <mat-icon>{{ editingId() ? 'edit' : 'add_circle' }}</mat-icon>
      <span>{{ editingId() ? 'Modifier la rubrique' : 'Nouvelle rubrique' }}</span>
    </div>

    <!-- Onglet "Rubriques" (général) -->
    <div class="rpr-form-grid">
      <mat-form-field appearance="outline"><mat-label>Code</mat-label><input matInput [(ngModel)]="fCode" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Libellé</mat-label><input matInput [(ngModel)]="fLibelle" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Mémo</mat-label><input matInput [(ngModel)]="fMemo" placeholder="Ex: INDLOG" /></mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Imputation</mat-label>
        <mat-select [(ngModel)]="fImputation" (ngModelChange)="onImputationChange()">
          @for (i of imputations; track i) { <mat-option [value]="i">{{ imputationLabel(i) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Régime (pôle)</mat-label>
        <mat-select [(ngModel)]="fRegime">
          @for (r of regimesOptions; track r) { <mat-option [value]="r">{{ r }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Date d'effet</mat-label>
        <input matInput type="date" [(ngModel)]="fDateEffet" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Ordre d'affichage</mat-label>
        <input matInput type="number" [(ngModel)]="fOrdre" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Plafond mensuel (optionnel)</mat-label>
        <input matInput type="number" [(ngModel)]="fPlafond" placeholder="Ex: plafond sécu" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Compte comptable (optionnel)</mat-label>
        <input matInput [(ngModel)]="fCompteComptable" />
      </mat-form-field>
      <mat-checkbox [(ngModel)]="fIsActive">En activité</mat-checkbox>
    </div>

    <!-- Onglet "Éléments constitutifs" -->
    <div class="rpr-section-title">Éléments constitutifs</div>
    <mat-form-field appearance="outline" class="rpr-type-calcul">
      <mat-label>Type de calcul</mat-label>
      <mat-select [(ngModel)]="fTypeCalcul">
        @for (t of typesCalcul; track t) { <mat-option [value]="t">{{ typeCalculLabel(t) }}</mat-option> }
      </mat-select>
    </mat-form-field>

    @if (fImputation === 'COTISATION') {
      <div class="rpr-assiette-grid">
        <mat-form-field appearance="outline">
          <mat-label>Assiette de calcul des bases de cotisation</mat-label>
          <mat-select [(ngModel)]="fAssiette">
            <mat-option [value]="null">— Base propre à chaque part —</mat-option>
            <mat-option value="BRUT">BRUT (total brut calculé)</mat-option>
            <mat-option value="SALAIRE_BASE">SALAIRE_BASE (salaire du contrat)</mat-option>
            @for (r of autresRubriques(); track r.code) { <mat-option [value]="r.code">{{ r.code }} — {{ r.libelle }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-checkbox [(ngModel)]="fReportAssiette" matTooltip="Information conservée — pas encore prise en compte dans le calcul">
          Report de l'assiette
        </mat-checkbox>
      </div>
    }

    <div class="rpr-part">
      <div class="rpr-part-title">Part salariale</div>
      <ng-container *ngTemplateOutlet="partTpl; context: { element: elementSalarial() }" />
    </div>

    @if (fImputation === 'COTISATION') {
      <div class="rpr-part">
        <div class="rpr-part-title">Part patronale</div>
        <ng-container *ngTemplateOutlet="partTpl; context: { element: elementPatronal() }" />
      </div>
    }

    <mat-form-field appearance="outline" class="rpr-notes">
      <mat-label>Notes</mat-label>
      <textarea matInput rows="2" [(ngModel)]="fNotes"></textarea>
    </mat-form-field>

    <div class="rpr-form-actions">
      <button mat-button (click)="cancelEdit()">Annuler</button>
      <button mat-flat-button color="primary" (click)="save()">Ok</button>
    </div>
  </div>
  }

  <!-- Template réutilisé pour une part (salariale ou patronale) -->
  <ng-template #partTpl let-element="element">
    <div class="rpr-grid-nbt">
      <div class="rpr-nbt-col">
        <span class="rpr-nbt-label">Nombre</span>
        <mat-form-field appearance="outline" class="sm">
          <mat-select [(ngModel)]="element.nombre.source">
            @for (s of sourcesOperande; track s.v) { <mat-option [value]="s.v">{{ s.l }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (element.nombre.source === 'VALEUR') {
          <mat-form-field appearance="outline" class="sm"><input matInput type="number" [(ngModel)]="element.nombre.valeur" /></mat-form-field>
        } @else if (element.nombre.source === 'CONSTANTE') {
          <mat-form-field appearance="outline" class="sm">
            <mat-select [(ngModel)]="element.nombre.constanteCode" placeholder="Constante...">
              @for (c of constantes(); track c.code) { <mat-option [value]="c.code">{{ c.code }}</mat-option> }
            </mat-select>
          </mat-form-field>
        }
      </div>
      <div class="rpr-nbt-col">
        <span class="rpr-nbt-label">Base</span>
        <mat-form-field appearance="outline" class="sm">
          <mat-select [(ngModel)]="element.base.source">
            @for (s of sourcesOperande; track s.v) { <mat-option [value]="s.v">{{ s.l }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (element.base.source === 'VALEUR') {
          <mat-form-field appearance="outline" class="sm"><input matInput type="number" [(ngModel)]="element.base.valeur" /></mat-form-field>
        } @else if (element.base.source === 'CONSTANTE') {
          <mat-form-field appearance="outline" class="sm">
            <mat-select [(ngModel)]="element.base.constanteCode" placeholder="Constante...">
              @for (c of constantes(); track c.code) { <mat-option [value]="c.code">{{ c.code }}</mat-option> }
            </mat-select>
          </mat-form-field>
        }
      </div>
      <div class="rpr-nbt-col">
        <span class="rpr-nbt-label">Taux (%)</span>
        <mat-form-field appearance="outline" class="sm">
          <mat-select [(ngModel)]="element.taux.source">
            @for (s of sourcesOperande; track s.v) { <mat-option [value]="s.v">{{ s.l }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (element.taux.source === 'VALEUR') {
          <mat-form-field appearance="outline" class="sm"><input matInput type="number" [(ngModel)]="element.taux.valeur" /></mat-form-field>
        } @else if (element.taux.source === 'CONSTANTE') {
          <mat-form-field appearance="outline" class="sm">
            <mat-select [(ngModel)]="element.taux.constanteCode" placeholder="Constante...">
              @for (c of constantes(); track c.code) { <mat-option [value]="c.code">{{ c.code }}</mat-option> }
            </mat-select>
          </mat-form-field>
        }
      </div>
      <div class="rpr-nbt-col rpr-nbt-col--montant">
        <span class="rpr-nbt-label">Montant</span>
        <div class="rpr-montant-calcule">(Calculé)</div>
      </div>
    </div>
    <div class="rpr-flags">
      <mat-checkbox [(ngModel)]="element.reportApresCloture" matTooltip="R — stocké, non câblé dans le moteur v1">Report après clôture (R)</mat-checkbox>
      <mat-checkbox [(ngModel)]="element.impressionBulletin" matTooltip="I — contrôle réellement l'affichage sur le bulletin PDF">Impression bulletin (I)</mat-checkbox>
      <mat-checkbox [(ngModel)]="element.saisieAutorisee" matTooltip="S — stocké, non câblé dans le moteur v1">Saisie autorisée (S)</mat-checkbox>
    </div>
  </ng-template>
</div>
  `,
  styles: [`
    .rpr-wrap { display: flex; flex-direction: column; gap: 14px; }
    .rpr-hint { font-size: 12px; color: #64748B; margin: 0; }
    .rpr-body { display: flex; gap: 16px; align-items: flex-start; }
    .rpr-tree { width: 220px; flex-shrink: 0; background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; box-shadow: var(--rhx-shadow); padding: 8px; display: flex; flex-direction: column; gap: 2px; }
    .rpr-tree-item {
      display: flex; align-items: center; gap: 8px; border: none; background: none; cursor: pointer; text-align: left;
      padding: 8px 10px; font-size: 12.5px; color: #475569; border-radius: 8px; width: 100%;
      mat-icon { font-size: 17px; width: 17px; height: 17px; color: #94A3B8; }
    }
    .rpr-tree-item--child { padding-left: 26px; }
    .rpr-tree-item:hover { background: #F8FAFC; }
    .rpr-tree-item.active { background: #EDE9F8; color: #5B21B6; font-weight: 700; }
    .rpr-tree-item.active mat-icon { color: #7C3AED; }
    .rpr-count { margin-left: auto; font-size: 10px; color: #94A3B8; }
    .rpr-list { flex: 1; min-width: 0; background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; box-shadow: var(--rhx-shadow); padding: 18px 20px; }
    .rpr-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
    .rpr-search { width: 280px; }
    .rpr-row--placeholder { background: #FFFBEB; }
    .rpr-row--inactive { opacity: .55; }
    .rpr-empty-row { padding: 0 !important; }
    .rpr-actions-cell { text-align: right; white-space: nowrap; }
    .badge-ph, .badge-off { margin-left: 6px; }
    .rpr-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; color: #4C1D95; background: #F5F3FF; padding: 2px 7px; border-radius: 6px; }
    .rpr-form-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 4px; }
    .rpr-form-header { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #1E293B; margin-bottom: 10px; mat-icon { color: #7C3AED; } }
    .rpr-form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 14px; align-items: center; margin-bottom: 6px; }
    .rpr-section-title { font-weight: 700; font-size: 13px; color: #334155; margin: 10px 0 6px; padding-top: 10px; border-top: 1px dashed #E2E8F0; }
    .rpr-type-calcul { max-width: 320px; margin-bottom: 6px; }
    .rpr-assiette-grid { display: flex; align-items: center; gap: 20px; margin-bottom: 10px; }
    .rpr-assiette-grid mat-form-field { flex: 1; max-width: 420px; }
    .rpr-part { background: #F8FAFC; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
    .rpr-part-title { font-weight: 700; font-size: 12px; color: #475569; margin-bottom: 8px; }
    .rpr-grid-nbt { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .rpr-nbt-col { display: flex; flex-direction: column; gap: 2px; }
    .rpr-nbt-label { font-size: 10px; color: #94A3B8; text-transform: uppercase; }
    .rpr-nbt-col mat-form-field.sm { width: 100%; }
    .rpr-montant-calcule { font-size: 12px; color: #94A3B8; font-style: italic; background: #F1F5F9; border-radius: 6px; padding: 8px 10px; margin-top: 4px; }
    .rpr-flags { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 6px; font-size: 12px; }
    .rpr-notes { width: 100%; margin-top: 6px; }
    .rpr-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
  `],
})
export class RubriquesPaieRhComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);

  readonly natures = NATURES_ARBORESCENCE;
  readonly sourcesOperande = SOURCES_OPERANDE;
  readonly imputations: ImputationRubriqueRh[] = ['COTISATION', 'PRIME', 'RETENUE', 'AVANTAGE', 'INFORMATION'];
  /** TOUS = s'applique à tous les régimes ; EST/OUEST = même valeurs que `User.antenne` (menu Équipes). */
  readonly regimesOptions = ['TOUS', 'EST', 'OUEST'];
  readonly typesCalcul: TypeCalculRubriqueRh[] = [
    'MONTANT_FIXE', 'NOMBRE_X_BASE', 'NOMBRE_X_BASE_X_TAUX', 'NOMBRE_X_TAUX',
    'BASE_X_TAUX', 'BASE_DIV_NOMBRE', 'NOMBRE_DIV_TAUX', 'BASE_DIV_TAUX', 'TOTALISATION',
  ];

  rubriques = signal<RubriquePaieRh[]>([]);
  constantes = signal<ConstantePaieRh[]>([]);
  natureFiltre = signal<FiltreNature>('TOUTES');
  recherche = signal('');

  editing = signal(false);
  editingId = signal<number | null>(null);

  fCode = ''; fLibelle = ''; fMemo = ''; fRegime = 'TOUS'; fOrdre = 0;
  fDateEffet = new Date().toISOString().split('T')[0];
  fImputation: ImputationRubriqueRh = 'COTISATION';
  fTypeCalcul: TypeCalculRubriqueRh = 'MONTANT_FIXE';
  fPlafond: number | null = null;
  fCompteComptable = '';
  fNotes = '';
  fIsActive = true;
  fAssiette: string | null = null;
  fReportAssiette = false;

  elementSalarial = signal<ElementCalculPartRubriqueRh>(elementVide());
  elementPatronal = signal<ElementCalculPartRubriqueRh>(elementVide());

  groupes = computed(() => {
    const groups: Record<NatureRubriqueRh, RubriquePaieRh[]> = { DE_BRUT: [], DE_COTISATION: [], NON_SOUMISE: [] };
    for (const r of this.rubriques()) groups[deriverNatureRubriqueRh(r.imputation)].push(r);
    return groups;
  });

  filtered = computed(() => {
    const nature = this.natureFiltre();
    let list = this.rubriques();
    if (nature !== 'TOUTES') list = list.filter((r) => deriverNatureRubriqueRh(r.imputation) === nature);
    const q = this.recherche().trim().toLowerCase();
    if (q) list = list.filter((r) => r.code.toLowerCase().includes(q) || r.libelle.toLowerCase().includes(q));
    return list;
  });

  autresRubriques = computed(() => this.rubriques().filter((r) => r.id !== this.editingId()));

  ngOnInit() {
    this.load();
  }

  load() {
    this.paieRh.findRubriques().subscribe((r) => this.rubriques.set(r));
    this.paieRh.findConstantes().subscribe((c) => this.constantes.set(c));
  }

  natureLabel(n: NatureRubriqueRh) { return NATURE_RUBRIQUE_LABELS[n]; }
  imputationLabel(i: ImputationRubriqueRh) { return IMPUTATION_RUBRIQUE_LABELS[i]; }
  typeCalculLabel(t: TypeCalculRubriqueRh) { return TYPE_CALCUL_RUBRIQUE_LABELS[t]; }

  onImputationChange() {
    // Rien à faire côté données — la part patronale n'est simplement pas affichée/envoyée
    // si l'imputation n'est plus COTISATION (voir save()).
  }

  startCreate() {
    this.editingId.set(null);
    this.fCode = ''; this.fLibelle = ''; this.fMemo = ''; this.fRegime = 'TOUS'; this.fOrdre = 0;
    this.fDateEffet = new Date().toISOString().split('T')[0];
    this.fImputation = 'COTISATION';
    this.fTypeCalcul = 'MONTANT_FIXE';
    this.fPlafond = null; this.fCompteComptable = ''; this.fNotes = ''; this.fIsActive = true;
    this.fAssiette = null; this.fReportAssiette = false;
    this.elementSalarial.set(elementVide());
    this.elementPatronal.set(elementVide());
    this.editing.set(true);
  }

  startEdit(r: RubriquePaieRh) {
    this.editingId.set(r.id);
    this.fCode = r.code; this.fLibelle = r.libelle; this.fMemo = r.memo ?? ''; this.fRegime = r.regimePaieCode; this.fOrdre = r.ordreAffichage;
    this.fDateEffet = r.dateEffet;
    this.fImputation = r.imputation;
    this.fTypeCalcul = r.typeCalcul;
    this.fPlafond = r.plafondMensuel; this.fCompteComptable = r.compteComptable ?? ''; this.fNotes = r.notes ?? ''; this.fIsActive = r.isActive;
    this.fAssiette = r.assietteRubriqueCode; this.fReportAssiette = r.reportAssiette;
    this.elementSalarial.set(JSON.parse(JSON.stringify(r.elementSalarial)));
    this.elementPatronal.set(r.elementPatronal ? JSON.parse(JSON.stringify(r.elementPatronal)) : elementVide());
    this.editing.set(true);
  }

  cancelEdit() { this.editing.set(false); }

  save() {
    if (!this.fCode.trim() || !this.fLibelle.trim()) {
      this.snack.open('Code et libellé sont obligatoires', undefined, { duration: 2500 });
      return;
    }
    const dto: Partial<RubriquePaieRh> = {
      code: this.fCode.trim(),
      libelle: this.fLibelle.trim(),
      memo: this.fMemo.trim() || undefined,
      regimePaieCode: this.fRegime.trim() || 'TOUS',
      dateEffet: this.fDateEffet,
      ordreAffichage: Number(this.fOrdre) || 0,
      imputation: this.fImputation,
      typeCalcul: this.fTypeCalcul,
      plafondMensuel: this.fPlafond != null && this.fPlafond !== ('' as any) ? Number(this.fPlafond) : null,
      compteComptable: this.fCompteComptable.trim() || undefined,
      notes: this.fNotes.trim() || undefined,
      isActive: this.fIsActive,
      assietteRubriqueCode: this.fImputation === 'COTISATION' ? this.fAssiette : null,
      reportAssiette: this.fImputation === 'COTISATION' ? this.fReportAssiette : false,
      elementSalarial: this.elementSalarial(),
      elementPatronal: this.fImputation === 'COTISATION' ? this.elementPatronal() : null,
    };

    const id = this.editingId();
    const obs = id ? this.paieRh.updateRubrique(id, dto) : this.paieRh.createRubrique(dto);
    obs.subscribe({
      next: () => {
        this.snack.open(id ? 'Rubrique mise à jour' : 'Rubrique créée', undefined, { duration: 2500 });
        this.editing.set(false);
        this.load();
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  dupliquer(r: RubriquePaieRh) {
    this.startEdit(r);
    this.editingId.set(null);
    this.fCode = r.code + '_COPIE';
    this.fLibelle = r.libelle + ' (copie)';
    this.fDateEffet = new Date().toISOString().split('T')[0];
  }

  remove(r: RubriquePaieRh) {
    if (!confirm(`Supprimer la rubrique "${r.libelle}" ?`)) return;
    this.paieRh.removeRubrique(r.id).subscribe({
      next: () => { this.snack.open('Rubrique supprimée', undefined, { duration: 2500 }); this.load(); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }
}
