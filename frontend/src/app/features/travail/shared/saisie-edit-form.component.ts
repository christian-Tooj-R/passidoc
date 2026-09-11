import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  TypeTemps, CategorieNonFacturable, MissionCode, MISSION_CODES,
} from '../../../core/services/saisie-temps.service';
import { Client } from '../../../core/models/client.model';
import { parseDuree, formatHeures } from '../../../core/services/duree.util';

const CATEGORIES_NF: { code: CategorieNonFacturable; label: string }[] = [
  { code: 'APPEL_CLIENT',     label: 'Appel client' },
  { code: 'REUNION_INTERNE',  label: 'Réunion interne' },
  { code: 'FORMATION',        label: 'Formation' },
  { code: 'ADMINISTRATIF',    label: 'Administratif' },
  { code: 'AUTRE',            label: 'Autre' },
];

/** Valeurs pré-remplissables pour l'édition ou la duplication d'une saisie. */
export interface SaisieEditSeed {
  date: string;
  clientId?: number | null;
  missionCode?: string | null;
  dureeHeures: number;
  type: TypeTemps;
  categorie?: CategorieNonFacturable | null;
  commentaire?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
}

/** Résultat émis vers le parent — champs prêts à passer à create()/update(). */
export interface SaisieEditResult {
  date: string;
  clientId?: number;
  missionCode?: string;
  dureeHeures: number;
  type: TypeTemps;
  categorie?: CategorieNonFacturable;
  commentaire?: string;
  heureDebut?: string;
  heureFin?: string;
}

/**
 * Formulaire d'édition/duplication réutilisable entre "Par jour" et "Détail des
 * temps" — même champs et même style (.line-form) que la page "Saisie rapide",
 * factorisé ici pour ne pas dupliquer le formulaire sur chaque page.
 */
