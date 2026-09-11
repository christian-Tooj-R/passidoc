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
  PaieRhService, ConstantePaieRh, OperandeConstantePaieRh, TypeConstantePaieRh,
  ArrondiConstantePaieRh, OperateurCalculConstante, OPERATEUR_CONSTANTE_LABELS,
} from '../../../core/services/paie-rh.service';

const OPERATEURS: OperateurCalculConstante[] = ['+', '-', '*', '/'];

/**
 * Écran "Liste des constantes" (~Sage 100 Paie & RH, refonte — voir
 * Doc/MODULE_PAIE_RH_NOTES.md) : objet séparé et composable référencé depuis les
 * rubriques de paie (au lieu d'une valeur en dur), historisé par date d'effet. Une
 * constante `CALCUL` se compose d'une grille d'opérandes chaînant d'autres constantes
 * et/ou des valeurs littérales via un opérateur — jamais de formule en texte libre.
 * Intégré comme sous-onglet du hub `/rh/paie` (`paie-rh-hub.component.ts`).
 */
@Component({
  selector: 'app-constantes-paie-rh',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatCheckboxModule, MatTooltipModule, MatSnackBarModule,
  ],
  template: `
<div class="cpr-wrap">
  <p class="cpr-hint">
    Taux et montants de référence (ex. taux CNaPS, plafond…) réutilisés par les rubriques dans
    leurs champs Nombre / Base / Taux — historisés par date d'effet, par pôle. Une constante
    peut aussi être calculée à partir d'autres constantes.
    Les lignes marquées <strong>Placeholder</strong> sont des exemples à remplacer par les vraies valeurs.
  </p>

  @if (!editing()) {
  <div class="cpr-card">
    <div class="cpr-toolbar">
      <mat-form-field appearance="outline" class="cpr-search">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput placeholder="Rechercher (code, libellé)" [ngModel]="recherche()" (ngModelChange)="recherche.set($event)" />
      </mat-form-field>
      <button mat-flat-button color="primary" (click)="startCreate()">
        <mat-icon>add</mat-icon> Créer une constante
      </button>
    </div>

    <table class="cpr-table rhx-table">
      <thead>
        <tr><th>Code</th><th>Libellé</th><th>Type</th><th class="num">Valeur / Composition</th><th>Pôle</th><th>Date d'effet</th><th></th></tr>
      </thead>
      <tbody>
        @for (c of filtered(); track c.id) {
          <tr [class.cpr-row--placeholder]="c.estPlaceholder" [class.cpr-row--hidden]="!c.visible">
            <td><span class="cpr-code">{{ c.code }}</span></td>
            <td>
              <span class="strong">{{ c.libelle }}</span>
              @if (c.estPlaceholder) { <span class="rhx-chip rhx-chip--amber rhx-chip--nodot badge-ph">Placeholder</span> }
              @if (!c.visible) { <span class="rhx-chip rhx-chip--muted rhx-chip--nodot badge-off">Masquée</span> }
            </td>
            <td><span class="rhx-chip rhx-chip--nodot" [class.rhx-chip--violet]="c.typeConstante === 'CALCUL'" [class.rhx-chip--muted]="c.typeConstante !== 'CALCUL'">{{ c.typeConstante === 'CALCUL' ? 'Calculée' : 'Valeur' }}</span></td>
            <td class="num">
              @if (c.typeConstante === 'VALEUR') { <span class="strong">{{ c.valeur | number:'1.0-4' }}</span> }
              @else { <span class="cpr-composition">{{ compositionResume(c) }}</span> }
            </td>
            <td><span class="rhx-chip" [class.rhx-chip--violet]="c.regimePaieCode === 'EST'" [class.rhx-chip--blue]="c.regimePaieCode === 'OUEST'" [class.rhx-chip--muted]="c.regimePaieCode !== 'EST' && c.regimePaieCode !== 'OUEST'">{{ c.regimePaieCode }}</span></td>
            <td class="muted">{{ c.dateEffet | date:'dd/MM/yyyy' }}</td>
            <td class="cpr-actions-cell actions">
              <button mat-icon-button matTooltip="Modifier" aria-label="Modifier" (click)="startEdit(c)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button matTooltip="Nouvelle date d'effet (historiser)" aria-label="Nouvelle date d'effet (historiser)" (click)="startNouvelleDateEffet(c)"><mat-icon>event_repeat</mat-icon></button>
              <button mat-icon-button matTooltip="Supprimer" aria-label="Supprimer" (click)="remove(c)"><mat-icon>delete</mat-icon></button>
            </td>
          </tr>
        }
        @if (!filtered().length) {
          <tr><td colspan="7" class="cpr-empty-row">
            <div class="rhx-empty"><mat-icon>functions</mat-icon><div class="rhx-empty__title">Aucune constante</div><div class="rhx-empty__hint">Créez une constante (taux, plafond…) pour la réutiliser dans vos rubriques.</div></div>
          </td></tr>
        }
      </tbody>
    </table>
  </div>
  }

  <!-- ═══ FORMULAIRE ═══ -->
  @if (editing()) {
  <div class="cpr-form-card">
    <div class="cpr-form-header">
      <mat-icon>{{ editingId() ? 'edit' : 'add_circle' }}</mat-icon>
      <span>{{ editingId() ? 'Modifier la constante' : 'Nouvelle constante' }}</span>
    </div>

    <div class="cpr-form-grid">
      <mat-form-field appearance="outline"><mat-label>Code</mat-label><input matInput [(ngModel)]="fCode" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Libellé</mat-label><input matInput [(ngModel)]="fLibelle" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Mémo</mat-label><input matInput [(ngModel)]="fMemo" /></mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Type</mat-label>
        <mat-select [(ngModel)]="fType">
          <mat-option value="VALEUR">Valeur</mat-option>
          <mat-option value="CALCUL">Calculée (composition)</mat-option>
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
        <mat-label>Arrondi</mat-label>
        <mat-select [(ngModel)]="fArrondi">
          <mat-option value="AUCUN">Aucun</mat-option>
          <mat-option value="PLUS_PROCHE">Au plus proche</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-checkbox [(ngModel)]="fVisible">Visible</mat-checkbox>
    </div>

    @if (fType === 'VALEUR') {
      <mat-form-field appearance="outline" class="cpr-valeur-field">
        <mat-label>Valeur</mat-label>
        <input matInput type="number" [(ngModel)]="fValeur" />
      </mat-form-field>
    } @else {
      <div class="cpr-section-title">Paramètres — composition (opérandes)</div>
      <div class="cpr-operandes">
        @for (op of fOperandes; track $index; let i = $index) {
          <div class="cpr-operande-row">
            @if (i > 0) {
              <mat-form-field appearance="outline" class="sm">
                <mat-label>op</mat-label>
                <mat-select [(ngModel)]="op.operateur">
                  @for (o of operateurs; track o) { <mat-option [value]="o">{{ operateurLabel(o) }}</mat-option> }
                </mat-select>
              </mat-form-field>
            } @else {
              <span class="cpr-op-placeholder">(départ)</span>
            }
            <mat-form-field appearance="outline" class="sm">
              <mat-label>Source</mat-label>
              <mat-select [(ngModel)]="op.source">
                <mat-option value="CONSTANTE">Constante</mat-option>
                <mat-option value="VALEUR">Valeur</mat-option>
              </mat-select>
            </mat-form-field>
            @if (op.source === 'CONSTANTE') {
              <mat-form-field appearance="outline">
                <mat-label>Code</mat-label>
                <mat-select [(ngModel)]="op.constanteCode">
                  @for (c of autresConstantes(); track c.code) { <mat-option [value]="c.code">{{ c.code }} — {{ c.libelle }}</mat-option> }
                </mat-select>
              </mat-form-field>
            } @else {
              <mat-form-field appearance="outline">
                <mat-label>Valeur</mat-label>
                <input matInput type="number" [(ngModel)]="op.valeur" />
              </mat-form-field>
            }
            <button mat-icon-button matTooltip="Retirer cet opérande" aria-label="Retirer cet opérande" (click)="retirerOperande(i)"><mat-icon>close</mat-icon></button>
          </div>
        }
      </div>
      <div class="cpr-operandes-actions">
        <button mat-stroked-button (click)="ajouterOperande('CONSTANTE')"><mat-icon>add</mat-icon> Insérer constante(s)</button>
        <button mat-stroked-button (click)="ajouterOperande('VALEUR')"><mat-icon>add</mat-icon> Insérer valeur</button>
        <button mat-button (click)="previsualiser()"><mat-icon>visibility</mat-icon> Prévisualiser</button>
        @if (previsualisation() !== null) {
          <span class="cpr-preview-result">= {{ previsualisation() }}</span>
        }
      </div>
    }

    <mat-form-field appearance="outline" class="cpr-notes">
      <mat-label>Notes</mat-label>
      <textarea matInput rows="2" [(ngModel)]="fNotes"></textarea>
    </mat-form-field>

    <div class="cpr-form-actions">
      <button mat-button (click)="cancelEdit()">Annuler</button>
      <button mat-flat-button color="primary" (click)="save()">Ok</button>
    </div>
  </div>
  }
</div>
  `,
  styles: [`
    .cpr-wrap { display: flex; flex-direction: column; gap: 14px; }
    .cpr-hint { font-size: 12px; color: #64748B; margin: 0; }
    .cpr-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; box-shadow: var(--rhx-shadow); padding: 18px 20px; }
    .cpr-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
    .cpr-search { width: 280px; }
    .cpr-row--placeholder { background: #FFFBEB; }
    .cpr-row--hidden { opacity: .55; }
    .cpr-composition { font-family: monospace; font-size: 12px; color: #64748B; }
    .cpr-empty-row { padding: 0 !important; }
    .cpr-actions-cell { text-align: right; white-space: nowrap; }
    .badge-ph, .badge-off { margin-left: 6px; }
    .cpr-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; color: #4C1D95; background: #F5F3FF; padding: 2px 7px; border-radius: 6px; }
    .cpr-form-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 4px; }
    .cpr-form-header { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #1E293B; margin-bottom: 10px; mat-icon { color: #7C3AED; } }
    .cpr-form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 14px; align-items: center; margin-bottom: 6px; }
    .cpr-valeur-field { max-width: 240px; }
    .cpr-section-title { font-weight: 700; font-size: 13px; color: #334155; margin: 10px 0 6px; padding-top: 10px; border-top: 1px dashed #E2E8F0; }
    .cpr-operandes { display: flex; flex-direction: column; gap: 4px; }
    .cpr-operande-row { display: flex; align-items: center; gap: 10px; }
    .cpr-operande-row mat-form-field.sm { max-width: 110px; }
    .cpr-operande-row mat-form-field { flex: 1; max-width: 320px; }
    .cpr-op-placeholder { font-size: 11px; color: #94A3B8; width: 110px; text-align: center; }
    .cpr-operandes-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
    .cpr-preview-result { font-weight: 700; color: #7C3AED; }
    .cpr-notes { width: 100%; margin-top: 6px; }
    .cpr-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
  `],
})
export class ConstantesPaieRhComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);

  readonly operateurs = OPERATEURS;
  /** TOUS = s'applique à tous les régimes ; EST/OUEST = mêmes valeurs que `User.antenne` (menu Équipes). */
  readonly regimesOptions = ['TOUS', 'EST', 'OUEST'];

  constantes = signal<ConstantePaieRh[]>([]);
  recherche = signal('');

  editing = signal(false);
  editingId = signal<number | null>(null);
  previsualisation = signal<number | null>(null);

  fCode = ''; fLibelle = ''; fMemo = ''; fRegime = 'TOUS';
  fType: TypeConstantePaieRh = 'VALEUR';
  fValeur: number | null = 0;
  fArrondi: ArrondiConstantePaieRh = 'AUCUN';
  fDateEffet = new Date().toISOString().split('T')[0];
  fVisible = true;
  fNotes = '';
  fOperandes: OperandeConstantePaieRh[] = [];

  filtered = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const list = this.constantes();
    if (!q) return list;
    return list.filter((c) => c.code.toLowerCase().includes(q) || c.libelle.toLowerCase().includes(q));
  });

  autresConstantes = computed(() => this.constantes().filter((c) => c.code !== this.fCode));

  ngOnInit() {
    this.load();
  }

  load() {
    this.paieRh.findConstantes().subscribe((c) => this.constantes.set(c));
  }

  operateurLabel(o: OperateurCalculConstante) { return OPERATEUR_CONSTANTE_LABELS[o]; }

  compositionResume(c: ConstantePaieRh): string {
    if (!c.operandes?.length) return '—';
    return c.operandes
      .map((op, i) => {
        const terme = op.source === 'CONSTANTE' ? (op.constanteCode ?? '?') : String(op.valeur ?? 0);
        return i === 0 ? terme : `${op.operateur} ${terme}`;
      })
      .join(' ');
  }

  startCreate() {
    this.editingId.set(null);
    this.fCode = ''; this.fLibelle = ''; this.fMemo = ''; this.fRegime = 'TOUS';
    this.fType = 'VALEUR'; this.fValeur = 0; this.fArrondi = 'AUCUN';
    this.fDateEffet = new Date().toISOString().split('T')[0];
    this.fVisible = true; this.fNotes = '';
    this.fOperandes = [];
    this.previsualisation.set(null);
    this.editing.set(true);
  }

  startEdit(c: ConstantePaieRh) {
    this.editingId.set(c.id);
    this.fCode = c.code; this.fLibelle = c.libelle; this.fMemo = c.memo ?? ''; this.fRegime = c.regimePaieCode;
    this.fType = c.typeConstante; this.fValeur = c.valeur; this.fArrondi = c.arrondi;
    this.fDateEffet = c.dateEffet; this.fVisible = c.visible; this.fNotes = c.notes ?? '';
    this.fOperandes = c.operandes ? JSON.parse(JSON.stringify(c.operandes)) : [];
    this.previsualisation.set(null);
    this.editing.set(true);
  }

  /** "Nouvelle date d'effet" — pré-remplit une nouvelle ligne (même code) avec la date du jour, sans écraser l'historique existant. */
  startNouvelleDateEffet(c: ConstantePaieRh) {
    this.startEdit(c);
    this.editingId.set(null);
    this.fDateEffet = new Date().toISOString().split('T')[0];
  }

  cancelEdit() { this.editing.set(false); }

  ajouterOperande(source: 'CONSTANTE' | 'VALEUR') {
    this.fOperandes.push({ operateur: '+', source, constanteCode: null, valeur: source === 'VALEUR' ? 0 : null });
  }

  retirerOperande(index: number) {
    this.fOperandes.splice(index, 1);
  }

  previsualiser() {
    // Prévisualisation "live" à partir de la composition en cours d'édition : on calcule
    // côté front avec les constantes déjà chargées (même logique que le backend, en plus
    // simple car pas de récursion multi-niveaux nécessaire pour un aperçu ponctuel).
    try {
      let valeur = 0;
      this.fOperandes.forEach((op, i) => {
        const v = op.source === 'CONSTANTE'
          ? Number((this.constantes().find((c) => c.code === op.constanteCode)?.valeur) ?? 0)
          : Number(op.valeur) || 0;
        if (i === 0) { valeur = op.operateur === '-' ? -v : v; return; }
        switch (op.operateur) {
          case '+': valeur += v; break;
          case '-': valeur -= v; break;
          case '*': valeur *= v; break;
          case '/': valeur = v !== 0 ? valeur / v : 0; break;
        }
      });
      if (this.fArrondi === 'PLUS_PROCHE') valeur = Math.round(valeur);
      this.previsualisation.set(valeur);
    } catch {
      this.snack.open('Impossible de prévisualiser (référence invalide)', undefined, { duration: 2500 });
    }
  }

  save() {
    if (!this.fCode.trim() || !this.fLibelle.trim()) {
      this.snack.open('Code et libellé sont obligatoires', undefined, { duration: 2500 });
      return;
    }
    const dto: Partial<ConstantePaieRh> = {
      code: this.fCode.trim(),
      libelle: this.fLibelle.trim(),
      memo: this.fMemo.trim() || undefined,
      regimePaieCode: this.fRegime.trim() || 'TOUS',
      typeConstante: this.fType,
      valeur: this.fType === 'VALEUR' ? Number(this.fValeur) || 0 : null,
      operandes: this.fType === 'CALCUL' ? this.fOperandes : null,
      arrondi: this.fArrondi,
      dateEffet: this.fDateEffet,
      visible: this.fVisible,
      notes: this.fNotes.trim() || undefined,
    };

    const id = this.editingId();
    const obs = id ? this.paieRh.updateConstante(id, dto) : this.paieRh.createConstante(dto);
    obs.subscribe({
      next: () => {
        this.snack.open(id ? 'Constante mise à jour' : 'Constante créée', undefined, { duration: 2500 });
        this.editing.set(false);
        this.load();
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  remove(c: ConstantePaieRh) {
    if (!confirm(`Supprimer la constante "${c.libelle}" (${c.code}, effet ${c.dateEffet}) ?`)) return;
    this.paieRh.removeConstante(c.id).subscribe({
      next: () => { this.snack.open('Constante supprimée', undefined, { duration: 2500 }); this.load(); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }
}