@Component({
  selector: 'app-saisie-edit-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
<div class="sef-panel">
  <div class="sef-hd">
    <mat-icon>{{ mode === 'duplicate' ? 'content_copy' : 'edit' }}</mat-icon>
    <span>{{ mode === 'duplicate' ? 'Dupliquer la saisie' : 'Modifier la saisie' }}</span>
    <button type="button" class="sef-close" (click)="cancel.emit()">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <form class="line-form sef-form" (ngSubmit)="submit()">
    <div class="lf-row">
      <div class="lf-field lf-field--date">
        <label class="lf-label">Date</label>
        <input type="date" class="lf-input" [(ngModel)]="date" name="sefDate" required />
      </div>
      <div class="lf-field lf-field--grow">
        <label class="lf-label">Client</label>
        <select class="lf-input" [(ngModel)]="clientId" name="sefClientId">
          <option [ngValue]="null">— Client (optionnel) —</option>
          @for (c of clients; track c.id) {
            <option [ngValue]="c.id">{{ c.nom }}</option>
          }
        </select>
      </div>
      <div class="lf-field lf-field--grow">
        <label class="lf-label">Mission</label>
        <select class="lf-input" [(ngModel)]="missionCode" name="sefMissionCode">
          <option [ngValue]="null">— Mission (optionnel) —</option>
          @for (m of missionCodes; track m.code) {
            <option [ngValue]="m.code">{{ m.label }}</option>
          }
        </select>
      </div>
      <div class="lf-field lf-field--duree">
        <label class="lf-label">Durée</label>
        <input class="lf-input" [(ngModel)]="dureeInput" name="sefDuree"
               placeholder="1h30" required (blur)="validerDuree()" />
      </div>
    </div>

    <div class="lf-row">
      <div class="lf-field">
        <label class="lf-label">Début</label>
        <input type="time" class="lf-input" [(ngModel)]="heureDebut" name="sefDebut" />
      </div>
      <div class="lf-field">
        <label class="lf-label">Fin</label>
        <input type="time" class="lf-input" [(ngModel)]="heureFin" name="sefFin" />
      </div>
      <div class="lf-field lf-field--type">
        <label class="lf-label">Type</label>
        <div class="lf-type">
          <button type="button" class="lf-type__btn" [class.lf-type__btn--on]="type === 'FACTURABLE'"
                  (click)="type = 'FACTURABLE'">Facturable</button>
          <button type="button" class="lf-type__btn" [class.lf-type__btn--on]="type === 'NON_FACTURABLE'"
                  (click)="type = 'NON_FACTURABLE'">Non fact.</button>
        </div>
      </div>
      @if (type === 'NON_FACTURABLE') {
        <div class="lf-field lf-field--grow">
          <label class="lf-label">Catégorie</label>
          <select class="lf-input" [(ngModel)]="categorie" name="sefCategorie">
            @for (c of categoriesNF; track c.code) {
              <option [ngValue]="c.code">{{ c.label }}</option>
            }
          </select>
        </div>
      }
      <div class="lf-field lf-field--grow2">
        <label class="lf-label">Commentaire</label>
        <input class="lf-input" [(ngModel)]="commentaire" name="sefCommentaire"
               placeholder="Description de l'activité…" />
      </div>
      <button type="submit" class="lf-submit" [disabled]="submitting">
        <mat-icon>{{ submitting ? 'hourglass_empty' : 'check' }}</mat-icon>
        {{ submitting ? 'Enregistrement…' : (mode === 'duplicate' ? 'Créer la copie' : 'Enregistrer') }}
      </button>
      <button type="button" class="sef-cancel" (click)="cancel.emit()">Annuler</button>
    </div>

    @if (localError) { <p class="lf-error">{{ localError }}</p> }
    @if (apiError) { <p class="lf-error">{{ apiError }}</p> }
  </form>
</div>
  `,
  styles: [`
    .sef-panel { background:#fff; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #e0e7ff; margin:0 28px 16px; overflow:hidden; }
    .sef-hd { display:flex; align-items:center; gap:8px; padding:10px 18px; background:#eef2ff; font-size:12.5px; font-weight:700; color:#4338ca; }
    .sef-hd mat-icon { font-size:16px; width:16px; height:16px; }
    .sef-close { margin-left:auto; background:none; border:none; cursor:pointer; color:#6366f1; display:flex; padding:2px; }
    .sef-close mat-icon { font-size:16px; width:16px; height:16px; }
    .sef-form { padding:16px 18px; margin:0; box-shadow:none; border:none; border-radius:0; }
    .sef-cancel { height:36px; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; border-radius:7px; padding:0 14px; font-size:13px; cursor:pointer; }
    .sef-cancel:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }

    .lf-row { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
    .lf-row:last-of-type { margin-bottom:0; }
    .lf-field { display:flex; flex-direction:column; gap:4px; }
    .lf-field--grow  { flex:1; min-width:160px; }
    .lf-field--grow2 { flex:2; min-width:220px; }
    .lf-field--date  { min-width:150px; }
    .lf-field--duree { min-width:110px; }
    .lf-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .lf-input { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; width:100%; box-sizing:border-box; }
    .lf-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }

    .lf-type { display:flex; gap:4px; background:#f1f5f9; border-radius:7px; padding:3px; }
    .lf-type__btn { height:30px; border:none; background:transparent; border-radius:5px; padding:0 12px; font-size:12.5px; font-weight:600; color:#64748b; cursor:pointer; transition:all .15s; }
    .lf-type__btn--on { background:#6366f1; color:#fff; }

    .lf-submit { height:36px; background:#059669; color:#fff; border:none; border-radius:7px; padding:0 18px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; transition:background .15s; }
    .lf-submit:hover:not(:disabled) { background:#047857; }
    .lf-submit:disabled { opacity:.6; cursor:not-allowed; }
    .lf-submit mat-icon { font-size:18px; width:18px; height:18px; }
    .lf-error { color:#dc2626; font-size:12.5px; margin:8px 0 0; }
  `],
})
export class SaisieEditFormComponent implements OnChanges {
  @Input() clients: Client[] = [];
  @Input() mode: 'edit' | 'duplicate' = 'edit';
  @Input() seed: SaisieEditSeed | null = null;
  @Input() submitting = false;
  @Input() apiError = '';

  @Output() save   = new EventEmitter<SaisieEditResult>();
  @Output() cancel = new EventEmitter<void>();

  readonly missionCodes = MISSION_CODES;
  readonly categoriesNF = CATEGORIES_NF;

  date        = new Date().toISOString().split('T')[0];
  clientId: number | null = null;
  missionCode: MissionCode | null = null;
  dureeInput  = '';
  type: TypeTemps = 'FACTURABLE';
  categorie: CategorieNonFacturable = 'AUTRE';
  commentaire = '';
  heureDebut  = '';
  heureFin    = '';
  localError  = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['seed'] && this.seed) {
      const s = this.seed;
      this.date        = s.date;
      this.clientId    = s.clientId ?? null;
      this.missionCode = (s.missionCode as MissionCode) ?? null;
      this.dureeInput  = formatHeures(s.dureeHeures);
      this.type        = s.type;
      this.categorie   = s.categorie ?? 'AUTRE';
      this.commentaire = s.commentaire ?? '';
      this.heureDebut  = s.heureDebut ?? '';
      this.heureFin    = s.heureFin ?? '';
      this.localError  = '';
    }
  }

  validerDuree() {
    this.localError = parseDuree(this.dureeInput) === null
      ? 'Durée invalide — utilisez un format comme "1h30" ou "1.5"'
      : '';
  }

  submit() {
    const duree = parseDuree(this.dureeInput);
    if (!this.date || duree === null) {
      this.localError = 'Durée invalide — utilisez un format comme "1h30" ou "1.5"';
      return;
    }
    this.localError = '';
    this.save.emit({
      date:        this.date,
      dureeHeures: Math.round(duree * 100) / 100,
      type:        this.type,
      categorie:   this.type === 'NON_FACTURABLE' ? this.categorie : undefined,
      missionCode: this.missionCode ?? undefined,
      clientId:    this.clientId ?? undefined,
      commentaire: this.commentaire || undefined,
      heureDebut:  this.heureDebut || undefined,
      heureFin:    this.heureFin || undefined,
    });
  }
}
